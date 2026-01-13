from __future__ import annotations

from xml.etree import ElementTree as ET


def _to_float(val: str | None) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except ValueError:
        return None


def _to_int(val: str | None) -> int | None:
    if val is None:
        return None
    try:
        return int(float(val))
    except ValueError:
        return None


def parse_devices(xml: str) -> list[dict]:
    root = ET.fromstring(xml)
    devices = []
    for dtype in ("tdl", "htdl", "ltdl"):
        for node in root.findall(dtype):
            devices.append(
                {
                    "id": (node.findtext("id") or "").strip() or None,
                    "label": node.findtext("label"),
                    "org": node.findtext("org"),
                    "min_temp": _to_float(node.findtext("min_temp")),
                    "max_temp": _to_float(node.findtext("max_temp")),
                    "vrn": node.findtext("vrn"),
                    "battery": _to_float(
                        node.findtext("battery")
                        or node.findtext("bat")
                        or node.findtext("batt")
                    ),
                    "type": dtype,
                }
            )
    return devices


def parse_measurements(xml: str, device_id: str | None = None) -> list[dict]:
    root = ET.fromstring(xml)
    points = []
    for dtype in ("tdl", "htdl", "ltdl"):
        for node in root.findall(dtype):
            dev_id = (node.findtext("id") or "").strip()
            if device_id and dev_id != str(device_id):
                continue
            ms = node.find("ms")
            if ms is None:
                continue
            for m in ms.findall("m"):
                points.append(
                    {
                        "id": dev_id or None,
                        "type": dtype,
                        "t": _to_float(m.findtext("t")),
                        "h": _to_float(m.findtext("h")),
                        "utc": _to_int(m.findtext("utc")),
                    }
                )
    return points
