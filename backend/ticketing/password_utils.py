"""Password hashing — ίδιο format με app.services.auth_service (+ optional iterations)."""

from __future__ import annotations

import hashlib
import secrets

# Customer / SaaS default (legacy hashes without an iterations field use this).
DEFAULT_PBKDF2_ITERATIONS = 120_000
# Driver PWA passwords — still PBKDF2, ~3× faster create/update on small VPS CPUs.
DRIVER_PBKDF2_ITERATIONS = 40_000


def hash_password(password: str, *, iterations: int = DEFAULT_PBKDF2_ITERATIONS) -> str:
    iters = max(10_000, int(iterations))
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), iters)
    return f"pbkdf2_sha256${iters}${salt}${digest.hex()}"


def _parse_stored(stored: str) -> tuple[str, int, str, str] | None:
    """Return (algo, iterations, salt, digest_hex) or None."""
    parts = stored.split("$")
    if len(parts) == 4:
        algo, iter_s, salt, digest_hex = parts
        try:
            iterations = int(iter_s)
        except ValueError:
            return None
        return algo, iterations, salt, digest_hex
    if len(parts) == 3:
        # Legacy: pbkdf2_sha256$salt$digest (implied 120_000)
        algo, salt, digest_hex = parts
        return algo, DEFAULT_PBKDF2_ITERATIONS, salt, digest_hex
    return None


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        parsed = _parse_stored(stored)
        if not parsed:
            return False
        algo, iterations, salt, digest_hex = parsed
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode(),
            salt.encode(),
            iterations,
        )
        return secrets.compare_digest(digest.hex(), digest_hex)
    except ValueError:
        return False
