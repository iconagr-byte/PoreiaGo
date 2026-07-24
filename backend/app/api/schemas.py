from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_id: UUID | None = None
    tenant_slug: str | None = Field(default=None, max_length=64, description="Optional agency code e.g. achillio")
    mfa_code: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: str | None = None
    tenant_id: UUID | None = None
    tenant_slug: str | None = None
    roles: list[str] = Field(default_factory=list)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=16)


class MfaEnrollResponse(BaseModel):
    provisioning_uri: str
    secret: str


class MfaVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class BookingCreate(BaseModel):
    trip_id: UUID | None = None
    passenger_name: str
    passenger_email: EmailStr | None = None
    seat_label: str | None = None
    amount_eur: Decimal = Field(gt=0)
    reference_code: str | None = None
    metadata_json: dict | None = None


class GuestBookingLookup(BaseModel):
    """B2C — recover ticket; requires email + reference (no listing by email alone)."""

    tenant_id: UUID
    passenger_email: EmailStr
    reference_code: str = Field(min_length=4, max_length=32)


class GuestBookingCreate(BaseModel):
    """B2C checkout — no JWT; tenant_id scopes the organization."""

    tenant_id: UUID
    passenger_name: str
    passenger_email: EmailStr | None = None
    seat_label: str | None = None
    amount_eur: Decimal = Field(gt=0)
    external_trip_id: int | None = None
    trip_title: str | None = None
    payment_method: str | None = None
    phone: str | None = None
    seats: list[str] | None = None
    payment_plan: str | None = None
    total_eur: Decimal | None = None
    balance_due: Decimal | None = None
    deposit_percent: int | None = Field(None, ge=5, le=90)


class BookingResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    reference_code: str
    status: str
    payment_status: str
    total_price: Decimal
    amount_paid: Decimal
    amount_eur: Decimal
    passenger_name: str | None = None
    passenger_email: str | None = None
    seat_label: str | None = None
    metadata_json: dict | None = None

    model_config = {"from_attributes": True}


class FiscalInvoiceResponse(BaseModel):
    id: UUID
    booking_id: UUID
    invoice_kind: str
    status: str
    amount: Decimal
    currency: str
    aade_mark: str | None = None
    stripe_payment_intent_id: str | None = None

    model_config = {"from_attributes": True}


class AadeEnqueueRequest(BaseModel):
    booking_id: UUID
    payload: dict = Field(default_factory=dict)
    idempotency_key: str | None = None


class AadeStatusResponse(BaseModel):
    submission_id: UUID
    status: str
    mark: str | None = None


class TelemetryUpdateRequest(BaseModel):
    vehicle_id: str | None = None
    lat: float
    lng: float
    trip_id: UUID | None = None
    speed: float | None = None
    heading: float | None = None
    ts: str | None = None


class TelemetryAcceptedResponse(BaseModel):
    accepted: bool = True
    geofence_events: list[dict] = Field(default_factory=list)


class BillingCheckoutRequest(BaseModel):
    plan: str | None = None
    billing_interval: str = Field(default="month", pattern="^(month|year)$")


class BillingSignupCheckoutRequest(BaseModel):
    legal_name: str = Field(min_length=2, max_length=255)
    admin_email: EmailStr
    subdomain: str = Field(min_length=2, max_length=48, pattern=r"^[a-z0-9-]+$")
    password: str = Field(min_length=8, max_length=128)
    plan: str = Field(default="starter", pattern="^(starter|professional|enterprise)$")
    billing_interval: str = Field(default="month", pattern="^(month|year)$")


class BillingCheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str
    demo: bool = False
    tenant_slug: str | None = None


class BillingPortalResponse(BaseModel):
    portal_url: str


class BillingSubscriptionResponse(BaseModel):
    tenant_id: UUID
    plan: str
    status: str
    is_active: bool
    stripe_customer_id: str | None = None
    stripe_subscription_id: str | None = None
    current_period_end: datetime | None = None
    trial_ends_at: datetime | None = None
    cancel_at_period_end: bool = False
    base_amount_cents: int = 0


class BillingConfigResponse(BaseModel):
    checkout_ready: bool
    portal_ready: bool
    demo_mode: bool = False
    missing_env: list[str] = Field(default_factory=list)
    plans: list[str] = Field(default_factory=list)
    trial_days: int = 14


class BillingTrialRequest(BaseModel):
    plan: str = Field(default="professional", pattern="^(starter|professional)$")
    billing_interval: str = Field(default="month", pattern="^(month|year)$")


class BillingUsageReportResponse(BaseModel):
    active_buses: int
    monthly_trips: int
    period_start: str
    reported_to_stripe: bool


class BillingAnalyticsResponse(BaseModel):
    mrr_cents: int
    mrr_eur: float
    total_tenants: int
    active_tenants: int
    trial_tenants: int
    past_due_tenants: int
    churn_rate_hint: float


class PlatformHealthCheck(BaseModel):
    status: str
    detail: str | None = None


class PlatformHealthResponse(BaseModel):
    status: str
    service: str
    environment: str
    checks: dict[str, PlatformHealthCheck]
    checked_at: str


class PlatformTenantSubscription(BaseModel):
    status: str
    plan: str
    stripe_subscription_id: str | None = None
    current_period_end: datetime | None = None
    trial_ends_at: datetime | None = None
    base_amount_cents: int = 0
    cancel_at_period_end: bool = False


class PlatformTenantSummary(BaseModel):
    id: UUID
    slug: str
    legal_name: str
    vat_number: str | None = None
    subdomain: str
    custom_domain: str | None = None
    plan: str
    is_active: bool
    stripe_customer_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    subscription: PlatformTenantSubscription | None = None
    user_count: int | None = None
    booking_count: int | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    admin_notes: str | None = None
    suspended_at: datetime | None = None
    suspended_reason: str | None = None
    domain_in_registry: bool = False


class PlatformTenantListResponse(BaseModel):
    items: list[PlatformTenantSummary]
    total: int
    offset: int
    limit: int


class PlatformTenantCreateRequest(BaseModel):
    slug: str = Field(min_length=2, max_length=64)
    legal_name: str = Field(min_length=2, max_length=255)
    subdomain: str = Field(min_length=2, max_length=64)
    plan: str = "starter"
    vat_number: str | None = None
    admin_email: EmailStr
    admin_password: str = Field(min_length=8, max_length=128)
    admin_full_name: str = Field(min_length=2, max_length=255)


class PlatformTenantCreateResponse(BaseModel):
    tenant: PlatformTenantSummary
    admin_user_id: UUID


class PlatformTenantUpdateRequest(BaseModel):
    legal_name: str | None = None
    plan: str | None = None
    is_active: bool | None = None
    vat_number: str | None = None
    custom_domain: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    admin_notes: str | None = None


class PlatformOverviewResponse(BaseModel):
    health_status: str
    billing: BillingAnalyticsResponse
    total_users: int
    total_bookings: int
    recent_tenants: list[dict]


class UsageMeteringJobResponse(BaseModel):
    tenants_total: int
    reported: int
    snapshots_only: int
    errors: list[dict] = Field(default_factory=list)


class GdprSubjectRequest(BaseModel):
    subject_email: EmailStr


class GdprExportResponse(BaseModel):
    exported_at: str
    tenant_id: str
    subject_email: str
    user_account: dict | None = None
    bookings: list[dict] = Field(default_factory=list)
    audit_trail_as_actor: list[dict] = Field(default_factory=list)
    counts: dict = Field(default_factory=dict)


class GdprEraseResponse(BaseModel):
    erased_at: str
    subject_email: str
    bookings_anonymized: int
    user_anonymized: bool
    audit_rows_redacted: int
    notification_sent: bool = False


class AuditLogResponse(BaseModel):
    id: str
    tenant_id: str
    actor_id: str | None = None
    actor_email: str | None = None
    action: str
    resource_type: str
    resource_id: str
    ip_address: str | None = None
    user_agent: str | None = None
    before_state: dict | None = None
    after_state: dict | None = None
    detail: str | None = None
    created_at: str | None = None


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    offset: int
    limit: int


class TenantDnsInstructionsResponse(BaseModel):
    cname_host: str
    cname_target: str
    alternate_www_host: str | None = None
    subdomain_cname_host: str | None = None
    subdomain_cname_target: str | None = None
    notes: list[str] = Field(default_factory=list)


class TenantBrandingSettingsResponse(BaseModel):
    display_name: str
    slug: str
    subdomain: str
    platform_domain: str
    subdomain_fqdn: str
    custom_domain: str = ""
    primary_color: str = "#0040df"
    logo_url: str = ""
    css_injection_url: str = ""
    css_injection_inline: str = ""
    checkout_base_url: str = ""
    dns_instructions: TenantDnsInstructionsResponse


class TenantBrandingSettingsUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=255)
    custom_domain: str | None = Field(default=None, max_length=255)
    primary_color: str | None = Field(default=None, max_length=32)
    logo_url: str | None = Field(default=None, max_length=2048)
    css_injection_url: str | None = Field(default=None, max_length=2048)
    css_injection_inline: str | None = Field(default=None, max_length=50_000)
    checkout_base_url: str | None = Field(default=None, max_length=2048)


class TenantSiteAppearanceResponse(BaseModel):
    storage_source: str = "postgres"
    tenant_slug: str | None = None
    logo_url: str = ""
    hero_image_url: str = ""
    hero_badge: str = ""
    hero_title: str = ""
    hero_title_accent: str = ""
    hero_subtitle: str = ""
    hero_search_label: str = ""
    footer_brand_name: str = ""
    footer_copyright: str = ""
    homepage_theme_id: str = "aegean_classic"
    accent_color: str = "#0ea5e9"
    show_fleet_section: bool = True
    show_why_us_section: bool = True


class TenantSiteAppearanceUpdate(BaseModel):
    logo_url: str | None = None
    hero_image_url: str | None = None
    hero_badge: str | None = None
    hero_title: str | None = None
    hero_title_accent: str | None = None
    hero_subtitle: str | None = None
    hero_search_label: str | None = None
    footer_brand_name: str | None = None
    footer_copyright: str | None = None
    homepage_theme_id: str | None = None
    accent_color: str | None = None
    show_fleet_section: bool | None = None
    show_why_us_section: bool | None = None


class TenantPlatformSettingsResponse(BaseModel):
    storage_source: str = "postgres"
    tenant_slug: str | None = None
    company_name: str = "AeroStride Travel"
    support_email: str = "support@aerostride.app"
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
    smtp_from_email: str = "noreply@aerostride.app"
    sms_sender_id: str = "AEROSTRIDE"
    maintenance_mode: bool = False
    checkout_base_url: str = "http://localhost:5173"
    checkout_deposit_enabled: bool = True
    checkout_deposit_percent: int = 30
    checkout_bank_transfer_enabled: bool = True
    checkout_bank_name: str = "Eurobank"
    checkout_bank_beneficiary: str = "AeroStride Travel AE"
    checkout_bank_iban: str = "GR1601101250000000012300695"
    checkout_bank_bic: str = "ERBKGRAA"
    checkout_bank_instructions: str = ""
    checkout_bank_reference_template: str = "VOY-{pnr}"


class TenantPlatformSettingsUpdate(BaseModel):
    company_name: str | None = None
    support_email: str | None = None
    default_locale: str | None = None
    timezone: str | None = None
    abandoned_pending_minutes: int | None = None
    abandoned_recovery_cooldown_hours: int | None = None
    pricing_high_occupancy_threshold: float | None = None
    pricing_high_occupancy_markup_pct: float | None = None
    pricing_low_occupancy_threshold: float | None = None
    pricing_low_occupancy_discount_pct: float | None = None
    master_qr_ttl_hours: int | None = None
    webhook_max_retries: int | None = None
    smtp_from_email: str | None = None
    sms_sender_id: str | None = None
    maintenance_mode: bool | None = None
    checkout_base_url: str | None = None
    checkout_deposit_enabled: bool | None = None
    checkout_deposit_percent: int | None = None
    checkout_bank_transfer_enabled: bool | None = None
    checkout_bank_name: str | None = None
    checkout_bank_beneficiary: str | None = None
    checkout_bank_iban: str | None = None
    checkout_bank_bic: str | None = None
    checkout_bank_instructions: str | None = None
    checkout_bank_reference_template: str | None = None


class ProsvasisFiscalSettingsPublic(BaseModel):
    api_url: str = "https://go.s1cloud.net"
    app_id: str = ""
    series_retail: int = 7001
    series_invoice: int = 7021
    branch: int = 1000
    default_trdr: int = 1
    service_mtrl_code: str = ""
    payment_codes: dict[str, str] = Field(default_factory=dict)
    s1code_configured: bool = False
    bearer_token_configured: bool = False


class EpsilonFiscalSettingsPublic(BaseModel):
    smart_url: str = "https://epsilonsmart.epsilonnet.gr/"
    retail_item_code: str = ""
    wholesale_item_code: str = ""
    jwt_configured: bool = False
    subscription_key_configured: bool = False


class TenantFiscalSettingsResponse(BaseModel):
    storage_source: str = "postgres"
    tenant_slug: str | None = None
    provider: str = "native_aade"
    issuer_vat: str = ""
    series_retail: str = "ΑΠΥ"
    series_invoice: str = "ΤΠΥ"
    prosvasis: ProsvasisFiscalSettingsPublic = Field(default_factory=ProsvasisFiscalSettingsPublic)
    epsilon: EpsilonFiscalSettingsPublic = Field(default_factory=EpsilonFiscalSettingsPublic)


class ProsvasisFiscalSettingsUpdate(BaseModel):
    api_url: str | None = None
    app_id: str | None = None
    s1code: str | None = None
    bearer_token: str | None = None
    series_retail: int | None = None
    series_invoice: int | None = None
    branch: int | None = None
    default_trdr: int | None = None
    service_mtrl_code: str | None = None
    payment_codes: dict[str, str] | None = None


class EpsilonFiscalSettingsUpdate(BaseModel):
    smart_url: str | None = None
    jwt: str | None = None
    subscription_key: str | None = None
    retail_item_code: str | None = None
    wholesale_item_code: str | None = None


class TenantFiscalSettingsUpdate(BaseModel):
    provider: str | None = None
    issuer_vat: str | None = None
    series_retail: str | None = None
    series_invoice: str | None = None
    prosvasis: ProsvasisFiscalSettingsUpdate | None = None
    epsilon: EpsilonFiscalSettingsUpdate | None = None
