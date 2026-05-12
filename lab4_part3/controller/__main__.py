"""
Задание 3.1: консольный контроллер технологических установок.

Состояния: работает, авария, ремонт. Число установок — из файла конфигурации.
После подключения передаёт диспетчеру count, ждёт ответ, затем каждые 2 с шлёт состояния.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import socket
import sys
import time
from dataclasses import dataclass
from typing import Literal

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from common.protocol import encode_line, recv_line

P_WORKING_WHEN_UP = 0.8
P_FAULT_WHEN_UP = 0.2
assert abs(P_WORKING_WHEN_UP + P_FAULT_WHEN_UP - 1.0) < 1e-9
P_RECOVER_FROM_REPAIR = 0.5

StateOut = Literal["работает", "авария", "ремонт"]


@dataclass
class UnitModel:
    """Внутри: только «в строю» или «в ремонте». Авария — на один передаваемый такт."""

    in_repair: bool = False

    def tick(self) -> StateOut:
        if not self.in_repair:
            if random.random() < P_WORKING_WHEN_UP:
                return "работает"
            self.in_repair = True
            return "авария"
        if random.random() < P_RECOVER_FROM_REPAIR:
            self.in_repair = False
            return "работает"
        return "ремонт"


def load_count(path: str) -> int:
    with open(path, encoding="utf-8") as f:
        cfg = json.load(f)
    if "count" in cfg:
        n = int(cfg["count"])
    elif "installations" in cfg:
        n = int(cfg["installations"])
    else:
        raise KeyError("В конфиге нужно поле «count» или «installations»")
    if n < 1:
        raise ValueError("Число установок должно быть ≥ 1")
    return n


def main() -> None:
    parser = argparse.ArgumentParser(description="Задание 3.1 — контроллер (TCP/IP)")
    parser.add_argument(
        "--config",
        default=os.path.join(_ROOT, "config.json"),
        help="JSON: {\"count\": N}",
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9020)
    args = parser.parse_args()

    try:
        n = load_count(args.config)
    except (OSError, json.JSONDecodeError, KeyError, ValueError) as e:
        print(f"Ошибка конфигурации: {e}", file=sys.stderr)
        sys.exit(1)

    print(
        f"Установок: {n} (файл {args.config})\n"
        f"Подключение к диспетчеру {args.host}:{args.port} (TCP/IP) …"
    )

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP)
    sock.settimeout(30)
    try:
        sock.connect((args.host, args.port))
    except OSError as e:
        print(f"Подключение не удалось: {e}", file=sys.stderr)
        print("Сначала запустите: python3 -m dispatcher", file=sys.stderr)
        sys.exit(1)

    sock.settimeout(None)
    try:
        sock.sendall(encode_line({"type": "register", "count": n}))
        reply = recv_line(sock, timeout=60.0)
        if reply.get("type") != "ack" or not reply.get("ok", False):
            print(f"Ожидался ack, получено: {reply}", file=sys.stderr)
            sys.exit(1)
        print("Диспетчер подтвердил регистрацию. Цикл 2 с: работает/авария/ремонт …")

        units = [UnitModel() for _ in range(n)]
        tick = 0
        while True:
            tick += 1
            states = []
            for i, u in enumerate(units, start=1):
                states.append({"id": i, "state": u.tick()})
            payload = {"type": "states", "units": states}
            sock.sendall(encode_line(payload))
            preview = " ".join(f"{s['id']}:{s['state']}" for s in states)
            print(f"#{tick:5d}  {preview}")
            time.sleep(2.0)
    except KeyboardInterrupt:
        print("\nОстанов (Ctrl+C).")
    except (ConnectionError, OSError, json.JSONDecodeError) as e:
        print(f"Ошибка обмена: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        sock.close()


if __name__ == "__main__":
    main()
