from datetime import datetime
from pydantic import BaseModel, Field


class SafetyStartRequest(BaseModel):
    trip_id: int
    driver_id: str


class MasterQrIssueRequest(BaseModel):
    trip_id: int
    driver_id: str | None = None


class MasterQrIssueResponse(BaseModel):
    qr_payload: str
    trip_id: int
    expires_at: datetime
    manifest_url: str


class MasterQrExchangeRequest(BaseModel):
    qr_raw: str


class MasterQrExchangeResponse(BaseModel):
    access_token: str
    trip_id: int
    manifest_url: str


class TripSyncItem(BaseModel):
    id: int = Field(..., gt=0)
    title: str = ""
    price: float = Field(default=0, ge=0)
    available_seats: int | None = None
    total_seats: int | None = None


class TripsSyncRequest(BaseModel):
    trips: list[TripSyncItem] = Field(default_factory=list)


class TripsSyncResponse(BaseModel):
    synced: int
    skipped: int
    postgres_available: bool
    tenant_id: str | None = None


class SafetyChecklistSubmit(BaseModel):
    verification_id: str
    items: dict[str, str] = Field(description="item_key -> pass|fail|na")
    notes: str | None = None


class SafetyVerificationResponse(BaseModel):
    id: str
    trip_id: int
    status: str
    items: dict[str, str]
