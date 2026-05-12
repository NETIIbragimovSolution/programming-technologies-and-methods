"""Blocking TCP client operations (CLI and FastAPI reuse this)."""

from __future__ import annotations

import json
from typing import Any

from common.protocol import sync_recv_line, sync_send_line
from common.tcp_stream import tcp_connect


def one_shot(host: str, port: int, path: str) -> dict[str, Any]:
    """
    Connect, read drives, send path request, read response, send quit, close.
    Returns a dict suitable for JSON serialization to the web UI.
    """
    try:
        sock = tcp_connect(host, port, timeout=30)
        try:
            first = sync_recv_line(sock)
            if first.get("type") != "drives":
                return {
                    "drives": [],
                    "response": first,
                    "error": "unexpected first message from server",
                }
            drives = list(first.get("drives", []))
            sync_send_line(sock, {"type": "request", "path": path})
            response = sync_recv_line(sock)
            sync_send_line(sock, {"type": "quit"})
        finally:
            sock.close()
        return {"drives": drives, "response": response}
    except json.JSONDecodeError as e:
        return {
            "drives": [],
            "response": {"type": "error", "message": "invalid JSON from server"},
            "error": str(e),
        }
