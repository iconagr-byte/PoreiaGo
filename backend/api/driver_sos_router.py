"""Driver SOS — Redis fleet_alerts + admin WebSocket."""

from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile

from api.driver_portal import require_driver_session
from schemas.driver_enterprise import DriverSosRequest, DriverSosResponse
from travel_platform.driver.sos_service import publish_driver_sos

router = APIRouter(prefix="/api/telemetry", tags=["driver-sos"])

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
SOS_UPLOAD_DIR = DATA_DIR / "uploads" / "driver_sos"


@router.post("/sos", response_model=DriverSosResponse)
async def driver_sos_json(
    body: DriverSosRequest,
    session_payload: dict = Depends(require_driver_session),
    authorization: str | None = Header(default=None),
):
    """Urgent SOS — publishes to Redis fleet_alerts channel."""
    trip_id = int(session_payload.get("trip_id", 0))
    if not trip_id:
        raise HTTPException(status_code=403, detail="No trip bound to session")

    driver_id = session_payload.get("sub") or session_payload.get("driver_id")
    tenant_id = str(session_payload.get("tenant_id", ""))
    token = authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else None

    result = await publish_driver_sos(
        tenant_id=tenant_id,
        trip_id=trip_id,
        driver_id=str(driver_id) if driver_id else None,
        lat=body.lat,
        lng=body.lng,
        accuracy_m=body.accuracy_m,
        message=body.message,
        incident_type=body.incident_type or "sos",
        driver_token=token,
    )
    return DriverSosResponse(**result)


@router.post("/sos/upload", response_model=DriverSosResponse)
async def driver_sos_with_photo(
    lat: float = Form(...),
    lng: float = Form(...),
    accuracy_m: float | None = Form(default=None),
    message: str | None = Form(default=None),
    incident_type: str = Form(default="sos"),
    photo: UploadFile | None = File(default=None),
    session_payload: dict = Depends(require_driver_session),
    authorization: str | None = Header(default=None),
):
    """SOS with optional incident photo from mobile camera."""
    trip_id = int(session_payload.get("trip_id", 0))
    if not trip_id:
        raise HTTPException(status_code=403, detail="No trip bound to session")

    photo_path: str | None = None
    if photo and photo.filename:
        SOS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        ext = Path(photo.filename).suffix or ".jpg"
        fname = f"{uuid4()}{ext}"
        dest = SOS_UPLOAD_DIR / fname
        content = await photo.read()
        if len(content) > 8 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Photo too large (max 8MB)")
        dest.write_bytes(content)
        photo_path = str(dest.relative_to(DATA_DIR)).replace("\\", "/")

    driver_id = session_payload.get("sub") or session_payload.get("driver_id")
    tenant_id = str(session_payload.get("tenant_id", ""))
    token = authorization[7:].strip() if authorization and authorization.startswith("Bearer ") else None

    result = await publish_driver_sos(
        tenant_id=tenant_id,
        trip_id=trip_id,
        driver_id=str(driver_id) if driver_id else None,
        lat=lat,
        lng=lng,
        accuracy_m=accuracy_m,
        message=message,
        incident_type=incident_type,
        photo_path=photo_path,
        driver_token=token,
    )
    return DriverSosResponse(**result)
