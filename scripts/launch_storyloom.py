#!/usr/bin/env python3
"""Open StoryLoom in the user's browser without requiring a manual terminal command."""
from __future__ import annotations

import functools
import http.server
import socketserver
import threading
import time
import webbrowser
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[1]
HOST = "127.0.0.1"


class StoryLoomServer(socketserver.TCPServer):
    allow_reuse_address = True


def main() -> None:
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=APP_DIR)

    with StoryLoomServer((HOST, 0), handler) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        webbrowser.open(f"http://{HOST}:{port}/")
        print(f"StoryLoom is open at http://{HOST}:{port}/", flush=True)
        print("Keep this launcher running while you write. Press Ctrl+C to close StoryLoom.", flush=True)
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            server.shutdown()


if __name__ == "__main__":
    main()
