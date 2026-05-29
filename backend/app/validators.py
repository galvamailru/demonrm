"""Приведение значений из JSON/Handsontable к типам схем."""

from typing import Any


def coerce_optional_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def coerce_int(value: Any, default: int = 0) -> int:
    parsed = coerce_optional_int(value)
    return default if parsed is None else parsed
