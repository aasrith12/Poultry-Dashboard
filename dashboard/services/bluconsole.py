from __future__ import annotations

from urllib import parse, request
from django.conf import settings


def _request(path: str, params: dict[str, str | int | bool | None]) -> tuple[int, str]:
    clean_params = {k: v for k, v in params.items() if v is not None}
    query = parse.urlencode(clean_params)
    url = f"{settings.BLU_BASE}{path}?{query}"
    req = request.Request(url, method="GET")
    with request.urlopen(req, timeout=20) as resp:
        text = resp.read().decode("utf-8", errors="replace")
        return resp.status, text


def blu_login(uname: str, upass: str) -> None:
    status, text = _request(
        "/bluconsolerest/1.0/resources/devices",
        {"uname": uname, "upass": upass},
    )
    if status != 200 or "bad username or password" in text.lower():
        raise ValueError("Invalid BluConsole credentials")


def get_devices(uname: str, upass: str, children: bool | None = None) -> str:
    params = {"uname": uname, "upass": upass}
    if children is not None:
        params["children"] = "true" if children else "false"
    status, text = _request("/bluconsolerest/1.0/resources/devices", params)
    if status != 200:
        raise ValueError(f"Devices fetch failed: {status}")
    return text


def get_measurements(
    uname: str,
    upass: str,
    device_id: str | None = None,
    from_time: int | None = None,
    to_time: int | None = None,
    include_all: bool | None = None,
) -> str:
    params = {"uname": uname, "upass": upass}
    if device_id:
        params["id"] = device_id
    if from_time:
        params["fromTime"] = from_time
    if to_time:
        params["toTime"] = to_time
    if include_all:
        params["includeAll"] = "true"
    status, text = _request("/bluconsolerest/1.0/resources/devices", params)
    if status != 200:
        raise ValueError(f"Measurements fetch failed: {status}")
    return text
