"""
Driver PWA enterprise endpoints — check-in & pre-trip inspection.
Mounted at /api/driver (same prefix as driver_portal).
"""

from __future__ import annotations

import hashlib
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse

from api.driver_portal import require_driver_session
from schemas.driver_enterprise import (
    DriverCheckinRequest,
    DriverCheckinResponse,
    DriverInspectionRequest,
    DriverInspectionResponse,
)
from travel_platform.driver.checkin_service import driver_checkin
from travel_platform.driver.inspection_store import save_pre_trip_inspection

router = APIRouter(prefix="/api/driver", tags=["driver-enterprise"])


def _token_fingerprint(authorization: str | None) -> str | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return hashlib.sha256(authorization[7:].strip().encode("utf-8")).hexdigest()[:16]


@router.post("/checkin", response_model=DriverCheckinResponse)
async def driver_checkin_endpoint(
    body: DriverCheckinRequest,
    session_payload: dict = Depends(require_driver_session),
):
    """Scan passenger ticket → validate trip → mark BOARDED."""
    trip_id = int(session_payload.get("trip_id", 0))
    if not trip_id:
        raise HTTPException(status_code=403, detail="No trip bound to session")

    result = await driver_checkin(
        trip_id=trip_id,
        ticket_id=body.ticket_id,
        qr_raw=body.qr_raw,
    )
    if result.get("result") == "FAILURE":
        code = 409 if result.get("reason") == "ALREADY_SCANNED" else 400
        return JSONResponse(status_code=code, content=result)
    return DriverCheckinResponse(**result)


@router.post("/inspection", response_model=DriverInspectionResponse)
async def driver_inspection_endpoint(
    body: DriverInspectionRequest,
    session_payload: dict = Depends(require_driver_session),
    authorization: str | None = Header(default=None),
):
    """Mandatory pre-trip safety checklist before shift start."""
    trip_id = int(session_payload.get("trip_id", 0))
    if not trip_id:
        raise HTTPException(status_code=403, detail="No trip bound to session")

    driver_id = str(session_payload.get("sub") or session_payload.get("driver_id") or "master-qr-driver")
    tenant_id = str(session_payload.get("tenant_id", ""))

    try:
        row = save_pre_trip_inspection(
            trip_id=trip_id,
            driver_id=driver_id,
            tenant_id=tenant_id,
            items=body.items,
            notes=body.notes,
            driver_token_hash=_token_fingerprint(authorization),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    completed_at = datetime.fromisoformat(row["completed_at"])
    return DriverInspectionResponse(
        id=row["id"],
        trip_id=row["trip_id"],
        driver_id=row["driver_id"],
        status=row["status"],
        items=row["items"],
        completed_at=completed_at,
        cleared_for_shift=row["cleared_for_shift"],
    )
