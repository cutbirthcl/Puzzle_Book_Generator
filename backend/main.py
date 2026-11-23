"""FastAPI backend for Puzzle Book Generator (Vault storage + ReportLab imposition)."""

from __future__ import annotations

import json
import os
import re
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .reportlab_imposer import compile_booklet, generate_imposed_pdf_bytes
from .solvers import parse_uploaded_puzzle_bytes

IS_FROZEN = bool(getattr(sys, "frozen", False))

if os.environ.get("DATA_DIR"):
    DATA_DIR = Path(os.environ["DATA_DIR"]).resolve()
elif IS_FROZEN:
    DATA_DIR = (Path(sys.executable).resolve().parent / "puzzle_data").resolve()
else:
    DATA_DIR = Path("/app/data").resolve()

UPLOADS_DIR = (DATA_DIR / "uploads").resolve()
USER_DATA_FILE = (DATA_DIR / "user_data.json").resolve()

if os.environ.get("STATIC_DIR"):
    STATIC_DIR = Path(os.environ["STATIC_DIR"]).resolve()
elif IS_FROZEN and hasattr(sys, "_MEIPASS"):
    STATIC_DIR = (Path(getattr(sys, "_MEIPASS")) / "static").resolve()
else:
    STATIC_DIR = Path("/app/static").resolve()

ALLOWED_EXTENSIONS = {".puz", ".svg", ".json", ".txt"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB per puzzle file

_STORE_LOCK = threading.Lock()


def _ensure_storage() -> None:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    if not USER_DATA_FILE.exists():
        _write_store({"items": [], "logs": []})


def _read_store() -> Dict[str, Any]:
    _ensure_storage()
    try:
        raw = USER_DATA_FILE.read_text(encoding="utf-8")
        data = json.loads(raw)
        if isinstance(data, dict):
            return {
                "items": data.get("items", []) if isinstance(data.get("items"), list) else [],
                "logs": data.get("logs", []) if isinstance(data.get("logs"), list) else [],
            }
    except Exception:
        pass
    return {"items": [], "logs": []}


def _write_store(data: Dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp_path = USER_DATA_FILE.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.replace(tmp_path, USER_DATA_FILE)


def _sanitize_filename(name: str) -> str:
    base = os.path.basename(name or "upload.txt")
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", base).strip("._")
    return cleaned or f"upload_{int(time.time())}.txt"


def _safe_upload_path(stored_name: str) -> Path:
    candidate = (UPLOADS_DIR / stored_name).resolve()
    if not candidate.is_relative_to(UPLOADS_DIR):
        raise HTTPException(status_code=400, detail="Invalid upload path.")
    return candidate


class GenerateBookletRequest(BaseModel):
    specs: Dict[str, Any]
    blocks: Optional[List[Dict[str, Any]]] = None
    queue: Optional[List[Dict[str, Any]]] = None
    generationSeed: int = Field(default=202611)
    vaultItems: Optional[List[Dict[str, Any]]] = None


app = FastAPI(title="Puzzle Book Generator API", version="1.0.0")


@app.on_event("startup")
def on_startup() -> None:
    _ensure_storage()


@app.get("/api/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/api/vault")
def get_vault() -> Dict[str, Any]:
    with _STORE_LOCK:
        store = _read_store()
    return store


@app.post("/api/vault/upload")
async def upload_vault_file(file: UploadFile = File(...)) -> Dict[str, Any]:
    raw_name = file.filename or "puzzle.txt"
    safe_name = _sanitize_filename(raw_name)
    ext = Path(safe_name).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: .puz, .svg, .json, .txt",
        )

    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded file exceeds 5 MB limit.")

    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        parsed_item, sha256 = parse_uploaded_puzzle_bytes(raw_bytes, safe_name)
    except Exception as exc:
        log_entry = {
            "id": f"log_{uuid.uuid4().hex[:10]}",
            "filename": safe_name,
            "status": "rejected",
            "sha256": "0000000000000000",
            "duplicateOf": f"parse error ({exc})",
            "reason": str(exc),
            "timestamp": now_iso,
        }
        with _STORE_LOCK:
            store = _read_store()
            store["logs"] = [log_entry, *store["logs"]][:25]
            _write_store(store)
        return {"status": "rejected", "item": None, "log": log_entry}

    with _STORE_LOCK:
        store = _read_store()
        existing = next(
            (it for it in store["items"] if it.get("sha256") == sha256), None
        )
        if existing is not None:
            log_entry = {
                "id": f"log_{uuid.uuid4().hex[:10]}",
                "filename": safe_name,
                "status": "rejected",
                "sha256": sha256,
                "duplicateOf": existing.get("filename", "existing upload"),
                "reason": "Matches existing content hash",
                "timestamp": now_iso,
            }
            store["logs"] = [log_entry, *store["logs"]][:25]
            _write_store(store)
            return {"status": "rejected", "item": None, "log": log_entry}

        stored_name = f"{sha256[:12]}_{safe_name}"
        target_path = _safe_upload_path(stored_name)
        target_path.write_bytes(raw_bytes)

        item_id = f"upl_{uuid.uuid4().hex[:10]}"
        full_item = {
            **parsed_item,
            "id": item_id,
            "addedAt": now_iso,
            "storedFile": stored_name,
        }
        log_entry = {
            "id": f"log_{uuid.uuid4().hex[:10]}",
            "filename": safe_name,
            "status": "accepted",
            "sha256": sha256,
            "reason": parsed_item["summary"],
            "timestamp": now_iso,
        }

        store["items"] = [full_item, *store["items"]]
        store["logs"] = [log_entry, *store["logs"]][:25]
        _write_store(store)

    return {"status": "accepted", "item": full_item, "log": log_entry}


@app.delete("/api/vault/{item_id}")
def delete_vault_item(item_id: str) -> Dict[str, Any]:
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", item_id):
        raise HTTPException(status_code=400, detail="Invalid item id.")

    with _STORE_LOCK:
        store = _read_store()
        removed = [it for it in store["items"] if it.get("id") == item_id]
        store["items"] = [it for it in store["items"] if it.get("id") != item_id]
        _write_store(store)

    for it in removed:
        stored = it.get("storedFile")
        if isinstance(stored, str) and stored:
            try:
                p = _safe_upload_path(stored)
                if p.exists():
                    p.unlink()
            except Exception:
                pass

    return {"deleted": len(removed)}


@app.post("/api/vault/reset")
def reset_vault() -> Dict[str, str]:
    with _STORE_LOCK:
        store = _read_store()
        for it in store["items"]:
            stored = it.get("storedFile")
            if isinstance(stored, str) and stored:
                try:
                    p = _safe_upload_path(stored)
                    if p.exists():
                        p.unlink()
                except Exception:
                    pass
        _write_store({"items": [], "logs": []})
    return {"status": "ok"}


@app.post("/api/generate-booklet")
def generate_booklet_pdf(payload: GenerateBookletRequest) -> Response:
    blocks = payload.blocks if payload.blocks is not None else (payload.queue or [])
    if not blocks:
        raise HTTPException(status_code=400, detail="At least one game block is required.")

    with _STORE_LOCK:
        store = _read_store()
    persisted_items: List[Dict[str, Any]] = store["items"]

    # Merge persisted uploads with any client-provided vault items (deduped by sha256/id)
    merged_vault: List[Dict[str, Any]] = []
    seen_keys = set()
    for item in [*persisted_items, *(payload.vaultItems or [])]:
        key = item.get("sha256") or item.get("id")
        if key and key in seen_keys:
            continue
        if key:
            seen_keys.add(key)
        merged_vault.append(item)

    compilation = compile_booklet(
        specs=payload.specs,
        blocks=blocks,
        vault_items=merged_vault,
        generation_seed=payload.generationSeed,
    )
    pdf_bytes = generate_imposed_pdf_bytes(payload.specs, compilation)

    title = str(payload.specs.get("coverTitle") or "puzzle-booklet")
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "puzzle-booklet"
    total_pp = compilation["stats"]["paddedTotalPages"]
    download_name = f"{slug}-{total_pp}pp.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{download_name}"',
            "Cache-Control": "no-store",
        },
    )


# Mount compiled Vite static frontend after all /api routes
if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
