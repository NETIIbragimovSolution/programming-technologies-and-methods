"""NDJSON line protocol over TCP (one JSON object per UTF-8 line)."""

from __future__ import annotations

import asyncio
import json
from typing import Any

__all__ = [
    "ENCODING",
    "encode_line",
    "decode_line",
    "write_message",
    "read_message",
    "sync_send_line",
    "sync_recv_line",
]

ENCODING = "utf-8"


def encode_line(obj: dict[str, Any]) -> bytes:
    return (json.dumps(obj, ensure_ascii=False) + "\n").encode(ENCODING)


def decode_line(data: bytes) -> dict[str, Any]:
    text = data.decode(ENCODING).strip()
    if not text:
        return {}
    return json.loads(text)


async def write_message(writer: asyncio.StreamWriter, obj: dict[str, Any]) -> None:
    writer.write(encode_line(obj))
    await writer.drain()


async def read_message(reader: asyncio.StreamReader) -> dict[str, Any]:
    line = await reader.readline()
    if not line:
        raise ConnectionError("connection closed")
    text = line.decode(ENCODING).strip()
    if not text:
        raise ConnectionError("empty line")
    return json.loads(text)


def sync_send_line(sock, obj: dict[str, Any]) -> None:
    sock.sendall(encode_line(obj))


def sync_recv_line(sock) -> dict[str, Any]:
    buf = bytearray()
    while True:
        chunk = sock.recv(1)
        if not chunk:
            raise ConnectionError("connection closed")
        buf.extend(chunk)
        if chunk == b"\n":
            break
    text = bytes(buf).decode(ENCODING).strip()
    if not text:
        raise ConnectionError("empty line")
    return json.loads(text)
