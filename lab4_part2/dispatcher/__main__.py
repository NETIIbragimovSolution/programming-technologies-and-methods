"""
Задание 2.2: оконное приложение — пульт диспетчера.

Программа получает данные по сети (TCP/IP) и отображает ДВА графика:
  • зависимость температуры от времени;
  • зависимость давления от времени.
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import socket
import sys
import threading
import time
import tkinter as tk
from tkinter import ttk
from typing import Any

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from matplotlib.figure import Figure

from common.protocol import parse_line

_DISCONNECT = object()

# Диапазоны по условию задачи (для подписей и начального масштаба осей)
TEMP_RANGE = (0.0, 1000.0)
PRESSURE_RANGE = (0.0, 6.0)


def _read_lines_from_sock(
    conn: socket.socket,
    out: queue.Queue[Any],
    stop: threading.Event,
) -> None:
    buf = bytearray()
    conn.settimeout(0.5)
    t0 = time.perf_counter()
    try:
        while not stop.is_set():
            try:
                chunk = conn.recv(4096)
            except socket.timeout:
                continue
            except OSError:
                break
            if not chunk:
                break
            buf.extend(chunk)
            while True:
                i = buf.find(b"\n")
                if i < 0:
                    break
                line = bytes(buf[: i + 1])
                del buf[: i + 1]
                try:
                    obj = parse_line(line)
                    te = float(obj["temperature"])
                    pr = float(obj["pressure"])
                except (KeyError, TypeError, ValueError, json.JSONDecodeError):
                    continue
                elapsed = time.perf_counter() - t0
                out.put((elapsed, te, pr))
    finally:
        if not stop.is_set():
            out.put(_DISCONNECT)


def _accept_loop(
    host: str,
    port: int,
    out: queue.Queue[Any],
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
        _read_lines_from_sock(conn, out, stop)
        try:
            conn.close()
        except OSError:
            pass
    try:
        srv.close()
    except OSError:
        pass


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Задание 2.2 — пульт диспетчера (TCP/IP + два графика)"
    )
    parser.add_argument("--host", default="127.0.0.1", help="адрес прослушивания")
    parser.add_argument("--port", type=int, default=9010, help="порт TCP")
    parser.add_argument(
        "--window-sec",
        type=float,
        default=120.0,
        help="окно по оси времени (секунды)",
    )
    args = parser.parse_args()

    q: queue.Queue[Any] = queue.Queue()
    stop = threading.Event()
    server_ready = threading.Event()
    bind_error: list[OSError] = []

    th = threading.Thread(
        target=lambda: _accept_loop(
            args.host, args.port, q, stop, server_ready, bind_error
        ),
        daemon=True,
    )
    th.start()
    if not server_ready.wait(timeout=5.0):
        print("Сервер не поднялся (таймаут).", file=sys.stderr)
        sys.exit(1)
    if bind_error:
        print(f"Не удалось занять {args.host}:{args.port}: {bind_error[0]}", file=sys.stderr)
        sys.exit(1)

    root = tk.Tk()
    root.title("Пульт диспетчера — задание 2.2 (два графика T(t) и P(t))")
    root.geometry("940x720")

    header = ttk.Label(
        root,
        text=(
            "Задание 2.2: приём данных по сети (TCP). "
            "Ниже — два отдельных графика: температура и давление от времени."
        ),
        font=("Helvetica", 11),
        wraplength=900,
        justify=tk.CENTER,
    )
    header.pack(fill=tk.X, padx=8, pady=(8, 4))

    status = ttk.Label(
        root,
        text=f"Ожидание контроллера (TCP {args.host}:{args.port}) …",
        font=("Helvetica", 11),
    )
    status.pack(fill=tk.X, padx=8, pady=4)

    # Два отдельных графика (два Figure) — явно «два графика» по формулировке задания
    fig_t = Figure(figsize=(8.5, 3.2), dpi=100)
    fig_p = Figure(figsize=(8.5, 3.2), dpi=100)
    ax_t = fig_t.add_subplot(111)
    ax_p = fig_p.add_subplot(111)

    def _style_temp_axes() -> None:
        ax_t.set_title("График 1. Зависимость температуры от времени")
        ax_t.set_xlabel("Время, с")
        ax_t.set_ylabel("Температура, °C")
        ax_t.set_ylim(TEMP_RANGE[0], TEMP_RANGE[1])
        ax_t.grid(True, alpha=0.3)

    def _style_pressure_axes() -> None:
        ax_p.set_title("График 2. Зависимость давления от времени")
        ax_p.set_xlabel("Время, с")
        ax_p.set_ylabel("Давление, атм")
        ax_p.set_ylim(PRESSURE_RANGE[0], PRESSURE_RANGE[1])
        ax_p.grid(True, alpha=0.3)

    canvas_t = FigureCanvasTkAgg(fig_t, master=root)
    canvas_p = FigureCanvasTkAgg(fig_p, master=root)
    canvas_t.get_tk_widget().pack(fill=tk.BOTH, expand=True, padx=8, pady=(4, 2))
    canvas_p.get_tk_widget().pack(fill=tk.BOTH, expand=True, padx=8, pady=(2, 8))

    times: list[float] = []
    temps: list[float] = []
    press: list[float] = []

    def redraw() -> None:
        ax_t.clear()
        ax_p.clear()
        _style_temp_axes()
        _style_pressure_axes()
        w = args.window_sec
        if times:
            ax_t.plot(times, temps, color="tab:red", linewidth=1.5, label="T(t)")
            ax_p.plot(times, press, color="tab:blue", linewidth=1.5, label="P(t)")
            t_end = times[-1]
            ax_t.set_xlim(max(0.0, t_end - w), max(w, t_end + 0.5))
            ax_p.set_xlim(max(0.0, t_end - w), max(w, t_end + 0.5))
        else:
            ax_t.set_xlim(0, w)
            ax_p.set_xlim(0, w)
        fig_t.tight_layout()
        fig_p.tight_layout()
        canvas_t.draw_idle()
        canvas_p.draw_idle()

    def poll_queue() -> None:
        got_any = False
        while True:
            try:
                item = q.get_nowait()
            except queue.Empty:
                break
            if item is _DISCONNECT:
                times.clear()
                temps.clear()
                press.clear()
                status.config(
                    text=f"Контроллер отключился. Ожидание TCP {args.host}:{args.port} …"
                )
                got_any = True
                continue
            got_any = True
            el, te, pr = item
            status.config(
                text=(
                    f"Сеть: {args.host}:{args.port}  |  "
                    f"T = {te:.2f} °C  |  P = {pr:.3f} атм"
                )
            )
            times.append(el)
            temps.append(te)
            press.append(pr)
            w = args.window_sec
            while times and times[-1] - times[0] > w:
                times.pop(0)
                temps.pop(0)
                press.pop(0)

        if got_any:
            redraw()

        root.after(100, poll_queue)

    def on_close() -> None:
        stop.set()
        root.destroy()

    root.protocol("WM_DELETE_WINDOW", on_close)
    redraw()
    root.after(100, poll_queue)
    root.mainloop()
    stop.set()


if __name__ == "__main__":
    main()
