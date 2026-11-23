"""Standalone desktop launcher for Puzzle Book Generator (PyInstaller / local Python)."""

from __future__ import annotations

import multiprocessing
import os
import socket
import threading
import webbrowser

import uvicorn

from backend.main import DATA_DIR, STATIC_DIR, app


def find_open_port(start_port: int = 8080, max_attempts: int = 100) -> int:
    for candidate in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("127.0.0.1", candidate))
                return candidate
            except OSError:
                continue

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def main() -> None:
    try:
        preferred = int(os.environ.get("PORT", "8080"))
    except ValueError:
        preferred = 8080

    port = find_open_port(preferred)
    url = f"http://127.0.0.1:{port}"

    print("=" * 60)
    print("  Puzzle Book Generator — Local Print Server")
    print("=" * 60)
    print(f"  App URL      : {url}")
    print(f"  Static UI    : {STATIC_DIR}")
    print(f"  Puzzle Vault : {DATA_DIR}")
    print("-" * 60)
    print("  Opening your default browser in 1 second...")
    print("  Keep this window open while using the app.")
    print("  Press Ctrl+C or close this window to exit.")
    print("=" * 60)

    timer = threading.Timer(1.0, webbrowser.open, args=[url])
    timer.daemon = True
    timer.start()

    try:
        uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
    except KeyboardInterrupt:
        print("\nShutting down Puzzle Book Generator...")


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
