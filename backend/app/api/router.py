from fastapi import APIRouter

from app.api.aade import router as aade_router
from app.api.api_keys import router as api_keys_router
from app.api.auth import router as auth_router
from app.api.billing import router as billing_router
from app.api.branding import router as branding_router
from app.api.booking_payments import router as booking_payments_router
from app.api.bookings import router as bookings_router
from app.api.compliance import router as compliance_router
from app.api.health import router as health_router
from app.api.payments_webhook import router as payments_webhook_router
from app.api.platform import router as platform_router
from app.api.telemetry import router as telemetry_router
from app.api.tenant_settings import router as tenant_settings_router
from app.api.fiscal_settings import router as fiscal_settings_router
from app.api.metrics import router as metrics_router

saas_router = APIRouter(prefix="/api/v1")
saas_router.include_router(health_router)
saas_router.include_router(metrics_router)
saas_router.include_router(auth_router)
saas_router.include_router(billing_router)
saas_router.include_router(branding_router)
saas_router.include_router(tenant_settings_router)
saas_router.include_router(fiscal_settings_router)
saas_router.include_router(platform_router)
saas_router.include_router(payments_webhook_router)
saas_router.include_router(bookings_router)
saas_router.include_router(booking_payments_router)
saas_router.include_router(compliance_router)
saas_router.include_router(aade_router)
saas_router.include_router(api_keys_router)
saas_router.include_router(telemetry_router)
