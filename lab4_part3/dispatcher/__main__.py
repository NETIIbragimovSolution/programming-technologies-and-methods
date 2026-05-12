"""
Задание 3.2: пульт диспетчера — окно с кнопками по числу установок.

Цвета: зелёный — работает, красный — авария, серый — ремонт.
Сначала по TCP приходит число установок, затем периодически — состояния.
"""

from __future__ import annotations

import json
import os
import queue
import socket
import sys
import threading
import tkinter as tk
from tkinter import ttk
from typing import Any

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from common.protocol import encode_line, parse_line

COLOR_WORKING = "#2ecc71"
COLOR_FAULT = "#e74c3c"
COLOR_REPAIR = "#95a5a6"
COLOR_UNKNOWN = "#bdc3c7"

STATE_TO_COLOR = {
    "работает": COLOR_WORKING,
    "авария": COLOR_FAULT,
    "ремонт": COLOR_REPAIR,
}


def _recv_until_newline(conn: socket.socket, buf: bytearray, stop: threading.Event) -> bytes | None:
    conn.settimeout(0.5)
    while not stop.is_set():
        i = buf.find(b"\n")
        if i >= 0:
            line = bytes(buf[: i + 1])
            del buf[: i + 1]
            return line
        try:
            chunk = conn.recv(4096)
        except socket.timeout:
            continue
        except OSError:
            return None
        if not chunk:
            return None
        buf.extend(chunk)
    return None


def _serve_client(
    conn: socket.socket,
    ui_queue: queue.Queue[Any],
    stop: threading.Event,
) -> None:
    buf = bytearray()
    try:
        line = _recv_until_newline(conn, buf, stop)
        if line is None or stop.is_set():
            return
        msg = parse_line(line)
        if msg.get("type") != "register":
            ui_queue.put(("error", f"Ожидался register, получено: {msg}"))
            return
        count = int(msg["count"])
        conn.sendall(encode_line({"type": "ack", "ok": True}))
        ui_queue.put(("register", count))

        while not stop.is_set():
            line = _recv_until_newline(conn, buf, stop)
            if line is None:
                ui_queue.put(("disconnect", None))
                return
            try:
                msg = parse_line(line)
            except (ValueError, json.JSONDecodeError):
                continue
            if msg.get("type") == "states" and "units" in msg:
                ui_queue.put(("states", msg["units"]))
    except OSError:
        ui_queue.put(("disconnect", None))


def _accept_loop(
    host: str,
    port: int,
    ui_queue: queue.Queue[Any],
    stop: threading.Event,
    ready: threading.Event,
    bind_error: list[OSError],
) -> None:
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        srv.bind((host, port))
        srv.listen(1)
    except OSError as e:
        bind_error.append(e)
        ready.set()
        try:
            srv.close()
        except OSError:
            pass
        return

    ready.set()
    srv.settimeout(0.5)
    while not stop.is_set():
        try:
            conn, _ = srv.accept()
        except socket.timeout:
            continue
        except OSError:
            break
        conn.setblocking(True)
        _serve_client(conn, ui_queue, stop)
        try:
            conn.close()
        except OSError:
            pass
    try:
        srv.close()
    except OSError:
        pass


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Задание 3.2 — пульт (TCP/IP)")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9020)
    args = parser.parse_args()

    ui_queue: queue.Queue[Any] = queue.Queue()
    stop = threading.Event()
    server_ready = threading.Event()
    bind_error: list[OSError] = []

    th = threading.Thread(
        target=lambda: _accept_loop(
            args.host, args.port, ui_queue, stop, server_ready, bind_error
        ),
        daemon=True,
    )
    th.start()
    if not server_ready.wait(timeout=5.0):
        print("Сервер не поднялся.", file=sys.stderr)
        sys.exit(1)
    if bind_error:
        print(f"Bind {args.host}:{args.port}: {bind_error[0]}", file=sys.stderr)
        sys.exit(1)

    root = tk.Tk()
    root.title("Пульт диспетчера — задание 3.2")
    root.geometry("720x480")

    status = ttk.Label(
        root,
        text=f"Ожидание контроллера (TCP {args.host}:{args.port}) …",
        font=("Helvetica", 12),
    )
    status.pack(fill=tk.X, padx=8, pady=8)

    # Обычный tk.Frame: ttk на macOS тоже не красится произвольно.
    frame = tk.Frame(root, bg=root.cget("bg"))
    frame.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)

    # На macOS tk.Button рисуется системой и часто игнорирует bg.
    # Плитка: Frame + Label — цвет фона соблюдается везде.
    tiles: dict[int, tuple[tk.Frame, tk.Label]] = {}

    def clear_buttons() -> None:
        for w in frame.winfo_children():
            w.destroy()
        tiles.clear()

    def build_buttons(n: int) -> None:
        clear_buttons()
        cols = min(6, max(1, n))
        for i in range(1, n + 1):
            r, c = divmod(i - 1, cols)
            cell = tk.Frame(
                frame,
                bg=COLOR_UNKNOWN,
                bd=2,
                relief=tk.RAISED,
                highlightthickness=0,
            )
            lbl = tk.Label(
                cell,
                text=str(i),
                bg=COLOR_UNKNOWN,
                fg="#111111",
                font=("Helvetica", 14, "bold"),
            )
            lbl.pack(expand=True, fill=tk.BOTH, padx=6, pady=14)
            cell.grid(row=r, column=c, padx=4, pady=4, sticky="nsew")
            tiles[i] = (cell, lbl)
        for c in range(cols):
            frame.grid_columnconfigure(c, weight=1)
        for r in range((n + cols - 1) // cols):
            frame.grid_rowconfigure(r, weight=1)

    def apply_states(units: list[Any]) -> None:
        for item in units:
            try:
                uid = int(item["id"])
                st = str(item["state"])
            except (KeyError, TypeError, ValueError):
                continue
            pair = tiles.get(uid)
            if pair is None:
                continue
            cell, lbl = pair
            color = STATE_TO_COLOR.get(st, COLOR_UNKNOWN)
            cell.config(bg=color)
            lbl.config(bg=color)

    def poll_ui() -> None:
        try:
            while True:
                kind, data = ui_queue.get_nowait()
                if kind == "register":
                    n = int(data)
                    status.config(text=f"Установок: {n}. Приём состояний по сети …")
                    build_buttons(n)
                elif kind == "states":
                    apply_states(data)
                elif kind == "error":
                    status.config(text=str(data))
                elif kind == "disconnect":
                    status.config(
                        text=f"Контроллер отключился. Ожидание TCP {args.host}:{args.port} …"
                    )
                    clear_buttons()
        except queue.Empty:
            pass
        root.after(150, poll_ui)

    def on_close() -> None:
        stop.set()
        root.destroy()

    root.protocol("WM_DELETE_WINDOW", on_close)
    root.after(150, poll_ui)
    root.mainloop()
    stop.set()


if __name__ == "__main__":
    main()
