"""Filesystem helpers for the TCP file browser server."""

from __future__ import annotations

import os
import string
from typing import Any

MAX_FILE_BYTES = 1_048_576  # 1 MiB cap for file payload in JSON
_TEXT_SNIFF_BYTES = 64 * 1024


def _is_probably_plain_text(path: str) -> bool:
    """Reject obvious binary files (assignment: ordinary text files)."""
    to_read = min(_TEXT_SNIFF_BYTES, max(os.path.getsize(path), 0))
    if to_read == 0:
        return True
    with open(path, "rb") as f:
        sample = f.read(to_read)
    if b"\x00" in sample:
        return False
    return True


def list_logical_drives() -> list[str]:
    if os.name == "nt":
        return [f"{d}:\\" for d in string.ascii_uppercase if os.path.exists(f"{d}:\\")]
    drives: list[str] = ["/"]
    vol = "/Volumes"
    if os.path.isdir(vol):
        for name in sorted(os.listdir(vol)):
            p = os.path.join(vol, name)
            if os.path.isdir(p):
                drives.append(p)
    return drives


def is_under_root(path: str, root: str) -> bool:
    root_r = os.path.realpath(root)
    path_r = os.path.realpath(path)
    try:
        common = os.path.commonpath([root_r, path_r])
    except ValueError:
        return False
    return common == root_r


def resolve_under_root(raw_path: str, root: str) -> str:
    root = os.path.realpath(os.path.abspath(root))
    if os.path.isabs(raw_path):
        candidate = os.path.normpath(raw_path)
    else:
        candidate = os.path.normpath(os.path.join(root, raw_path))
    candidate = os.path.realpath(os.path.abspath(candidate))
    if not is_under_root(candidate, root):
        raise ValueError("path outside server sandbox")
    return candidate


def handle_path(target: str) -> dict[str, Any]:
    if os.path.isdir(target):
        entries: list[dict[str, Any]] = []
        with os.scandir(target) as it:
            for e in sorted(it, key=lambda x: x.name.lower()):
                entries.append({"name": e.name, "is_dir": e.is_dir(follow_symlinks=False)})
        return {"type": "dir", "entries": entries}
    if os.path.isfile(target):
        size = os.path.getsize(target)
        if size > MAX_FILE_BYTES:
            return {
                "type": "error",
                "message": f"file too large ({size} bytes); max {MAX_FILE_BYTES}",
            }
        if not _is_probably_plain_text(target):
            return {
                "type": "error",
                "message": "file is not plain text (binary data detected)",
            }
        with open(target, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return {"type": "file", "content": content}
    return {"type": "error", "message": "not a file or directory"}
