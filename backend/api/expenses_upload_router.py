"""Driver expense receipt upload — multipart form."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from api.driver_portal import require_driver_session
from schemas.driver_enterprise import DriverExpenseUploadResponse
from travel_platform.driver.expense_store import save_driver_expense_upload

router = APIRouter(prefix="/api/expenses", tags=["driver-expenses"])


@router.post("/upload", response_model=DriverExpenseUploadResponse)
async def upload_driver_expense(
    amount: float = Form(...),
    category: str = Form(...),
    description: str | None = Form(default=None),
    receipt: UploadFile | None = File(default=None),
    session_payload: dict = Depends(require_driver_session),
):
    """Fuel / tolls / maintenance receipt with optional camera capture."""
    trip_id = int(session_payload.get("trip_id", 0))
    if not trip_id:
        raise HTTPException(status_code=403, detail="No trip bound to session")

    driver_id = str(session_payload.get("sub") or session_payload.get("driver_id") or "master-qr-driver")
    tenant_id = str(session_payload.get("tenant_id", ""))

    receipt_bytes: bytes | None = None
    if receipt and receipt.filename:
        receipt_bytes = await receipt.read()
        if len(receipt_bytes) > 8 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Receipt image too large (max 8MB)")

    try:
        row = save_driver_expense_upload(
            amount=amount,
            category=category,
            trip_id=trip_id,
            driver_id=driver_id,
            tenant_id=tenant_id,
            description=description,
            receipt_bytes=receipt_bytes,
            receipt_filename=receipt.filename if receipt else None,
            content_type=receipt.content_type if receipt else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return DriverExpenseUploadResponse(
        id=row["id"],
        amount=row["amount"],
        category=row["category"],
        trip_id=row["trip_id"],
        driver_id=row["driver_id"],
        receipt_path=row.get("receipt_path"),
        created_at=datetime.fromisoformat(row["created_at"]),
    )
