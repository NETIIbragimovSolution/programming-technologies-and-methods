"""
Прикладной формат поверх TCP/IP: одна строка UTF-8 = один JSON-объект (NDJSON).
Поля: temperature (°C), pressure (атм).
"""

from __future__ import annotations

import json
from typing import Any

ENCODING = "utf-8"


def encode_sample(temperature: float, pressure: float) -> bytes:
    obj = {"temperature": temperature, "pressure": pressure}
    return (json.dumps(obj, ensure_ascii=False) + "\n").encode(ENCODING)


def parse_line(data: bytes) -> dict[str, Any]:
    text = data.decode(ENCODING).strip()
    if not text:
        raise ValueError("empty line")
    return json.loads(text)
