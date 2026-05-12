"""CLI-клиент по заданию 1.1: адрес, соединение, путь к каталогу/текстовому файлу, ответ, закрытие."""

from __future__ import annotations

import json
import os
import socket
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from common.address import parse_server_address
from common.protocol import sync_recv_line, sync_send_line
from common.tcp_stream import tcp_connect


def _print_drives(msg: dict) -> None:
    drives = msg.get("drives", [])
    print("\n--- Список логических устройств (от сервера) ---")
    if not drives:
        print("(список пуст)")
        return
    for i, d in enumerate(drives, 1):
        print(f"  {i}. {d}")
    print("(полный ответ в JSON ниже)")
    print(json.dumps(msg, ensure_ascii=False, indent=2))


def _print_server_reply(reply: dict) -> None:
    print("\n--- Ответ сервера ---")
    t = reply.get("type")
    if t == "dir":
        entries = reply.get("entries", [])
        print("Структура каталога (имена файлов и подкаталогов):")
        for e in entries:
            kind = "каталог" if e.get("is_dir") else "файл"
            print(f"  [{kind}]  {e.get('name', '')}")
    elif t == "file":
        print("Содержимое текстового файла:")
        print("-" * 40)
        print(reply.get("content", ""))
        print("-" * 40)
    elif t == "error":
        print("Ошибка:", reply.get("message", reply))
    else:
        print(json.dumps(reply, ensure_ascii=False, indent=2))


def main() -> None:
    default_hint = "127.0.0.1:9000"
    raw = input(
        f"Введите адрес сервера (хост или хост:порт, по умолчанию {default_hint}): "
    ).strip()
    host, port = parse_server_address(raw or default_hint)

    print(f"\nУстанавливаю соединение с {host}:{port} ...")
    sock: socket.socket | None = None
    try:
        sock = tcp_connect(host, port, timeout=30)
        welcome = sync_recv_line(sock)
        if welcome.get("type") != "drives":
            print("Неожиданное первое сообщение сервера:", welcome)
            return
        _print_drives(welcome)

        while True:
            path = input(
                "\nВведите имя каталога или текстового файла "
                "(путь относительно песочницы сервера или абсолютный внутри неё; "
                "пустая строка — уведомить сервер и закрыть соединение): "
            ).strip()
            if not path:
                sync_send_line(sock, {"type": "quit"})
                print("Отправлено уведомление о завершении; соединение закрывается.")
                break
            sync_send_line(sock, {"type": "request", "path": path})
            reply = sync_recv_line(sock)
            _print_server_reply(reply)
    except KeyboardInterrupt:
        print("\nПрервано пользователем.")
        if sock is not None:
            try:
                sync_send_line(sock, {"type": "quit"})
            except OSError:
                pass
    finally:
        if sock is not None:
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            sock.close()
        print("Соединение с сервером закрыто.")


if __name__ == "__main__":
    try:
        main()
    except (ConnectionError, OSError, json.JSONDecodeError) as e:
        print(f"Ошибка соединения или данных: {e}", file=sys.stderr)
        sys.exit(1)
