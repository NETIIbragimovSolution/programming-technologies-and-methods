"""Parse server address from user input (host or host:port, optional IPv6)."""


def parse_server_address(addr: str, default_port: int = 9000) -> tuple[str, int]:
    addr = addr.strip()
    if not addr:
        return "127.0.0.1", default_port
    if addr.startswith("["):
        if "]:" in addr:
            inner, _, port_s = addr.partition("]:")
            host = inner.strip("[]")
            return host, int(port_s)
        return addr.strip("[]"), default_port
    if ":" in addr:
        host, _, rest = addr.rpartition(":")
        if rest.isdigit() and host and addr.count(":") == 1:
            return host, int(rest)
    return addr, default_port
