"""ReportLab US Letter Landscape Saddle-Stitch PDF Imposition Engine."""

from __future__ import annotations

import base64
import io
import math
import re
from typing import Any, Dict, List, Optional, Tuple

from reportlab.lib.colors import Color
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from .solvers import generate_puzzle_for_block

PT_PER_IN = 72.0
LETTER_W = 11.0 * PT_PER_IN  # 792 pt
LETTER_H = 8.5 * PT_PER_IN  # 612 pt

INK = Color(0.08, 0.08, 0.08)
INK_MUTED = Color(0.42, 0.42, 0.42)
INK_FAINT = Color(0.76, 0.76, 0.76)
ACCENT = Color(0.22, 0.22, 0.22)
WHITE_BG = Color(1.0, 1.0, 1.0)
KAKURO_BG = Color(0.16, 0.16, 0.15)
KAKURO_DIAG = Color(0.60, 0.59, 0.56)
DOT_COLOR = Color(0.76, 0.74, 0.70)
FILLER_DOT_COLOR = Color(0.58, 0.56, 0.52)
GRAPH_COLOR = Color(0.88, 0.87, 0.84)
TRACE_INK = Color(0.68, 0.66, 0.62, alpha=0.72)

GAME_SHORT_LABELS: Dict[str, str] = {
    "sudoku": "Sudoku",
    "kakuro": "Kakuro",
    "calcudoku": "Calcudoku",
    "crossword": "Crossword",
    "word-grid": "Word Grid",
    "line-art": "Ink Tracing",
}


# ---------- BOOKLET COMPILATION & IMPOSITION ORDERING ----------


def compile_booklet(
    specs: Dict[str, Any],
    blocks: List[Dict[str, Any]],
    vault_items: List[Dict[str, Any]],
    generation_seed: int = 202611,
) -> Dict[str, Any]:
    puzzle_pages: List[Dict[str, Any]] = []
    all_puzzles_with_meta: List[Dict[str, Any]] = []
    global_puzzle_num = 1

    for block in blocks:
        game_type = block.get("gameType", "sudoku")
        page_count = max(1, min(32, int(block.get("pageCount", 1))))
        per_page = (
            int(block.get("puzzlesPerPage", 1))
            if game_type in ("sudoku", "kakuro", "calcudoku")
            else 1
        )
        per_page = 2 if per_page >= 2 else 1

        block_puzzle_idx = 1
        for _ in range(page_count):
            page_puzzles: List[Dict[str, Any]] = []
            for _slot in range(per_page):
                puzzle = generate_puzzle_for_block(
                    block, block_puzzle_idx, vault_items, generation_seed
                )
                page_puzzles.append(puzzle)
                if puzzle.get("kind") != "line-art":
                    short_lbl = GAME_SHORT_LABELS.get(game_type, game_type.title())
                    all_puzzles_with_meta.append(
                        {
                            "puzzleNumber": global_puzzle_num,
                            "label": f"{short_lbl} #{global_puzzle_num}",
                            "puzzle": puzzle,
                        }
                    )
                global_puzzle_num += 1
                block_puzzle_idx += 1

            puzzle_pages.append(
                {
                    "pageNumber": 0,
                    "kind": "puzzle",
                    "blockId": block.get("id"),
                    "gameType": game_type,
                    "headerLabel": GAME_SHORT_LABELS.get(game_type, game_type.title()),
                    "puzzles": page_puzzles,
                }
            )

    answer_pages_list: List[Dict[str, Any]] = []
    if specs.get("includeAnswerKey", True) and all_puzzles_with_meta:
        for i in range(0, len(all_puzzles_with_meta), 4):
            answer_pages_list.append(
                {
                    "pageNumber": 0,
                    "kind": "answer-key",
                    "headerLabel": "Answer Key",
                    "answerEntries": all_puzzles_with_meta[i : i + 4],
                }
            )

    raw_pages = 1 + len(puzzle_pages) + len(answer_pages_list) + 1
    padded_total = max(4, math.ceil(raw_pages / 4) * 4)
    filler_count = padded_total - raw_pages

    filler_pages = [
        {"pageNumber": 0, "kind": "dot-grid-filler", "headerLabel": "Field Notes"}
        for _ in range(filler_count)
    ]

    ordered_pages: List[Dict[str, Any]] = [
        {
            "pageNumber": 1,
            "kind": "front-cover",
            "headerLabel": specs.get("coverTitle", "Puzzle Book Generator"),
        },
        *puzzle_pages,
        *answer_pages_list,
        *filler_pages,
        {"pageNumber": padded_total, "kind": "back-cover", "headerLabel": "Colophon"},
    ]
    for idx, pg in enumerate(ordered_pages):
        pg["pageNumber"] = idx + 1

    logical_spreads_count = padded_total // 4
    logical_front: List[Dict[str, Any]] = []
    logical_back: List[Dict[str, Any]] = []

    for s in range(logical_spreads_count):
        f_left = ordered_pages[padded_total - 1 - 2 * s]
        f_right = ordered_pages[2 * s]
        b_left = ordered_pages[2 * s + 1]
        b_right = ordered_pages[padded_total - 2 - 2 * s]
        logical_front.append({"leftPage": f_left, "rightPage": f_right})
        logical_back.append({"leftPage": b_left, "rightPage": b_right})

    panels_per_side = int(specs.get("panelsPerSheetSide", 2))
    sheets: List[Dict[str, Any]] = []
    if panels_per_side == 4:
        physical_count = math.ceil(logical_spreads_count / 2)
        for k in range(physical_count):
            i1, i2 = 2 * k, 2 * k + 1
            front_sp = [logical_front[i1]]
            back_sp = [logical_back[i1]]
            if i2 < logical_spreads_count:
                front_sp.append(logical_front[i2])
                back_sp.append(logical_back[i2])
            sheets.append(
                {"sheetNumber": k + 1, "frontSpreads": front_sp, "backSpreads": back_sp}
            )
    else:
        for s in range(logical_spreads_count):
            sheets.append(
                {
                    "sheetNumber": s + 1,
                    "frontSpreads": [logical_front[s]],
                    "backSpreads": [logical_back[s]],
                }
            )

    stats = {
        "coverPages": 1,
        "puzzlePages": len(puzzle_pages),
        "totalPuzzles": len(all_puzzles_with_meta)
        + sum(1 for p in puzzle_pages if p.get("gameType") == "line-art"),
        "answerPages": len(answer_pages_list),
        "backCoverPages": 1,
        "rawPages": raw_pages,
        "paddedTotalPages": padded_total,
        "fillerPages": filler_count,
        "duplexSheets": len(sheets),
        "panelsPerSheetSide": panels_per_side,
    }

    return {"pages": ordered_pages, "sheets": sheets, "stats": stats}


# ---------- SVG PATH CONVERTER FOR REPORTLAB ----------

_SVG_CMD_RE = re.compile(
    r"([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)"
)


def _tokenize_svg_path(d: str) -> List[Any]:
    tokens: List[Any] = []
    for match in _SVG_CMD_RE.finditer(d):
        cmd, num = match.groups()
        if cmd is not None:
            tokens.append(cmd)
        elif num is not None:
            tokens.append(float(num))
    return tokens


def _arc_to_cubic_beziers(
    x0: float,
    y0: float,
    rx: float,
    ry: float,
    phi_deg: float,
    large_arc: int,
    sweep: int,
    x: float,
    y: float,
) -> List[Tuple[float, float, float, float, float, float]]:
    """Convert SVG endpoint elliptical arc to cubic Bezier segments in SVG coordinates."""
    if x0 == x and y0 == y:
        return []
    rx = abs(rx)
    ry = abs(ry)
    if rx == 0 or ry == 0:
        return [(x0, y0, x, y, x, y)]

    phi = math.radians(phi_deg % 360.0)
    cos_p, sin_p = math.cos(phi), math.sin(phi)
    dx2 = (x0 - x) / 2.0
    dy2 = (y0 - y) / 2.0
    x1p = cos_p * dx2 + sin_p * dy2
    y1p = -sin_p * dx2 + cos_p * dy2

    rx_sq, ry_sq = rx * rx, ry * ry
    x1p_sq, y1p_sq = x1p * x1p, y1p * y1p

    radii_check = x1p_sq / rx_sq + y1p_sq / ry_sq
    if radii_check > 1.0:
        scale_r = math.sqrt(radii_check)
        rx *= scale_r
        ry *= scale_r
        rx_sq, ry_sq = rx * rx, ry * ry

    sign = -1.0 if large_arc == sweep else 1.0
    num = max(0.0, rx_sq * ry_sq - rx_sq * y1p_sq - ry_sq * x1p_sq)
    den = rx_sq * y1p_sq + ry_sq * x1p_sq
    coef = sign * math.sqrt(num / den) if den > 1e-12 else 0.0
    cxp = coef * ((rx * y1p) / ry)
    cyp = coef * (-(ry * x1p) / rx)

    cx = cos_p * cxp - sin_p * cyp + (x0 + x) / 2.0
    cy = sin_p * cxp + cos_p * cyp + (y0 + y) / 2.0

    def vec_angle(ux: float, uy: float, vx: float, vy: float) -> float:
        dot = ux * vx + uy * vy
        mag = math.hypot(ux, uy) * math.hypot(vx, vy)
        ratio = max(-1.0, min(1.0, dot / mag)) if mag > 1e-12 else 1.0
        ang = math.acos(ratio)
        return -ang if (ux * vy - uy * vx) < 0 else ang

    ux, uy = (x1p - cxp) / rx, (y1p - cyp) / ry
    vx, vy = (-x1p - cxp) / rx, (-y1p - cyp) / ry
    theta1 = vec_angle(1.0, 0.0, ux, uy)
    dtheta = vec_angle(ux, uy, vx, vy)

    if sweep == 0 and dtheta > 0:
        dtheta -= 2.0 * math.pi
    elif sweep == 1 and dtheta < 0:
        dtheta += 2.0 * math.pi

    segs = max(1, int(math.ceil(abs(dtheta) / (math.pi / 2.0))))
    delta = dtheta / segs
    t = (4.0 / 3.0) * math.tan(delta / 4.0)

    beziers: List[Tuple[float, float, float, float, float, float]] = []
    for i in range(segs):
        t1 = theta1 + i * delta
        t2 = t1 + delta
        c1, s1 = math.cos(t1), math.sin(t1)
        c2, s2 = math.cos(t2), math.sin(t2)

        ep1x, ep1y = c1 - t * s1, s1 + t * c1
        ep2x, ep2y = c2 + t * s2, s2 - t * c2
        epx, epy = c2, s2

        def map_pt(px: float, py: float) -> Tuple[float, float]:
            sx = rx * px
            sy = ry * py
            return (cos_p * sx - sin_p * sy + cx, sin_p * sx + cos_p * sy + cy)

        b1 = map_pt(ep1x, ep1y)
        b2 = map_pt(ep2x, ep2y)
        b3 = map_pt(epx, epy)
        beziers.append((b1[0], b1[1], b2[0], b2[1], b3[0], b3[1]))

    return beziers


def _draw_svg_path(
    c: canvas.Canvas, d: str, ox: float, top_y: float, scale: float
) -> None:
    tokens = _tokenize_svg_path(d)
    if not tokens:
        return

    def pt(sx: float, sy: float) -> Tuple[float, float]:
        return (ox + sx * scale, top_y - sy * scale)

    path = c.beginPath()
    idx = 0
    n = len(tokens)
    cmd = ""
    cx, cy = 0.0, 0.0
    sx0, sy0 = 0.0, 0.0
    last_ctrl_x, last_ctrl_y = 0.0, 0.0
    last_cmd = ""

    def next_num() -> float:
        nonlocal idx
        val = float(tokens[idx])
        idx += 1
        return val

    def has_num() -> bool:
        return idx < n and isinstance(tokens[idx], (int, float))

    while idx < n:
        if isinstance(tokens[idx], str):
            cmd = tokens[idx]
            idx += 1
        elif not cmd:
            break

        if cmd in ("Z", "z"):
            path.close()
            cx, cy = sx0, sy0
            last_cmd = cmd
            cmd = ""
            continue

        if cmd in ("M", "m"):
            first = True
            while has_num():
                nx, ny = next_num(), next_num()
                if cmd == "m":
                    nx += cx
                    ny += cy
                px, py = pt(nx, ny)
                if first:
                    path.moveTo(px, py)
                    sx0, sy0 = nx, ny
                    first = False
                else:
                    path.lineTo(px, py)
                cx, cy = nx, ny
                last_cmd = cmd
                # Subsequent pairs after M/m are treated as implicit L/l
                if cmd == "M":
                    cmd = "L"
                elif cmd == "m":
                    cmd = "l"
            continue

        while has_num():
            if cmd in ("L", "l"):
                nx, ny = next_num(), next_num()
                if cmd == "l":
                    nx += cx
                    ny += cy
                path.lineTo(*pt(nx, ny))
                cx, cy = nx, ny
                last_cmd = cmd
            elif cmd in ("H", "h"):
                nx = next_num()
                if cmd == "h":
                    nx += cx
                path.lineTo(*pt(nx, cy))
                cx = nx
                last_cmd = cmd
            elif cmd in ("V", "v"):
                ny = next_num()
                if cmd == "v":
                    ny += cy
                path.lineTo(*pt(cx, ny))
                cy = ny
                last_cmd = cmd
            elif cmd in ("C", "c"):
                x1, y1, x2, y2, nx, ny = (
                    next_num(),
                    next_num(),
                    next_num(),
                    next_num(),
                    next_num(),
                    next_num(),
                )
                if cmd == "c":
                    x1, y1 = cx + x1, cy + y1
                    x2, y2 = cx + x2, cy + y2
                    nx, ny = cx + nx, cy + ny
                p1, p2, p3 = pt(x1, y1), pt(x2, y2), pt(nx, ny)
                path.curveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1])
                last_ctrl_x, last_ctrl_y = x2, y2
                cx, cy = nx, ny
                last_cmd = cmd
            elif cmd in ("S", "s"):
                x2, y2, nx, ny = next_num(), next_num(), next_num(), next_num()
                if last_cmd in ("C", "c", "S", "s"):
                    x1, y1 = 2 * cx - last_ctrl_x, 2 * cy - last_ctrl_y
                else:
                    x1, y1 = cx, cy
                if cmd == "s":
                    x2, y2 = cx + x2, cy + y2
                    nx, ny = cx + nx, cy + ny
                p1, p2, p3 = pt(x1, y1), pt(x2, y2), pt(nx, ny)
                path.curveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1])
                last_ctrl_x, last_ctrl_y = x2, y2
                cx, cy = nx, ny
                last_cmd = cmd
            elif cmd in ("Q", "q"):
                qx, qy, nx, ny = next_num(), next_num(), next_num(), next_num()
                if cmd == "q":
                    qx, qy = cx + qx, cy + qy
                    nx, ny = cx + nx, cy + ny
                x1 = cx + (2.0 / 3.0) * (qx - cx)
                y1 = cy + (2.0 / 3.0) * (qy - cy)
                x2 = nx + (2.0 / 3.0) * (qx - nx)
                y2 = ny + (2.0 / 3.0) * (qy - ny)
                p1, p2, p3 = pt(x1, y1), pt(x2, y2), pt(nx, ny)
                path.curveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1])
                last_ctrl_x, last_ctrl_y = qx, qy
                cx, cy = nx, ny
                last_cmd = cmd
            elif cmd in ("T", "t"):
                nx, ny = next_num(), next_num()
                if last_cmd in ("Q", "q", "T", "t"):
                    qx, qy = 2 * cx - last_ctrl_x, 2 * cy - last_ctrl_y
                else:
                    qx, qy = cx, cy
                if cmd == "t":
                    nx, ny = cx + nx, cy + ny
                x1 = cx + (2.0 / 3.0) * (qx - cx)
                y1 = cy + (2.0 / 3.0) * (qy - cy)
                x2 = nx + (2.0 / 3.0) * (qx - nx)
                y2 = ny + (2.0 / 3.0) * (qy - ny)
                p1, p2, p3 = pt(x1, y1), pt(x2, y2), pt(nx, ny)
                path.curveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1])
                last_ctrl_x, last_ctrl_y = qx, qy
                cx, cy = nx, ny
                last_cmd = cmd
            elif cmd in ("A", "a"):
                rx, ry, rot = next_num(), next_num(), next_num()
                large_arc, sweep = int(next_num()), int(next_num())
                nx, ny = next_num(), next_num()
                if cmd == "a":
                    nx += cx
                    ny += cy
                for b in _arc_to_cubic_beziers(
                    cx, cy, rx, ry, rot, large_arc, sweep, nx, ny
                ):
                    p1, p2, p3 = pt(b[0], b[1]), pt(b[2], b[3]), pt(b[4], b[5])
                    path.curveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1])
                cx, cy = nx, ny
                last_cmd = cmd
            else:
                break

    c.drawPath(path, stroke=1, fill=0)


# ---------- CANVAS DRAWING PRIMITIVES ----------


def _draw_paper_background(
    c: canvas.Canvas, x: float, y: float, w: float, h: float, style: str
) -> None:
    c.saveState()
    c.setFillColor(WHITE_BG)
    c.rect(x, y, w, h, stroke=0, fill=1)

    step = 14.0
    if style == "dot-grid":
        c.setFillColor(DOT_COLOR)
        gx = x + step
        while gx < x + w - 4:
            gy = y + step
            while gy < y + h - 4:
                c.circle(gx, gy, 0.6, stroke=0, fill=1)
                gy += step
            gx += step
    elif style == "graph-grid":
        c.setStrokeColor(GRAPH_COLOR)
        c.setLineWidth(0.3)
        gx = x + step
        while gx < x + w - 2:
            c.line(gx, y + 4, gx, y + h - 4)
            gx += step
        gy = y + step
        while gy < y + h - 2:
            c.line(x + 4, gy, x + w - 4, gy)
            gy += step
    c.restoreState()


def _draw_crop_marks(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    offset: float = 4.0,
    length: float = 10.0,
    top_len: Optional[float] = None,
    bot_len: Optional[float] = None,
    top_offset: Optional[float] = None,
    bot_offset: Optional[float] = None,
) -> None:
    t_off = offset if top_offset is None else top_offset
    b_off = offset if bot_offset is None else bot_offset
    t_len = length if top_len is None else top_len
    b_len = length if bot_len is None else bot_len

    c.saveState()
    c.setStrokeColor(Color(0.25, 0.25, 0.25))
    c.setLineWidth(0.5)
    # Bottom-left
    c.line(x - offset - length, y, x - offset, y)
    c.line(x, y - b_off - b_len, x, y - b_off)
    # Bottom-right
    c.line(x + w + offset, y, x + w + offset + length, y)
    c.line(x + w, y - b_off - b_len, x + w, y - b_off)
    # Top-left
    c.line(x - offset - length, y + h, x - offset, y + h)
    c.line(x, y + h + t_off, x, y + h + t_off + t_len)
    # Top-right
    c.line(x + w + offset, y + h, x + w + offset + length, y + h)
    c.line(x + w, y + h + t_off, x + w, y + h + t_off + t_len)
    c.restoreState()


def _draw_center_fold_line(
    c: canvas.Canvas, x: float, y: float, h: float, ext: float = 6.0
) -> None:
    c.saveState()
    c.setStrokeColor(ACCENT)
    c.setLineWidth(0.6)
    c.setDash(4, 4)
    c.line(x, y - ext, x, y + h + ext)
    c.restoreState()


# ---------- PUZZLE RENDERERS ----------


def _draw_sudoku(
    c: canvas.Canvas,
    data: Dict[str, Any],
    x: float,
    y: float,
    size: float,
    show_solution: bool = False,
) -> None:
    cell = size / 9.0
    grid = data["solution"] if show_solution else data["puzzle"]
    puzzle_givens = data["puzzle"]

    c.saveState()
    for r in range(9):
        for col in range(9):
            val = grid[r][col]
            if val > 0:
                is_given = puzzle_givens[r][col] > 0
                txt = str(val)
                fs = max(6.0, cell * 0.56)
                font_name = "Helvetica-Bold" if is_given else "Courier"
                c.setFont(font_name, fs)
                c.setFillColor(INK if is_given else ACCENT)
                tw = c.stringWidth(txt, font_name, fs)
                c.drawString(
                    x + col * cell + (cell - tw) / 2.0,
                    y + size - (r + 1) * cell + (cell - fs) * 0.36,
                    txt,
                )

    for i in range(10):
        thick = 1.25 if i % 3 == 0 else 0.35
        c.setLineWidth(thick)
        c.setStrokeColor(INK if i % 3 == 0 else INK_MUTED)
        c.line(x + i * cell, y, x + i * cell, y + size)
        c.line(x, y + i * cell, x + size, y + i * cell)
    c.restoreState()


def _draw_kakuro(
    c: canvas.Canvas,
    data: Dict[str, Any],
    x: float,
    y: float,
    size: float,
    show_solution: bool = False,
) -> None:
    n = int(data["size"])
    cell = size / n
    grid = data["grid"]

    c.saveState()
    for r in range(n):
        for col in range(n):
            item = grid[r][col]
            cx = x + col * cell
            cy = y + size - (r + 1) * cell
            ctype = item.get("type")

            if ctype in ("black", "clue"):
                c.setFillColor(KAKURO_BG)
                c.rect(cx, cy, cell, cell, stroke=0, fill=1)

            if ctype == "clue":
                c.setStrokeColor(KAKURO_DIAG)
                c.setLineWidth(0.45)
                c.line(cx, cy + cell, cx + cell, cy)
                fs = max(5.0, cell * 0.28)
                c.setFont("Courier", fs)
                c.setFillColor(WHITE_BG)
                if item.get("acrossSum"):
                    c.drawString(cx + cell * 0.52, cy + cell * 0.58, str(item["acrossSum"]))
                if item.get("downSum"):
                    c.drawString(cx + cell * 0.12, cy + cell * 0.14, str(item["downSum"]))
            elif ctype == "empty" and show_solution and item.get("solution"):
                txt = str(item["solution"])
                fs = max(6.0, cell * 0.52)
                c.setFont("Courier", fs)
                c.setFillColor(ACCENT)
                tw = c.stringWidth(txt, "Courier", fs)
                c.drawString(cx + (cell - tw) / 2.0, cy + (cell - fs) * 0.36, txt)

            c.setStrokeColor(INK)
            c.setLineWidth(0.5)
            c.rect(cx, cy, cell, cell, stroke=1, fill=0)
    c.restoreState()


def _draw_calcudoku(
    c: canvas.Canvas,
    data: Dict[str, Any],
    x: float,
    y: float,
    size: float,
    show_solution: bool = False,
) -> None:
    n = int(data["size"])
    cell = size / n
    cage_map = [[0] * n for _ in range(n)]
    for cage in data["cages"]:
        for r, col in cage["cells"]:
            cage_map[r][col] = cage["id"]

    c.saveState()
    c.setStrokeColor(INK_FAINT)
    c.setLineWidth(0.35)
    for i in range(n + 1):
        c.line(x + i * cell, y, x + i * cell, y + size)
        c.line(x, y + i * cell, x + size, y + i * cell)

    c.setFillColor(INK)
    for cage in data["cages"]:
        sorted_cells = sorted(cage["cells"], key=lambda rc: (rc[0], rc[1]))
        top_r, top_c = sorted_cells[0]
        label = f"{cage['target']}{cage['op']}"
        fs = max(5.0, cell * 0.26)
        c.setFont("Courier", fs)
        c.drawString(x + top_c * cell + 2.0, y + size - top_r * cell - fs - 1.5, label)

    c.setStrokeColor(INK)
    c.setLineWidth(1.2)
    for r in range(n):
        for col in range(n):
            cx = x + col * cell
            cy = y + size - (r + 1) * cell
            cid = cage_map[r][col]
            if r == 0 or cage_map[r - 1][col] != cid:
                c.line(cx, cy + cell, cx + cell, cy + cell)
            if r == n - 1 or cage_map[r + 1][col] != cid:
                c.line(cx, cy, cx + cell, cy)
            if col == 0 or cage_map[r][col - 1] != cid:
                c.line(cx, cy, cx, cy + cell)
            if col == n - 1 or cage_map[r][col + 1] != cid:
                c.line(cx + cell, cy, cx + cell, cy + cell)

            if show_solution:
                txt = str(data["solution"][r][col])
                fs = max(6.0, cell * 0.45)
                c.setFont("Courier", fs)
                c.setFillColor(ACCENT)
                tw = c.stringWidth(txt, "Courier", fs)
                c.drawString(cx + (cell - tw) / 2.0, cy + cell * 0.16, txt)
    c.restoreState()


def _draw_crossword(
    c: canvas.Canvas,
    data: Dict[str, Any],
    x: float,
    y: float,
    w: float,
    h: float,
    show_solution: bool = False,
) -> None:
    cw = data["data"]
    width = int(cw["width"])
    height = int(cw["height"])
    sol_grid = cw["solutionGrid"]

    max_grid = min(w, h) if show_solution else min(w, h * 0.52)
    cell = min(max_grid / width, max_grid / height)
    grid_w = cell * width
    grid_h = cell * height
    gx = x + (w - grid_w) / 2.0
    gy = y + h - grid_h

    c.saveState()
    num = 1
    for r in range(height):
        for col in range(width):
            ch = sol_grid[r][col]
            cx = gx + col * cell
            cy = gy + grid_h - (r + 1) * cell
            if ch == ".":
                c.setFillColor(INK)
                c.rect(cx, cy, cell, cell, stroke=0, fill=1)
            else:
                c.setStrokeColor(INK)
                c.setLineWidth(0.6)
                c.rect(cx, cy, cell, cell, stroke=1, fill=0)

                starts_a = (
                    (col == 0 or sol_grid[r][col - 1] == ".")
                    and col + 1 < width
                    and sol_grid[r][col + 1] != "."
                )
                starts_d = (
                    (r == 0 or sol_grid[r - 1][col] == ".")
                    and r + 1 < height
                    and sol_grid[r + 1][col] != "."
                )
                if starts_a or starts_d:
                    if not show_solution:
                        nfs = max(4.5, cell * 0.25)
                        c.setFont("Courier", nfs)
                        c.setFillColor(INK_MUTED)
                        c.drawString(cx + 1.5, cy + cell - nfs - 1.0, str(num))
                    num += 1

                if show_solution:
                    fs = max(5.5, cell * 0.52)
                    c.setFont("Courier", fs)
                    c.setFillColor(ACCENT)
                    tw = c.stringWidth(ch, "Courier", fs)
                    c.drawString(cx + (cell - tw) / 2.0, cy + (cell - fs) * 0.35, ch)

    if not show_solution:
        clue_y = gy - 12.0
        clue_fs = max(5.5, min(7.2, w / 34.0))
        col_w = (w - 8.0) / 2.0

        def draw_col(heading: str, items: List[Dict[str, Any]], col_x: float) -> None:
            cy = clue_y
            c.setFont("Helvetica-Bold", clue_fs + 0.5)
            c.setFillColor(ACCENT)
            c.drawString(col_x, cy, heading)
            cy -= clue_fs + 4.0
            c.setFont("Helvetica", clue_fs)
            c.setFillColor(INK)
            for item in items[:8]:
                if cy < y + 4.0:
                    break
                line = f"{item['number']}. {item['clue']}"[:32]
                c.drawString(col_x, cy, line)
                cy -= clue_fs + 3.0

        draw_col("ACROSS", cw.get("acrossClues", []), x)
        draw_col("DOWN", cw.get("downClues", []), x + col_w + 8.0)
    c.restoreState()


def _draw_word_grid(
    c: canvas.Canvas,
    data: Dict[str, Any],
    x: float,
    y: float,
    w: float,
    h: float,
    show_solution: bool = False,
) -> None:
    c.saveState()
    if show_solution:
        n = int(data["gridSize"])
        cell = min(w, h) / n
        gx = x + (w - cell * n) / 2.0
        gy = y + (h - cell * n) / 2.0
        sol_grid = data["sampleSolutionGrid"]
        for r in range(n):
            for col in range(n):
                ch = sol_grid[r][col]
                if not ch:
                    continue
                cx = gx + col * cell
                cy = gy + cell * n - (r + 1) * cell
                c.setStrokeColor(INK)
                c.setLineWidth(0.5)
                c.rect(cx, cy, cell, cell, stroke=1, fill=0)
                fs = max(5.5, cell * 0.52)
                c.setFont("Courier", fs)
                c.setFillColor(ACCENT)
                c.drawString(cx + cell * 0.28, cy + (cell - fs) * 0.35, ch)
        c.restoreState()
        return

    cols = 7
    tile_size = min(20.0, (w - 12.0) / cols)
    rack_w = cols * tile_size
    rx = x + (w - rack_w) / 2.0
    ry = y + h - tile_size - 2.0

    tiles = data.get("tiles", [])[:21]
    for idx, letter in enumerate(tiles):
        col = idx % cols
        row = idx // cols
        tx = rx + col * tile_size
        ty = ry - row * (tile_size + 3.0)
        c.setFillColor(WHITE_BG)
        c.setStrokeColor(INK)
        c.setLineWidth(0.7)
        c.rect(tx + 1.0, ty, tile_size - 2.0, tile_size - 2.0, stroke=1, fill=1)
        fs = tile_size * 0.5
        c.setFont("Courier", fs)
        c.setFillColor(INK)
        tw = c.stringWidth(letter, "Courier", fs)
        c.drawString(tx + (tile_size - tw) / 2.0, ty + (tile_size - fs) * 0.35, letter)

    rows_used = math.ceil(len(tiles) / cols) if tiles else 1
    grid_top = ry - rows_used * (tile_size + 3.0) - 6.0
    avail_h = grid_top - y - 4.0
    n = 8
    cell = max(4.0, min(w / n, avail_h / n))
    gx = x + (w - cell * n) / 2.0
    gy = grid_top - cell * n

    c.setStrokeColor(INK_FAINT)
    c.setLineWidth(0.35)
    for i in range(n + 1):
        c.line(gx + i * cell, gy, gx + i * cell, gy + cell * n)
        c.line(gx, gy + i * cell, gx + cell * n, gy + i * cell)
    c.restoreState()


def _draw_line_art(
    c: canvas.Canvas, data: Dict[str, Any], x: float, y: float, w: float, h: float
) -> None:
    caption_h = 18.0
    avail_h = max(24.0, h - caption_h)
    box = min(w, avail_h)
    ox = x + (w - box) / 2.0
    top_y = y + h - (avail_h - box) / 2.0
    vb = float(data.get("viewBoxSize") or 100.0)
    scale = box / vb
    thickness = 0.9 if data.get("lineWeight") == "Medium" else 0.5

    c.saveState()
    c.setStrokeColor(TRACE_INK)
    c.setLineWidth(thickness)
    if data.get("tracingLineStyle") == "faint-dashed":
        c.setDash(2.2, 2.0)

    for path_str in data.get("paths", []):
        _draw_svg_path(c, path_str, ox, top_y, scale)

    c.setDash()
    c.setFillColor(INK_MUTED)
    c.setFont("Times-Roman", 6.0)
    c.drawString(x, y + 8.0, str(data.get("title", ""))[:40])
    c.setFont("Helvetica", 5.0)
    c.drawString(x, y + 1.0, str(data.get("attribution", ""))[:52])
    c.restoreState()


def _draw_rendered_puzzle(
    c: canvas.Canvas,
    puzzle: Dict[str, Any],
    x: float,
    y: float,
    w: float,
    h: float,
    show_solution: bool = False,
) -> None:
    kind = puzzle.get("kind")
    if kind == "sudoku":
        s = min(w, h)
        _draw_sudoku(c, puzzle, x + (w - s) / 2.0, y + (h - s) / 2.0, s, show_solution)
    elif kind == "kakuro":
        s = min(w, h)
        _draw_kakuro(c, puzzle, x + (w - s) / 2.0, y + (h - s) / 2.0, s, show_solution)
    elif kind == "calcudoku":
        s = min(w, h)
        _draw_calcudoku(c, puzzle, x + (w - s) / 2.0, y + (h - s) / 2.0, s, show_solution)
    elif kind == "crossword":
        _draw_crossword(c, puzzle, x, y, w, h, show_solution)
    elif kind == "word-grid":
        _draw_word_grid(c, puzzle, x, y, w, h, show_solution)
    elif kind == "line-art":
        _draw_line_art(c, puzzle, x, y, w, h)


# ---------- PAGE & SPREAD COMPOSER ----------


def _decode_cover_image(specs: Dict[str, Any]) -> Optional[ImageReader]:
    cover_img = specs.get("coverImage")
    if not isinstance(cover_img, dict):
        return None
    data_url = cover_img.get("dataUrl")
    if not isinstance(data_url, str) or ";base64," not in data_url:
        return None
    try:
        _, b64 = data_url.split(";base64,", 1)
        raw = base64.b64decode(b64)
        return ImageReader(io.BytesIO(raw))
    except Exception:
        return None


def _draw_booklet_page(
    c: canvas.Canvas,
    page: Dict[str, Any],
    x: float,
    y: float,
    w: float,
    h: float,
    specs: Dict[str, Any],
    compilation: Dict[str, Any],
    cover_image_reader: Optional[ImageReader],
) -> None:
    paper_style = specs.get("paperStyle", "clean-white")
    _draw_paper_background(c, x, y, w, h, paper_style)

    margin_in = float(specs.get("marginIn", 0.25))
    margin = max(10.0, min(margin_in * PT_PER_IN, w * 0.14))
    ix = x + margin
    iy = y + margin
    iw = w - margin * 2.0
    ih = h - margin * 2.0
    kind = page.get("kind")

    c.saveState()
    if kind == "front-cover":
        c.setStrokeColor(INK)
        c.setLineWidth(1.0)
        c.rect(ix, iy, iw, ih, stroke=1, fill=0)

        c.setStrokeColor(INK_FAINT)
        c.setLineWidth(0.4)
        c.rect(ix + 4, iy + 4, iw - 8, ih - 8, stroke=1, fill=0)

        edition = str(specs.get("editionString") or "Pocket Edition").upper()
        c.setFont("Courier", 6.5)
        c.setFillColor(INK_MUTED)
        c.drawString(ix + 14, iy + ih - 24, edition)

        cover_title = str(specs.get("coverTitle") or "Puzzle Book Generator")
        title_size = min(20.0, max(13.0, w / 14.0))
        lines: List[str] = []
        current = ""
        for word in cover_title.split(" "):
            test = f"{current} {word}" if current else word
            if c.stringWidth(test, "Times-Bold", title_size) > iw - 28 and current:
                lines.append(current)
                current = word
            else:
                current = test
        if current:
            lines.append(current)

        ty = iy + ih * 0.68
        c.setFont("Times-Bold", title_size)
        c.setFillColor(INK)
        for line in lines[:4]:
            c.drawString(ix + 14, ty, line)
            ty -= title_size * 1.18

        subtitle = specs.get("coverSubtitle")
        if subtitle:
            c.setFont("Helvetica", 8.5)
            c.setFillColor(INK_MUTED)
            c.drawString(ix + 14, ty - 6, str(subtitle)[:44])

        if cover_image_reader is not None:
            img_w, img_h = cover_image_reader.getSize()
            max_box_w = max(24.0, iw - 28.0)
            max_box_h = max(24.0, ih * 0.34)
            scale = min(max_box_w / max(1, img_w), max_box_h / max(1, img_h))
            draw_w = img_w * scale
            draw_h = img_h * scale
            cx = ix + (iw - draw_w) / 2.0
            cy = max(iy + 26.0, iy + ih * 0.31 - draw_h / 2.0)
            c.drawImage(
                cover_image_reader,
                cx,
                cy,
                width=draw_w,
                height=draw_h,
                preserveAspectRatio=True,
                mask="auto",
            )
        else:
            cx = ix + iw / 2.0
            cy = iy + ih * 0.28
            r = min(iw, ih) * 0.14
            c.setStrokeColor(ACCENT)
            c.setLineWidth(0.9)
            c.rect(cx - r, cy - r, r * 2.0, r * 2.0, stroke=1, fill=0)
            c.setStrokeColor(INK)
            c.setLineWidth(0.7)
            c.circle(cx, cy, r * 0.62, stroke=1, fill=0)

        width_in = float(specs.get("widthIn", 3.5))
        height_in = float(specs.get("heightIn", 5.5))
        total_pp = compilation["stats"]["paddedTotalPages"]
        footer_str = f'{width_in:.2f}" x {height_in:.2f}" · {total_pp} PAGES'
        c.setFont("Courier", 6.5)
        c.setFillColor(INK_MUTED)
        c.drawString(ix + 14, iy + 14, footer_str)
        c.restoreState()
        return

    if kind == "back-cover":
        stats = compilation["stats"]
        c.setFont("Courier", 8.0)
        c.setFillColor(INK)
        c.drawString(ix + 8, iy + ih * 0.55, "PUZZLE BOOK GENERATOR")

        c.setFont("Helvetica", 6.5)
        c.setFillColor(INK_MUTED)
        c.drawString(
            ix + 8,
            iy + ih * 0.55 - 14,
            f"Booklet: {stats['paddedTotalPages']} pp · {stats['duplexSheets']} US Letter sheets",
        )
        c.drawString(
            ix + 8,
            iy + ih * 0.55 - 26,
            f"Edition: {specs.get('editionString') or 'Standard'}",
        )
        c.setFont("Courier", 6.5)
        c.drawString(ix + iw - 22, iy + 4, f"p.{page['pageNumber']}")
        c.restoreState()
        return

    # Interior Header & Footer
    c.setFont("Courier", 6.5)
    c.setFillColor(INK_MUTED)
    c.drawString(ix, iy + ih - 8, str(page.get("headerLabel") or "").upper())

    c.setStrokeColor(INK_FAINT)
    c.setLineWidth(0.4)
    c.line(ix, iy + ih - 12, ix + iw, iy + ih - 12)

    pg_str = str(page["pageNumber"])
    pg_w = c.stringWidth(pg_str, "Courier", 6.5)
    c.drawString(ix + (iw - pg_w) / 2.0, iy + 2, pg_str)
    c.restoreState()

    body_x = ix
    body_y = iy + 12.0
    body_w = iw
    body_h = ih - 28.0

    if kind == "dot-grid-filler":
        c.saveState()
        c.setFillColor(FILLER_DOT_COLOR)
        step = 13.0
        dx = body_x + 6.0
        while dx < body_x + body_w - 4.0:
            dy = body_y + 6.0
            while dy < body_y + body_h - 4.0:
                c.circle(dx, dy, 0.65, stroke=0, fill=1)
                dy += step
            dx += step
        c.restoreState()
        return

    if kind == "answer-key" and page.get("answerEntries"):
        entries = page["answerEntries"]
        slot_w = (body_w - 8.0) / 2.0
        slot_h = (body_h - 8.0) / 2.0
        for idx, entry in enumerate(entries):
            col = idx % 2
            row = idx // 2
            sx = body_x + col * (slot_w + 8.0)
            sy = body_y + body_h - (row + 1) * slot_h - row * 8.0
            c.saveState()
            c.setFont("Courier", 6.0)
            c.setFillColor(INK)
            c.drawString(sx, sy + slot_h - 8.0, entry["label"])
            c.restoreState()
            _draw_rendered_puzzle(
                c, entry["puzzle"], sx, sy, slot_w, slot_h - 12.0, show_solution=True
            )
        return

    if kind == "puzzle" and page.get("puzzles"):
        items = page["puzzles"]
        if len(items) == 1:
            _draw_rendered_puzzle(c, items[0], body_x, body_y, body_w, body_h, False)
        else:
            gap = 10.0
            slot_h = (body_h - gap) / 2.0
            _draw_rendered_puzzle(
                c, items[0], body_x, body_y + slot_h + gap, body_w, slot_h, False
            )
            _draw_rendered_puzzle(c, items[1], body_x, body_y, body_w, slot_h, False)


def generate_imposed_pdf_bytes(
    specs: Dict[str, Any], compilation: Dict[str, Any]
) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(LETTER_W, LETTER_H))
    c.setTitle(str(specs.get("coverTitle") or "Puzzle Book Generator Booklet"))
    c.setCreator("Puzzle Book Generator")

    cover_reader = _decode_cover_image(specs)
    width_in = float(specs.get("widthIn", 3.5))
    height_in = float(specs.get("heightIn", 5.5))
    panels_per_side = int(specs.get("panelsPerSheetSide", 2))
    crop_marks = bool(specs.get("cropMarks", True))
    fold_guides = bool(specs.get("centerFoldGuides", True))

    raw_panel_w = width_in * PT_PER_IN
    raw_panel_h = height_in * PT_PER_IN

    for sheet in compilation["sheets"]:
        for side_label, spreads in (
            ("FRONT", sheet["frontSpreads"]),
            ("BACK", sheet["backSpreads"]),
        ):
            # Quiet sheet engineering slug along top margin
            c.saveState()
            c.setFont("Courier", 6.5)
            c.setFillColor(INK_MUTED)
            c.drawString(
                18.0,
                LETTER_H - 13.0,
                f'SHEET {sheet["sheetNumber"]} · {side_label} · {width_in:.2f}"x{height_in:.2f}" · {panels_per_side}-UP SADDLE-STITCH',
            )
            c.restoreState()

            if panels_per_side == 4 and spreads:
                gutter = 12.0  # 12pt vertical gutter between top & bottom spreads
                max_stack_h = LETTER_H - 28.0
                fit_scale = min(1.0, (max_stack_h - gutter) / max(1.0, raw_panel_h * 2.0))
                panel_w = raw_panel_w * fit_scale
                panel_h = raw_panel_h * fit_scale
                spread_w = panel_w * 2.0
                total_stack_h = panel_h * 2.0 + gutter

                start_x = max(12.0, (LETTER_W - spread_w) / 2.0)
                bot_y = max(12.0, (LETTER_H - total_stack_h) / 2.0)
                top_y = bot_y + panel_h + gutter

                top_spread = spreads[0]
                _draw_booklet_page(
                    c, top_spread["leftPage"], start_x, top_y, panel_w, panel_h, specs, compilation, cover_reader
                )
                _draw_booklet_page(
                    c, top_spread["rightPage"], start_x + panel_w, top_y, panel_w, panel_h, specs, compilation, cover_reader
                )
                if crop_marks:
                    # Short inner crop marks (1.5 offset + 3.5 len = 5pt < 6pt half-gutter) so marks never overlap
                    _draw_crop_marks(
                        c,
                        start_x,
                        top_y,
                        spread_w,
                        panel_h,
                        offset=3.5,
                        length=9.0,
                        top_offset=2.5,
                        top_len=8.0,
                        bot_offset=1.5,
                        bot_len=3.5,
                    )
                if fold_guides:
                    _draw_center_fold_line(c, start_x + panel_w, top_y, panel_h, ext=4.5)

                if len(spreads) > 1:
                    bot_spread = spreads[1]
                    _draw_booklet_page(
                        c, bot_spread["leftPage"], start_x, bot_y, panel_w, panel_h, specs, compilation, cover_reader
                    )
                    _draw_booklet_page(
                        c, bot_spread["rightPage"], start_x + panel_w, bot_y, panel_w, panel_h, specs, compilation, cover_reader
                    )
                    if crop_marks:
                        _draw_crop_marks(
                            c,
                            start_x,
                            bot_y,
                            spread_w,
                            panel_h,
                            offset=3.5,
                            length=9.0,
                            top_offset=1.5,
                            top_len=3.5,
                            bot_offset=2.5,
                            bot_len=8.0,
                        )
                    if fold_guides:
                        _draw_center_fold_line(c, start_x + panel_w, bot_y, panel_h, ext=4.5)

            elif spreads:
                spread = spreads[0]
                fit_scale = min(
                    1.0,
                    (LETTER_W - 28.0) / max(1.0, raw_panel_w * 2.0),
                    (LETTER_H - 28.0) / max(1.0, raw_panel_h),
                )
                panel_w = raw_panel_w * fit_scale
                panel_h = raw_panel_h * fit_scale
                spread_w = panel_w * 2.0
                start_x = max(14.0, (LETTER_W - spread_w) / 2.0)
                start_y = max(14.0, (LETTER_H - panel_h) / 2.0)

                _draw_booklet_page(
                    c, spread["leftPage"], start_x, start_y, panel_w, panel_h, specs, compilation, cover_reader
                )
                _draw_booklet_page(
                    c, spread["rightPage"], start_x + panel_w, start_y, panel_w, panel_h, specs, compilation, cover_reader
                )
                if crop_marks:
                    _draw_crop_marks(c, start_x, start_y, spread_w, panel_h, offset=4.0, length=11.0)
                if fold_guides:
                    _draw_center_fold_line(c, start_x + panel_w, start_y, panel_h, ext=8.0)

            c.showPage()

    c.save()
    return buf.getvalue()
