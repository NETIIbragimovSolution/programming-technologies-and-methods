"""Явное создание TCP-сокетов (SOCK_STREAM, IPPROTO_TCP) для клиента и сервера."""

from __future__ import annotations

import socket

__all__ = ["tcp_connect", "tcp_listen"]


def tcp_connect(host: str, port: int, timeout: float = 30) -> socket.socket:
    """Подключение к серверу по TCP (потоковый сокет)."""
    last_exc: OSError | None = None
    for res in socket.getaddrinfo(
        host,
        port,
        type=socket.SOCK_STREAM,
        proto=socket.IPPROTO_TCP,
    ):
        af, socktype, proto, _, sa = res
        s: socket.socket | None = None
        try:
            s = socket.socket(af, socktype, proto)
            s.settimeout(timeout)
            s.connect(sa)
            return s
        except OSError as e:
            last_exc = e
            if s is not None:
                s.close()
    if last_exc is not None:
        raise last_exc
    raise OSError(f"tcp_connect: не удалось разрешить адрес {host!r}:{port}")


def tcp_listen(host: str, port: int, backlog: int = 100) -> socket.socket:
    """Прослушивание порта по TCP; сокет неблокирующий (для asyncio.start_server)."""
    last_exc: OSError | None = None
    for res in socket.getaddrinfo(
        host,
        port,
        type=socket.SOCK_STREAM,
        proto=socket.IPPROTO_TCP,
        flags=socket.AI_PASSIVE,
    ):
        af, socktype, proto, _, sa = res
        s: socket.socket | None = None
        try:
            s = socket.socket(af, socktype, proto)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(sa)
            s.listen(backlog)
            s.setblocking(False)
            return s
        except OSError as e:
            last_exc = e
            if s is not None:
                s.close()
    if last_exc is not None:
        raise last_exc
    raise OSError(f"tcp_listen: не удалось привязать {host!r}:{port}")
