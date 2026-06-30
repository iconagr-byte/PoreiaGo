"""Audit helpers for fiscal receipt operations."""

from __future__ import annotations

from typing import Any

from travel_platform.settings.payment_audit_store import append_payment_audit


def record_fiscal_audit(
    *,
    action: str,
    booking_id: str,
    amount_eur: float | None = None,
    actor_id: str | None = None,
    detail: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    return append_payment_audit(
        action=action,
        booking_id=booking_id,
        amount_eur=amount_eur,
        actor_id=actor_id,
        detail=detail,
        metadata=metadata,
    )
