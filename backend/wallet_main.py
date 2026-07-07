"""Lightweight API — My Wallet (auth + bookings). Includes SaaS admin auth on /api/v1."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.customer_auth import router as customer_auth_router
from api.customer_bookings import router as customer_bookings_router
from api.email_campaigns_router import router as email_campaigns_router
from api.email_mailbox_router import router as email_mailbox_router
from api.email_settings_router import router as email_settings_router
from api.email_tracking_router import router as email_tracking_router
from api.lost_items_router import router as lost_items_router
from api.ticketing_router import router as ticketing_router
from api.admin_bookings_router import router as admin_bookings_router
from api.payment_notifications_router import router as payment_notifications_router
from api.payment_settings_router import router as payment_settings_router
from api.customer_push_router import router as customer_push_router
try:
    from api.admin_push_router import router as admin_push_router
except ImportError:
    admin_push_router = None
from api.email_retry_router import router as email_retry_router
from api.seat_pricing_router import router as seat_pricing_router
from api.site_appearance_router import router as site_appearance_router
from api.wallet_compat_router import router as wallet_compat_router
from email_client.store import init_email_client_tables
from email_client.sync_worker import start_imap_sync_worker, stop_imap_sync_worker
from email_marketing.store import init_email_marketing_tables
from middleware.domain_tenant import DomainTenantMiddleware
from middleware.tenant import TenantContextMiddleware
from ticketing.db import init_ticketing_db, close_ticketing_db
from ticketing.customer_bookings import seed_customer_bookings_if_empty
from ticketing.lost_items import seed_lost_items_if_empty

try:
    from app.api.router import saas_router
except ImportError:
    saas_router = None

try:
    from api.driver_portal import router as driver_portal_router
except ImportError:
    driver_portal_router = None
try:
    from api.driver_push_router import router as driver_push_router
except ImportError:
    driver_push_router = None

try:
    from api.driver_enterprise_router import router as driver_enterprise_router
except ImportError:
    driver_enterprise_router = None

try:
    from api.expenses_upload_router import router as expenses_upload_router
except ImportError:
    expenses_upload_router = None

try:
    from api.driver_sos_router import router as driver_sos_router
except ImportError:
    driver_sos_router = None

try:
    from api.ws_telemetry import router as ws_telemetry_router
except ImportError:
    ws_telemetry_router = None

try:
    from api.admin_platform import router as admin_platform_router
except ImportError:
    admin_platform_router = None

try:
    from api.passenger_portal import router as passenger_portal_router
except ImportError:
    passenger_portal_router = None

try:
    from api.admin_telemetry import router as admin_telemetry_router
except ImportError:
    admin_telemetry_router = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_ticketing_db()
    await seed_customer_bookings_if_empty()
    await seed_lost_items_if_empty()
    await init_email_marketing_tables()
    await init_email_client_tables()
    start_imap_sync_worker()
    yield
    await stop_imap_sync_worker()
    await close_ticketing_db()


app = FastAPI(
    title="PoreiaGo My Wallet API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TenantContextMiddleware)
app.add_middleware(DomainTenantMiddleware)

app.include_router(wallet_compat_router)
app.include_router(admin_bookings_router)
app.include_router(site_appearance_router)
app.include_router(payment_settings_router)
app.include_router(payment_notifications_router)
app.include_router(customer_push_router)
if admin_push_router:
    app.include_router(admin_push_router)
app.include_router(email_retry_router)
app.include_router(seat_pricing_router)
app.include_router(customer_auth_router)
app.include_router(customer_bookings_router)
app.include_router(ticketing_router)
app.include_router(email_campaigns_router)
app.include_router(email_settings_router)
app.include_router(email_mailbox_router)
app.include_router(email_tracking_router)
app.include_router(lost_items_router)
if saas_router:
    app.include_router(saas_router)
if driver_portal_router:
    app.include_router(driver_portal_router)
if driver_push_router:
    app.include_router(driver_push_router)
if driver_enterprise_router:
    app.include_router(driver_enterprise_router)
if expenses_upload_router:
    app.include_router(expenses_upload_router)
if driver_sos_router:
    app.include_router(driver_sos_router)
if ws_telemetry_router:
    app.include_router(ws_telemetry_router)
if admin_platform_router:
    app.include_router(admin_platform_router)
if passenger_portal_router:
    app.include_router(passenger_portal_router)
if admin_telemetry_router:
    app.include_router(admin_telemetry_router)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "wallet-api",
        "modules": [
            "auth",
            "bookings",
            "ticketing",
            "email_marketing",
            "email_client",
            "compat",
            "saas_v1",
            "driver_portal",
            "driver_enterprise",
            "telemetry_ws",
            "admin_platform",
            "passenger_portal",
            "admin_telemetry",
        ],
    }


@app.get("/")
async def root():
    return {
        "service": "wallet-api",
        "docs": "/docs",
        "health": "/health",
        "hint": "Το frontend τρέχει στο http://localhost:5173 — όχι εδώ.",
    }
