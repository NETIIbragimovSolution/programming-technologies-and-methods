"""Asyncio TCP server: sends drives, serves dir/file listings under a sandbox root."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from common.fsops import handle_path, list_logical_drives, resolve_under_root
from common.protocol import read_message, write_message
from common.tcp_stream import tcp_listen


async def client_handler(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    sandbox_root: str,
) -> None:
    peer = writer.get_extra_info("peername")
    try:
        drives = list_logical_drives()
        await write_message(writer, {"type": "drives", "drives": drives})
        while True:
            try:
                msg = await read_message(reader)
            except json.JSONDecodeError:
                await write_message(
                    writer, {"type": "error", "message": "invalid JSON line from client"}
                )
                continue
            mtype = msg.get("type")
            if mtype == "quit":
                break
            if mtype != "request":
                await write_message(
                    writer,
                    {"type": "error", "message": f"unknown message type: {mtype!r}"},
                )
                continue
            raw_path = msg.get("path", "")
            if not isinstance(raw_path, str):
                await write_message(
                    writer, {"type": "error", "message": "path must be a string"}
                )
                continue
            try:
                target = resolve_under_root(raw_path, sandbox_root)
            except ValueError as e:
                await write_message(writer, {"type": "error", "message": str(e)})
                continue
            if not os.path.exists(target):
                await write_message(
                    writer, {"type": "error", "message": "path does not exist"}
                )
                continue
            await write_message(writer, handle_path(target))
    except (ConnectionError, asyncio.IncompleteReadError):
        pass
    finally:
        writer.close()
        await writer.wait_closed()
        if peer:
            print(f"closed connection from {peer}")


async def main_async() -> None:
    parser = argparse.ArgumentParser(description="Lab4 TCP file browser server")
    parser.add_argument("--host", default="127.0.0.1", help="bind address")
    parser.add_argument("--port", type=int, default=9000, help="listen port")
    parser.add_argument(
        "--root",
        default=os.getcwd(),
        help="sandbox root; paths are resolved only inside this directory tree",
    )
    args = parser.parse_args()
    sandbox = os.path.realpath(os.path.abspath(args.root))

    async def handle(
        r: asyncio.StreamReader, w: asyncio.StreamWriter
    ) -> None:
        await client_handler(r, w, sandbox)

    listen_sock = tcp_listen(args.host, args.port)
    try:
        server = await asyncio.start_server(handle, sock=listen_sock)
    except Exception:
        listen_sock.close()
        raise
    addrs = ", ".join(str(s.getsockname()) for s in server.sockets or [])
    print(f"Сервер слушает {addrs}, корень доступа (песочница)={sandbox}")
    async with server:
        await server.serve_forever()


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
