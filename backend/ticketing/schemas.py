from pydantic import BaseModel, EmailStr, Field
from typing import Any


class ScanRequest(BaseModel):
    qr: str = Field(..., min_length=10)
    trip_id: int


class ScanResponse(BaseModel):
    result: str
    reason: str | None = None
    message: str | None = None
    booking_id: str | None = None
    passenger_name: str | None = None
    seat_number: str | None = None
    special_requirements: dict[str, Any] | None = None
    elapsed_ms: float | None = None
    performance_warning: str | None = None


class TicketSyncRequest(BaseModel):
    id: str
    trip_id: int
    customer_name: str
    seat_number: str
    payment_status: str = "PAID"
    phone: str | None = None
    departure_at: str | None = None
    saas_booking_id: str | None = None
    email: str | None = None


class RotatingQrResponse(BaseModel):
    token: str
    expires_in: int
    step: int
    window_seconds: int


class OfflineScanItem(BaseModel):
    qr: str = Field(..., min_length=10)
    trip_id: int
    scanned_at: str | None = None


class OfflineScanSyncResponse(BaseModel):
    synced: int
    results: list[ScanResponse]


class BoardingManifestResponse(BaseModel):
    trip_id: int
    capacity: int
    booked_count: int
    boarded_count: int
    progress_label: str
    progress_percent: float
    missing_passengers: list[dict[str, Any]]
    boarded_passengers: list[dict[str, Any]]
    alerts: list[dict[str, str]]


class TicketEmailRequest(BaseModel):
    email: EmailStr | None = None
    customer_name: str = ""
    trip_title: str = ""
    date: str = ""
    time: str | None = None
    seat: str = ""
    pnr: str = ""
    booking_id: str = ""
    price: float | None = None
    base_price: float | None = None
    taxes: float | None = None
    payment_method: str | None = None
    payment_status: str | None = None
    phone: str | None = None
