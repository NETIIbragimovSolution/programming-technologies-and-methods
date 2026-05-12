"""NDJSON по TCP: одна строка = один JSON-объект."""

from __future__ import annotations

import json
from typing import Any

ENCODING = "utf-8"


def encode_line(obj: dict[str, Any]) -> bytes:
    return (json.dumps(obj, ensure_ascii=False) + "\n").encode(ENCODING)


def parse_line(data: bytes) -> dict[str, Any]:
    text = data.decode(ENCODING).strip()
    if not text:
        raise ValueError("empty line")
    return json.loads(text)


def recv_line(sock, timeout: float | None = None) -> dict[str, Any]:
    if timeout is not None:
        sock.settimeout(timeout)
    buf = bytearray()
    while True:
        chunk = sock.recv(1)
        if not chunk:
            raise ConnectionError("connection closed")
        buf.extend(chunk)
        if chunk == b"\n":
            break
    return parse_line(bytes(buf))
