import time

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse

from ticketing.config import settings
from ticketing.qr_rotating import issue_rotating_jwt
from ticketing.scan_service import get_booking_by_id, process_scan
from ticketing.cancel_service import cancel_ticket_booking
from ticketing.boarding_service import get_boarding_manifest
from ticketing.offline_pki import build_offline_manifest
from ticketing.sms_jobs import dispatch_pre_departure_sms
from ticketing.saas_sync import upsert_ticket_booking
from ticketing.ticket_email import send_ticket_confirmation_email
from ticketing.schemas import (
    OfflineScanItem,
    OfflineScanSyncResponse,
    ScanRequest,
    ScanResponse,
    RotatingQrResponse,
    TicketSyncRequest,
    TicketEmailRequest,
)

router = APIRouter(tags=["ticketing"])


async def verify_driver(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing driver token")
    token = authorization[7:].strip()
    if token not in settings.driver_keys_set():
        raise HTTPException(status_code=403, detail="Invalid driver credentials")
    return token


@router.post("/api/tickets/sync")
async def sync_ticket_from_checkout(body: TicketSyncRequest):
    """Register checkout booking for rotating QR + driver scan."""
    booking = await upsert_ticket_booking(
        local_id=body.id,
        trip_id=body.trip_id,
        customer_name=body.customer_name,
        seat_number=body.seat_number,
        payment_status=body.payment_status,
        phone=body.phone,
        departure_at=body.departure_at,
        saas_booking_id=body.saas_booking_id,
        email=body.email,
    )
    return {"ok": True, "booking_id": booking.get("id"), "ticket_ref": booking.get("ticket_ref")}


@router.post("/api/tickets/{booking_id}/cancel")
async def cancel_ticket(booking_id: str):
    """Mark booking cancelled — invalidates scan/QR."""
    booking = await cancel_ticket_booking(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    try:
        from travel_platform.growth.partner_store import dispatch_event

        dispatch_event(
            "booking.cancelled",
            {
                "booking_id": booking["id"],
                "trip_id": booking["trip_id"],
                "passenger_name": booking.get("customer_name"),
                "seat_number": booking.get("seat_number"),
            },
        )
    except Exception:
        pass
    return {"ok": True, "booking_id": booking["id"], "status": "CANCELLED"}


@router.get("/api/tickets/{booking_id}/qr", response_model=RotatingQrResponse)
async def get_rotating_qr(booking_id: str):
    """Issue short-lived JWT for rotating QR display."""
    booking = await get_booking_by_id(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if "CANCELLED" in booking["payment_status"].upper():
        raise HTTPException(status_code=410, detail="Booking cancelled")
    if "PAID" not in booking["payment_status"].upper():
        raise HTTPException(status_code=402, detail="Booking not paid")
    data = issue_rotating_jwt(booking["ticket_ref"], booking["trip_id"])
    return RotatingQrResponse(**data)


@router.post("/api/tickets/{booking_id}/email")
async def email_ticket(booking_id: str, body: TicketEmailRequest):
    """Send ticket confirmation to the customer's declared email."""
    payload = body.model_dump()
    payload["booking_id"] = payload.get("booking_id") or booking_id
    if not payload.get("pnr"):
        payload["pnr"] = booking_id
    try:
        return await send_ticket_confirmation_email(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Email failed: {exc}") from exc


@router.post("/admin/scan", response_model=ScanResponse)
async def admin_scan(body: ScanRequest, _: str = Depends(verify_driver)):
    start = time.perf_counter()
    result = await process_scan(body.qr.strip(), body.trip_id)
    elapsed_ms = (time.perf_counter() - start) * 1000
    result["elapsed_ms"] = round(elapsed_ms, 2)
    if elapsed_ms > 200:
        result["performance_warning"] = "exceeded_200ms_target"
    if result["result"] == "FAILURE":
        code = 409 if result.get("reason") == "ALREADY_SCANNED" else 400
        return JSONResponse(status_code=code, content=result)
    return ScanResponse(**result)


@router.get("/admin/boarding/{trip_id}")
async def live_boarding_view(trip_id: int, _: str = Depends(verify_driver)):
    return await get_boarding_manifest(trip_id)


@router.get("/admin/offline-manifest")
async def offline_manifest(trip_id: int, _: str = Depends(verify_driver)):
    return await build_offline_manifest(trip_id)


@router.post("/admin/sms/pre-departure/{trip_id}")
async def trigger_pre_departure_sms(trip_id: int, _: str = Depends(verify_driver)):
    return await dispatch_pre_departure_sms(trip_id, settings.pre_departure_minutes)


@router.post("/admin/scan/offline-sync", response_model=OfflineScanSyncResponse)
async def sync_offline_scans(
    items: list[OfflineScanItem],
    _: str = Depends(verify_driver),
):
    """Replay scans collected while offline (driver PWA)."""
    results: list[dict] = []
    for item in items:
        r = await process_scan(item.qr.strip(), item.trip_id)
        results.append(r)
    return OfflineScanSyncResponse(synced=len(results), results=[ScanResponse(**r) for r in results])
