"""
Задание 2.1: консольный контроллер технологического процесса.

Имитация измерений: температура 0…1000 °C, давление 0…6 атм;
раз в 1 с независимые значения с равномерным распределением на отрезках.
Передача по сети: протокол TCP/IP (IPv4), полезная нагрузка — строка JSON + \\n.
"""

from __future__ import annotations

import argparse
import os
import random
import socket
import sys
import time

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from common.address import parse_pult_address
from common.protocol import encode_sample

# Диапазоны по условию задачи (равномерное распределение)
TEMP_MIN_C = 0.0
TEMP_MAX_C = 1000.0
PRESSURE_MIN_ATM = 0.0
PRESSURE_MAX_ATM = 6.0


def _resolve_host_port(args: argparse.Namespace) -> tuple[str, int]:
    if args.addr:
        return parse_pult_address(args.addr)
    if args.host is not None or args.port is not None:
        h = args.host if args.host is not None else "127.0.0.1"
        p = args.port if args.port is not None else 9010
        return h, p
    line = input(
        "Адрес пульта диспетчера (хост или хост:порт) [127.0.0.1:9010]: "
    ).strip()
    return parse_pult_address(line or "127.0.0.1:9010")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Задание 2.1 — контроллер процесса (клиент TCP/IP)"
    )
    parser.add_argument(
        "addr",
        nargs="?",
        default=None,
        help="пульт: хост или хост:порт",
    )
    parser.add_argument("--host", default=None, help="хост пульта")
    parser.add_argument("--port", type=int, default=None, help="порт пульта")
    args = parser.parse_args()

    host, port = _resolve_host_port(args)

    print(
        f"Подключение к пульту {host}:{port} (TCP/IP) …\n"
        f"Имитация измерений: T ∈ [{TEMP_MIN_C:g}; {TEMP_MAX_C:g}] °C, "
        f"P ∈ [{PRESSURE_MIN_ATM:g}; {PRESSURE_MAX_ATM:g}] атм\n"
        "Шаг 1 с, равномерный закон по каждому параметру. Ctrl+C — выход."
    )

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP)
    sock.settimeout(30)
    try:
        sock.connect((host, port))
    except OSError as e:
        print(f"Не удалось подключиться: {e}", file=sys.stderr)
        if getattr(e, "errno", None) in (61, 111, 10061):
            print(
                "Сначала запустите пульт (программа 2.2), из каталога lab4_part2:\n"
                "  python3 -m dispatcher",
                file=sys.stderr,
            )
        sys.exit(1)

    sock.settimeout(None)
    n = 0
    try:
        while True:
            t_c = random.uniform(TEMP_MIN_C, TEMP_MAX_C)
            p_atm = random.uniform(PRESSURE_MIN_ATM, PRESSURE_MAX_ATM)
            sock.sendall(encode_sample(t_c, p_atm))
            n += 1
            print(f"#{n:6d}  T = {t_c:8.2f} °C   P = {p_atm:6.3f} атм")
            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\nОстанов по Ctrl+C.")
    finally:
        sock.close()


if __name__ == "__main__":
    main()
