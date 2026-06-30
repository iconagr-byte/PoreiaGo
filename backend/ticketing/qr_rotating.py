"""Rotating QR tokens (TOTP-style 30s windows). QR carries only opaque ref + trip — no PII."""

import time
from typing import Any

import jwt

from .config import settings


def current_step(ts: float | None = None) -> int:
    t = ts if ts is not None else time.time()
    return int(t) // settings.qr_window_seconds


def issue_rotating_jwt(ticket_ref: str, trip_id: int) -> dict[str, Any]:
    step = current_step()
    window_end = (step + 1) * settings.qr_window_seconds
    payload = {
        "iss": settings.jwt_issuer,
        "ref": ticket_ref,
        "tid": trip_id,
        "step": step,
        "exp": window_end + 5,
        "iat": int(time.time()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return {
        "token": token,
        "expires_in": max(1, window_end - int(time.time())),
        "step": step,
        "window_seconds": settings.qr_window_seconds,
    }


def verify_rotating_jwt(token: str) -> tuple[dict[str, Any] | None, str | None]:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "ref", "tid", "step"]},
        )
    except jwt.ExpiredSignatureError:
        return None, "EXPIRED"
    except jwt.InvalidTokenError:
        return None, "INVALID_SIGNATURE"

    step = int(payload["step"])
    now_step = current_step()
    if step < now_step - 1 or step > now_step + 1:
        return None, "WINDOW_MISMATCH"

    return payload, None
