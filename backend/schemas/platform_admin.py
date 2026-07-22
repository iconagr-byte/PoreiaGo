from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


UserRole = Literal["admin", "driver", "agent", "viewer"]


def _empty_to_none(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    return value


def _coerce_nonneg_float(value: Any, default: float) -> float:
    if value is None or (isinstance(value, str) and not value.strip()):
        return default
    try:
        n = float(value)
    except (TypeError, ValueError):
        return default
    if n != n:  # NaN
        return default
    return max(0.0, n)

class PlatformSettingsResponse(BaseModel):
    company_name: str = "PoreiaGo Travel"
    support_email: str = "support@poreiago.app"
    default_locale: str = "el-GR"
    timezone: str = "Europe/Athens"
    abandoned_pending_minutes: int = 60
    abandoned_recovery_cooldown_hours: int = 24
    pricing_high_occupancy_threshold: float = 0.80
    pricing_high_occupancy_markup_pct: float = 10.0
    pricing_low_occupancy_threshold: float = 0.30
    pricing_low_occupancy_discount_pct: float = 5.0
    master_qr_ttl_hours: int = 24
    webhook_max_retries: int = 5
    smtp_from_email: str = "noreply@poreiago.app"
    sms_sender_id: str = "AEROSTRIDE"
    maintenance_mode: bool = False
    checkout_base_url: str = "http://localhost:5173"
    checkout_deposit_enabled: bool = True
    checkout_deposit_percent: int = 30


class PlatformSettingsUpdate(BaseModel):
    company_name: str | None = None
    support_email: str | None = None
    default_locale: str | None = None
    timezone: str | None = None
    abandoned_pending_minutes: int | None = Field(None, ge=15, le=1440)
    abandoned_recovery_cooldown_hours: int | None = Field(None, ge=1, le=168)
    pricing_high_occupancy_threshold: float | None = Field(None, ge=0.5, le=1.0)
    pricing_high_occupancy_markup_pct: float | None = Field(None, ge=0, le=50)
    pricing_low_occupancy_threshold: float | None = Field(None, ge=0, le=0.5)
    pricing_low_occupancy_discount_pct: float | None = Field(None, ge=0, le=30)
    master_qr_ttl_hours: int | None = Field(None, ge=1, le=168)
    webhook_max_retries: int | None = Field(None, ge=1, le=20)
    smtp_from_email: str | None = None
    sms_sender_id: str | None = None
    maintenance_mode: bool | None = None
    checkout_base_url: str | None = None
    checkout_deposit_enabled: bool | None = None
    checkout_deposit_percent: int | None = Field(None, ge=5, le=90)


class PlatformUserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime


class PlatformUserCreate(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=120)
    role: UserRole = "viewer"
    password: str | None = Field(None, min_length=6, max_length=128)


class PlatformUserUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=120)
    role: UserRole | None = None
    is_active: bool | None = None
    password: str | None = Field(None, min_length=6, max_length=128)


class BackupInfoResponse(BaseModel):
    id: str
    filename: str
    size_bytes: int
    created_at: datetime
    includes: list[str]


class BackupCreateResponse(BaseModel):
    backup: BackupInfoResponse
    message: str


class BackupRestoreResponse(BaseModel):
    restored: bool
    message: str
    restored_users: int = 0
    restored_settings: bool = False
    restored_drivers: int = 0


class FleetDriverResponse(BaseModel):
    id: str
    name: str
    license_no: str
    phone: str
    email: str
    hiring_date: date
    status: str
    vehicle_code: str | None = None
    license_plate: str | None = None
    salary_per_km: float = 0.45
    salary_per_trip: float = 25.0
    current_balance: float = 0.0
    safety_score: int = 100
    trips_completed: int = 0
    total_km: float = 0.0
    license_expires_at: date | None = None
    avg_rating: float | None = None
    days_until_license_expiry: int | None = None
    photo_url: str | None = None
    has_password: bool = False


class FleetDriverCreate(BaseModel):
    name: str = Field(..., min_length=2)
    license_no: str = Field(..., min_length=4)
    phone: str = ""
    email: EmailStr
    hiring_date: date | None = None
    status: str = "active"
    vehicle_code: str | None = None
    license_plate: str | None = None
    salary_per_km: float = Field(0.45, ge=0)
    salary_per_trip: float = Field(25.0, ge=0)
    license_expires_at: date | None = None
    photo_url: str | None = None
    password: str = Field(..., min_length=4, max_length=128)

    @field_validator("name", "license_no", "phone", "status", mode="before")
    @classmethod
    def _strip_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("hiring_date", "license_expires_at", "vehicle_code", "license_plate", "photo_url", mode="before")
    @classmethod
    def _blank_optional(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("salary_per_km", mode="before")
    @classmethod
    def _salary_km(cls, value: Any) -> float:
        return _coerce_nonneg_float(value, 0.45)

    @field_validator("salary_per_trip", mode="before")
    @classmethod
    def _salary_trip(cls, value: Any) -> float:
        return _coerce_nonneg_float(value, 25.0)


class FleetDriverUpdate(BaseModel):
    name: str | None = None
    license_no: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    hiring_date: date | None = None
    status: str | None = None
    vehicle_code: str | None = None
    license_plate: str | None = None
    salary_per_km: float | None = Field(None, ge=0)
    salary_per_trip: float | None = Field(None, ge=0)
    license_expires_at: date | None = None
    photo_url: str | None = None
    password: str | None = Field(None, min_length=4)

    @field_validator("hiring_date", "license_expires_at", "vehicle_code", "license_plate", "photo_url", mode="before")
    @classmethod
    def _blank_optional(cls, value: Any) -> Any:
        return _empty_to_none(value)

    @field_validator("salary_per_km", "salary_per_trip", mode="before")
    @classmethod
    def _salary_optional(cls, value: Any) -> Any:
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        try:
            n = float(value)
        except (TypeError, ValueError):
            return None
        if n != n:
            return None
        return max(0.0, n)

class VehicleProfileResponse(BaseModel):
    id: str
    make: str
    model: str
    plate_number: str
    year: int
    vin: str
    current_odometer: float
    last_service_date: date
    last_service_mileage: float
    service_interval_km: int = 15000
    service_interval_days: int = 365
    next_service_threshold: float | None = None
    legal_deadline: date | None = None
    insurance_due_date: date | None = None
    purchase_price: float = 100000.0
    fuel_cost_total: float = 0.0
    insurance_cost_total: float = 0.0
    category: str = "Standard"
    seat_count: int = 49
    amenities: list[str] = []
    public_image_url: str = ""
    public_summary: str = ""
    show_on_website: bool = True
    service_status: str
    km_to_service: float
    days_to_legal_deadline: int | None = None
    created_at: datetime
    updated_at: datetime


class VehicleCreate(BaseModel):
    id: str | None = None
    make: str = Field(..., min_length=2)
    model: str = Field(..., min_length=1)
    plate_number: str = Field(..., min_length=4)
    year: int = Field(..., ge=1990, le=2100)
    vin: str = Field(..., min_length=8)
    current_odometer: float = Field(0, ge=0)
    last_service_date: date | None = None
    last_service_mileage: float | None = Field(None, ge=0)
    service_interval_km: int = Field(15000, ge=1000)
    service_interval_days: int = Field(365, ge=30)
    next_service_threshold: float | None = Field(None, ge=0)
    legal_deadline: date | None = None
    insurance_due_date: date | None = None
    purchase_price: float = Field(100000, ge=0)
    fuel_cost_total: float = Field(0, ge=0)
    insurance_cost_total: float = Field(0, ge=0)
    category: str = "Standard"
    seat_count: int = Field(49, ge=8, le=80)
    amenities: list[str] = Field(default_factory=list)
    public_image_url: str = ""
    public_summary: str = ""
    show_on_website: bool = True


class VehicleUpdate(BaseModel):
    make: str | None = None
    model: str | None = None
    plate_number: str | None = None
    year: int | None = Field(None, ge=1990, le=2100)
    vin: str | None = None
    current_odometer: float | None = Field(None, ge=0)
    last_service_date: date | None = None
    last_service_mileage: float | None = Field(None, ge=0)
    service_interval_km: int | None = Field(None, ge=1000)
    service_interval_days: int | None = Field(None, ge=30)
    next_service_threshold: float | None = Field(None, ge=0)
    legal_deadline: date | None = None
    insurance_due_date: date | None = None
    purchase_price: float | None = Field(None, ge=0)
    fuel_cost_total: float | None = Field(None, ge=0)
    insurance_cost_total: float | None = Field(None, ge=0)
    category: str | None = None
    seat_count: int | None = Field(None, ge=8, le=80)
    amenities: list[str] | None = None
    public_image_url: str | None = None
    public_summary: str | None = None
    show_on_website: bool | None = None


class MaintenanceEventResponse(BaseModel):
    id: str
    vehicle_id: str
    event_date: date
    mileage: float
    service_type: str
    description: str
    cost: float
    shop_or_mechanic: str
    driver_id: str | None = None
    driver_name: str | None = None
    parts_replaced: list[str] = Field(default_factory=list)
    next_service_date: date | None = None
    next_service_threshold: float | None = None
    attachments: list[dict] = Field(default_factory=list)
    created_at: datetime


class MaintenanceEventCreate(BaseModel):
    vehicle_id: str
    event_date: date | None = None
    mileage: float = Field(..., ge=0)
    service_type: str = "other"
    description: str = ""
    cost: float = Field(0, ge=0)
    shop_or_mechanic: str = ""
    driver_id: str | None = None
    driver_name: str | None = None
    parts_replaced: list[str] = Field(default_factory=list)
    next_service_date: date | None = None
    next_service_threshold: float | None = Field(None, ge=0)


class FleetAlertResponse(BaseModel):
    id: str
    vehicle_id: str
    plate_number: str
    kind: str
    severity: str
    title: str
    message: str
    created_at: datetime
    resolved: bool


class DispatchBlockedRequest(BaseModel):
    plate: str = Field(..., min_length=2)
    reason: str = Field(..., min_length=3)
    trip_title: str | None = None


class AbandonedCartUpsert(BaseModel):
    resume_token: str | None = None
    trip_id: int
    trip_title: str = Field(..., min_length=1)
    seats: str = ""
    amount_eur: float = Field(..., gt=0)
    passenger_name: str = ""
    passenger_email: str | None = None
    passenger_phone: str | None = None


class AbandonedCartResponse(BaseModel):
    id: str
    resume_token: str
    trip_id: int
    trip_title: str
    seats: str
    amount_eur: float
    passenger_name: str
    passenger_email: str
    passenger_phone: str
    created_at: str
    updated_at: str
    recovery_sent_at: str | None = None
    completed_at: str | None = None


class AbandonedScanRequest(BaseModel):
    base_url: str | None = None
    pending_minutes: int | None = Field(None, ge=1, le=1440)


class AbandonedScanResponse(BaseModel):
    candidates: int
    sent: int
    errors: list[str] = []


class BrandingAdminResponse(BaseModel):
    slug: str
    display_name: str
    logo_url: str = ""
    primary_color: str = "#0040df"
    custom_domain: str = ""
    css_injection_url: str = ""
    css_injection_inline: str = ""
    verified_domain: bool = False
    checkout_base_url: str = "http://localhost:5173"
    updated_at: str | None = None


class BrandingAdminUpdate(BaseModel):
    display_name: str | None = None
    slug: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None
    custom_domain: str | None = None
    css_injection_url: str | None = None
    css_injection_inline: str | None = Field(None, max_length=50_000)
    verified_domain: bool | None = None
    checkout_base_url: str | None = None


class PartnerWebhookCreate(BaseModel):
    partner_name: str = Field(..., min_length=2)
    target_url: str = Field(..., min_length=8)
    event_types: list[str] = Field(..., min_length=1)


class PartnerWebhookResponse(BaseModel):
    id: str
    partner_name: str
    target_url: str
    event_types: list[str]
    active: bool = True
    created_at: str | None = None


class PartnerDispatchRequest(BaseModel):
    event_type: str
    payload: dict = Field(default_factory=dict)


class PartnerDispatchResponse(BaseModel):
    event_id: str
    delivered: int
    results: list[dict] = []


class MasterQrIssueRequest(BaseModel):
    trip_id: int = Field(..., gt=0)
    driver_id: str | None = None


class MasterQrIssueResponse(BaseModel):
    qr_content: str
    qr_token: str | None = None
    auth_url: str | None = None
    trip_id: int
    tenant_id: str
    expires_at: int
    manifest_url: str
    source: str = "local"


class DriverShiftPushRequest(BaseModel):
    trip_id: int = Field(..., gt=0)
    driver_id: str | None = None
    message: str | None = Field(default=None, max_length=240)
    trip_title: str | None = Field(default=None, max_length=120)


class DriverShiftPushResponse(BaseModel):
    ok: bool
    auth_url: str
    expires_at: int
    trip_id: int
    push: dict = Field(default_factory=dict)


class TripSyncItem(BaseModel):
    id: int = Field(..., gt=0)
    title: str = ""
    price: float = Field(default=0, ge=0)
    available_seats: int | None = None
    total_seats: int | None = None


class TripsSyncRequest(BaseModel):
    tenant_id: str | None = None
    trips: list[TripSyncItem] = Field(default_factory=list)


class TripsSyncResponse(BaseModel):
    synced: int
    skipped: int
    postgres_available: bool
    tenant_id: str | None = None


class PricingQuotePublicResponse(BaseModel):
    trip_id: int
    base_price_eur: float
    final_price_eur: float
    occupancy_ratio: float
    sold_seats: int
    total_seats: int
    applied_rule: str | None = None
    adjustment_pct: float = 0


class FleetCostReportResponse(BaseModel):
    vehicle_id: str
    date_from: date
    date_to: date
    maintenance_total: float
    fuel_total: float
    insurance_total: float
    total: float
    event_count: int


class FleetDepreciationResponse(BaseModel):
    vehicle_id: str
    as_of: date
    purchase_price: float
    age_years: int
    current_odometer: float
    estimated_book_value: float
    mileage_factor: float
