import os
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from api.ticketing_router import router as ticketing_router
from api.abandoned_public import router as abandoned_public_router
from api.branding_public import router as branding_public_router
from api.admin_bookings_router import router as admin_bookings_router
from api.site_appearance_router import router as site_appearance_router
from api.customer_auth import router as customer_auth_router
from api.customer_bookings import router as customer_bookings_router
from middleware.domain_tenant import DomainTenantMiddleware
from middleware.tenant import TenantContextMiddleware
from ticketing.db import init_ticketing_db, close_ticketing_db
from ticketing.seed import seed_if_empty
from ticketing.customer_bookings import seed_customer_bookings_if_empty
from ticketing.lost_items import seed_lost_items_if_empty


# Explicit origins required when allow_credentials=True (browsers reject "*").
_DEFAULT_CORS_ORIGINS = (
    "https://www.poreiago.com,"
    "https://poreiago.com,"
    "http://localhost:5173,"
    "http://localhost:3000,"
    "http://127.0.0.1:5173,"
    "http://127.0.0.1:3000"
)


def _cors_origins() -> list[str]:
    raw = (os.getenv("CORS_ORIGINS") or _DEFAULT_CORS_ORIGINS).strip()
    return [o.strip() for o in raw.split(",") if o.strip()]

try:
    from api.bookings import router as bookings_router
except (ImportError, SyntaxError):
    bookings_router = None

try:
    from api.v1.router import platform_router
except ImportError:
    platform_router = None

try:
    from app.api.router import saas_router
except ImportError:
    saas_router = None

try:
    from api.driver_portal import router as driver_portal_router
except ImportError:
    driver_portal_router = None

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
    from api.driver_chat_router import router as driver_chat_router
except ImportError:
    driver_chat_router = None

try:
    from api.admin_platform import router as admin_platform_router
except ImportError:
    admin_platform_router = None

try:
    from api.admin_telemetry import router as admin_telemetry_router
except ImportError:
    admin_telemetry_router = None

try:
    from api.telemetry_router import ingest_router as telemetry_ingest_router
except ImportError:
    telemetry_ingest_router = None

try:
    from api.passenger_portal import router as passenger_portal_router
except ImportError:
    passenger_portal_router = None

# WebSocket GPS must load independently — do not bundle with unrelated imports.
try:
    from api.seat_pricing_router import router as seat_pricing_router
except ImportError:
    seat_pricing_router = None

try:
    from api.rent_plan_catalog_router import router as rent_plan_catalog_router
except ImportError:
    rent_plan_catalog_router = None

try:
    from api.agency_plan_catalog_router import router as agency_plan_catalog_router
except ImportError:
    agency_plan_catalog_router = None

try:
    from api.ws_telemetry import router as ws_telemetry_router
except ImportError as exc:
    import logging as _logging

    _logging.getLogger(__name__).exception(
        "ws_telemetry router failed to import — live map WebSockets disabled: %s",
        exc,
    )
    ws_telemetry_router = None

try:
    from api.email_settings_router import router as email_settings_router
except ImportError:
    email_settings_router = None

try:
    from api.email_campaigns_router import router as email_campaigns_router
except ImportError:
    email_campaigns_router = None

try:
    from api.email_mailbox_router import router as email_mailbox_router
except ImportError:
    email_mailbox_router = None

try:
    from api.email_tracking_router import router as email_tracking_router
except ImportError:
    email_tracking_router = None

try:
    from api.email_retry_router import router as email_retry_router
except ImportError:
    email_retry_router = None

try:
    from travel_platform.telemetry.eta_intelligence import start_eta_refresh_loop
    from travel_platform.telemetry.processor import get_live_fleet, process_telemetry_payload
    from travel_platform.telemetry.queue import start_consumer
except ImportError:
    start_eta_refresh_loop = None
    get_live_fleet = None
    start_consumer = None
    process_telemetry_payload = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # P0: refuse weak secrets / misconfig before serving traffic in production.
    try:
        from app.core.production_guard import (
            assert_production_safe_or_raise,
            collect_production_boot_warnings,
            is_production_env,
        )

        assert_production_safe_or_raise()
        if is_production_env():
            for warn in collect_production_boot_warnings():
                __import__("logging").getLogger("poreiago.startup").warning("%s", warn)
    except RuntimeError:
        raise
    except Exception as exc:
        __import__("logging").getLogger("poreiago.startup").warning(
            "Production guard skipped: %s", exc
        )
    await init_ticketing_db()
    await seed_if_empty()
    await seed_customer_bookings_if_empty()
    try:
        await seed_lost_items_if_empty()
    except Exception as exc:
        __import__("logging").getLogger("poreiago.startup").warning(
            "Lost-items seed skipped: %s", exc
        )
    try:
        from email_client.store import init_email_client_tables
        from email_marketing.store import init_email_marketing_tables

        await init_email_marketing_tables()
        await init_email_client_tables()
    except Exception as exc:
        __import__("logging").getLogger("poreiago.startup").warning(
            "Email client/marketing tables skipped: %s", exc
        )
    try:
        from email_client.sync_worker import start_imap_sync_worker

        start_imap_sync_worker()
    except Exception as exc:
        __import__("logging").getLogger("poreiago.startup").warning(
            "IMAP sync worker skipped: %s", exc
        )
    try:
        from travel_platform.notifications.web_push_service import ensure_web_push_keys

        if ensure_web_push_keys():
            logger = __import__("logging").getLogger("poreiago.startup")
            logger.info("Web Push VAPID configured")
        else:
            logger = __import__("logging").getLogger("poreiago.startup")
            logger.warning("Web Push VAPID not configured — admin/driver push disabled")
    except Exception as exc:
        logger = __import__("logging").getLogger("poreiago.startup")
        logger.warning("Web Push VAPID bootstrap failed: %s", exc)
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.tenant_modules import ensure_known_office_rent_modules

        async with AsyncSessionLocal() as session:
            rent_sync = await ensure_known_office_rent_modules(session)
            if rent_sync.get("achillio_rent_disabled") or rent_sync.get("poreiago_rent_enabled"):
                __import__("logging").getLogger("poreiago.startup").info(
                    "Office Rent policy synced: %s", rent_sync
                )
    except Exception as exc:
        __import__("logging").getLogger("poreiago.startup").warning(
            "Office Rent policy sync skipped: %s", exc
        )
    try:
        from travel_platform.settings.drivers_store import (
            purge_seed_demo_drivers,
            seal_cross_office_driver_uniqueness,
        )

        purged = purge_seed_demo_drivers()
        if purged:
            __import__("logging").getLogger("poreiago.startup").info(
                "Purged %s seed demo drivers from fleet store", purged
            )
        sealed = seal_cross_office_driver_uniqueness()
        if sealed.get("removed"):
            __import__("logging").getLogger("poreiago.startup").info(
                "SEAL cross-office drivers: removed %s DEMO duplicate(s)", sealed["removed"]
            )
        if sealed.get("skipped_real_conflicts"):
            __import__("logging").getLogger("poreiago.startup").warning(
                "SEAL: %s real-office driver conflict(s) left for manual review",
                sealed["skipped_real_conflicts"],
            )
    except Exception as exc:
        __import__("logging").getLogger("poreiago.startup").warning(
            "Seed demo driver purge / SEAL skipped: %s", exc
        )
    try:
        from travel_platform.settings.drivers_store import repair_achillio_home_drivers

        repaired = await repair_achillio_home_drivers()
        __import__("logging").getLogger("poreiago.startup").info(
            "Achillio driver rehome: %s", repaired
        )
    except Exception as exc:
        __import__("logging").getLogger("poreiago.startup").warning(
            "Achillio driver rehome skipped: %s", exc
        )
    try:
        from app.core.database import AsyncSessionLocal
        from travel_platform.growth.traefik_domains import sync_traefik_custom_domains_from_db

        async with AsyncSessionLocal() as session:
            synced = await sync_traefik_custom_domains_from_db(session)
            if synced:
                __import__("logging").getLogger("poreiago.startup").info(
                    "Traefik custom domains synced: %s", ", ".join(synced)
                )
    except Exception as exc:
        __import__("logging").getLogger("poreiago.startup").warning(
            "Traefik custom-domain sync skipped: %s", exc
        )
    try:
        # Fleet KPIs / route playback use root `database.AsyncSessionLocal`.
        from database import AsyncSessionLocal as RootSessionLocal
        from travel_platform.telemetry.ensure_gps_schema import ensure_trip_coordinates_schema

        async with RootSessionLocal() as session:
            await ensure_trip_coordinates_schema(session)
    except Exception as gps_exc:
        __import__("logging").getLogger("poreiago.startup").warning(
            "GPS schema ensure skipped: %s", gps_exc
        )
    if start_consumer and process_telemetry_payload:
        await start_consumer(process_telemetry_payload)
    try:
        from travel_platform.telemetry.coordinate_flush_worker import start_coordinate_flush_worker

        start_coordinate_flush_worker()
    except ImportError:
        pass
    try:
        from travel_platform.telemetry.stale_driver_watcher import start_stale_driver_watcher

        start_stale_driver_watcher()
    except ImportError:
        pass
    try:
        from travel_platform.telemetry.gps_retention_worker import start_gps_retention_worker

        start_gps_retention_worker()
    except ImportError:
        pass
    try:
        from travel_platform.telemetry.fleet_digest_worker import start_fleet_digest_worker

        start_fleet_digest_worker()
    except ImportError:
        pass
    try:
        from travel_platform.telemetry.fleet_alerts_bridge import start_fleet_alerts_bridge

        start_fleet_alerts_bridge()
    except ImportError:
        pass
    if start_eta_refresh_loop and get_live_fleet:
        from travel_platform.telemetry.settings_store import apply_telemetry_settings_to_services

        apply_telemetry_settings_to_services()
        await start_eta_refresh_loop(get_live_fleet())
    yield
    try:
        from email_client.sync_worker import stop_imap_sync_worker

        await stop_imap_sync_worker()
    except Exception:
        pass
    await close_ticketing_db()


app = FastAPI(
    title="PoreiaGo Travel Platform API",
    description="QR ticketing, boarding, fleet telemetry, multi-tenant SaaS.",
    version="2.0.0",
    lifespan=lifespan,
    docs_url=None if os.getenv("ENVIRONMENT", "").lower() in ("production", "prod") else "/docs",
    redoc_url=None if os.getenv("ENVIRONMENT", "").lower() in ("production", "prod") else "/redoc",
    openapi_url=(
        None if os.getenv("ENVIRONMENT", "").lower() in ("production", "prod") else "/openapi.json"
    ),
)

# Inner → outer: tenant/domain auth first, CORS last so it is outermost.
# Starlette runs the last-added middleware first; CORS must wrap 401s and
# answer OPTIONS preflight before TenantContextMiddleware requires JWT.
app.add_middleware(TenantContextMiddleware)
app.add_middleware(DomainTenantMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ticketing_router)
app.include_router(abandoned_public_router)
app.include_router(branding_public_router)
app.include_router(admin_bookings_router)
app.include_router(site_appearance_router)
app.include_router(customer_auth_router)
app.include_router(customer_bookings_router)
try:
    from api.lost_items_router import router as lost_items_router
except ImportError:
    lost_items_router = None
if lost_items_router:
    app.include_router(lost_items_router)
try:
    from api.customer_rental_router import router as customer_rental_router
except ImportError:
    customer_rental_router = None
if customer_rental_router:
    app.include_router(customer_rental_router)
try:
    from api.customer_push_router import router as customer_push_router
except ImportError:
    customer_push_router = None
if customer_push_router:
    app.include_router(customer_push_router)
try:
    from api.admin_push_router import router as admin_push_router
except ImportError:
    admin_push_router = None
if admin_push_router:
    app.include_router(admin_push_router)
try:
    from api.driver_push_router import router as driver_push_router
except ImportError:
    driver_push_router = None
if driver_push_router:
    app.include_router(driver_push_router)
if bookings_router:
    app.include_router(bookings_router)
if platform_router:
    app.include_router(platform_router)
if saas_router:
    app.include_router(saas_router)
if driver_portal_router:
    app.include_router(driver_portal_router)
if driver_enterprise_router:
    app.include_router(driver_enterprise_router)
if expenses_upload_router:
    app.include_router(expenses_upload_router)
if driver_sos_router:
    app.include_router(driver_sos_router)
if driver_chat_router:
    app.include_router(driver_chat_router)
if telemetry_ingest_router:
    app.include_router(telemetry_ingest_router)
if passenger_portal_router:
    app.include_router(passenger_portal_router)
if admin_platform_router:
    app.include_router(admin_platform_router)
if admin_telemetry_router:
    app.include_router(admin_telemetry_router)
if ws_telemetry_router:
    app.include_router(ws_telemetry_router)
if seat_pricing_router:
    app.include_router(seat_pricing_router)
if rent_plan_catalog_router:
    app.include_router(rent_plan_catalog_router)
if agency_plan_catalog_router:
    app.include_router(agency_plan_catalog_router)
try:
    from api.payment_settings_router import router as payment_settings_router
except ImportError:
    payment_settings_router = None
if payment_settings_router:
    # Rent desk Πληρωμές + Ρυθμίσεις → Πληρωμές (was only mounted on wallet_main).
    app.include_router(payment_settings_router)
try:
    from api.fleet_rental_router import router as fleet_rental_router
except ImportError:
    fleet_rental_router = None
if fleet_rental_router:
    app.include_router(fleet_rental_router)
try:
    from api.rent_sign_public_router import router as rent_sign_public_router
except ImportError:
    rent_sign_public_router = None
if rent_sign_public_router:
    app.include_router(rent_sign_public_router)
try:
    from api.loyalty_router import router as loyalty_router
except ImportError:
    loyalty_router = None
if loyalty_router:
    app.include_router(loyalty_router)
if email_settings_router:
    app.include_router(email_settings_router)
if email_campaigns_router:
    app.include_router(email_campaigns_router)
if email_mailbox_router:
    app.include_router(email_mailbox_router)
if email_tracking_router:
    app.include_router(email_tracking_router)
if email_retry_router:
    app.include_router(email_retry_router)


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)


manager = ConnectionManager()


@app.websocket("/ws/admin/boarding/{trip_id}")
async def boarding_ws(websocket: WebSocket, trip_id: int):
    """Push manifest refresh to driver tablets — requires admin/driver JWT (?token=)."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        return
    try:
        from api.ws_telemetry import _decode_admin_ws_token, _decode_driver_token

        try:
            _decode_admin_ws_token(token)
        except Exception:
            _decode_driver_token(token)
    except Exception:
        await websocket.close(code=4401)
        return

    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/health")
async def health_check(include_fiscal: bool = True):
    """Legacy health route — same snapshot as /api/v1/health."""
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.platform_health_service import build_platform_health
        from fastapi.responses import JSONResponse

        async with AsyncSessionLocal() as session:
            payload = await build_platform_health(session, include_fiscal=include_fiscal)
        ws_paths = sorted(
            {
                getattr(route, "path", "")
                for route in app.routes
                if "WebSocket" in type(route).__name__ and getattr(route, "path", "")
            }
        )
        payload["websockets"] = {"route_count": len(ws_paths), "routes": ws_paths}
        status_code = 200 if payload.get("status") != "unhealthy" else 503
        return JSONResponse(content=payload, status_code=status_code)
    except Exception:
        return {"status": "ok", "ticketing": "rotating-jwt-v2", "legacy_fallback": True}


@app.get("/metrics")
async def prometheus_metrics_root(request: Request):
    """Prometheus scrape (alias of /api/v1/metrics)."""
    from app.api.metrics import prometheus_metrics

    return await prometheus_metrics(request)