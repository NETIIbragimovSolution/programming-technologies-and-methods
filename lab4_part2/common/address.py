"""Разбор адреса пульта: хост или хост:порт (в т.ч. IPv6 в скобках)."""


def parse_pult_address(addr: str, default_port: int = 9010) -> tuple[str, int]:
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
