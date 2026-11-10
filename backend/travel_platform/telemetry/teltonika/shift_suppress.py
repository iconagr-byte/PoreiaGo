"""
After «Τέλος βάρδιας», suppress hydrate/keepalive re-paint for a plate until
the Teltonika device sends a real Codec login or AVL packet.

Without this, end-shift deleted the pin and hydrate restored it within ~2s.
"""

from __future__ import annotations

import threading
import time

_LOCK = threading.Lock()
# key "tenant_id|PLATE" → monotonic deadline
_suppress_until: dict[str, float] = {}
# Default: block ghost rehydrate; real IMEI/AVL clears immediately.
_DEFAULT_SEC = 3600.0


def _key(tenant_id: str | None, plate: str | None) -> str:
    tid = str(tenant_id or "").strip()
    code = str(plate or "").strip().upper().replace(" ", "").replace("-", "")
    return f"{tid}|{code}"


def suppress_plate_after_shift(
    tenant_id: str | None,
    plate: str | None,
    *,
    seconds: float = _DEFAULT_SEC,
) -> None:
    key = _key(tenant_id, plate)
    if not key.startswith("|") and "|" in key and not key.endswith("|"):
        with _LOCK:
            _suppress_until[key] = time.monotonic() + max(30.0, float(seconds))


def clear_shift_suppress(tenant_id: str | None, plate: str | None) -> None:
    key = _key(tenant_id, plate)
    with _LOCK:
        _suppress_until.pop(key, None)


def is_shift_suppressed(tenant_id: str | None, plate: str | None) -> bool:
    key = _key(tenant_id, plate)
    now = time.monotonic()
    with _LOCK:
        until = _suppress_until.get(key)
        if until is None:
            return False
        if now >= until:
            _suppress_until.pop(key, None)
            return False
        return True
