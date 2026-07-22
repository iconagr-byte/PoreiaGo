"""
Admin platform API — ρυθμίσεις πλατφόρμας, χρήστες, backup.

Προστατεύεται από TenantContextMiddleware: Bearer JWT + admin role.
Τοπικό dev χωρίς JWT: ADMIN_AUTH_DISABLED=1
"""

from __future__ import annotations

import asyncio
import os
import re
import uuid
from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, Response

from travel_platform.settings.backup_service import (
    BACKUP_DIR,
    create_backup,
    delete_backup,
    list_backups,
    read_backup,
    restore_backup,
)
from travel_platform.settings.platform_store import get_platform_config, update_platform_config
from travel_platform.settings.drivers_store import (
    create_driver,
    delete_driver,
    get_driver,
    list_drivers,
    update_driver,
)
from travel_platform.settings.users_store import (
    create_user,
    delete_user,
    list_users,
    update_user,
)
from travel_platform.fleet.service_service import UPLOAD_DIR, service_service
from schemas.platform_admin import (
    BackupCreateResponse,
    BackupInfoResponse,
    BackupRestoreResponse,
    FleetDriverCreate,
    FleetDriverResponse,
    FleetDriverUpdate,
    FleetAlertResponse,
    DispatchBlockedRequest,
    AbandonedCartResponse,
    AbandonedScanRequest,
    AbandonedScanResponse,
    PricingQuotePublicResponse,
    BrandingAdminResponse,
    BrandingAdminUpdate,
    PartnerWebhookCreate,
    PartnerWebhookResponse,
    PartnerDispatchRequest,
    PartnerDispatchResponse,
    MasterQrIssueRequest,
    MasterQrIssueResponse,
    DriverShiftPushRequest,
    DriverShiftPushResponse,
    TripSyncItem,
    TripsSyncRequest,
    TripsSyncResponse,
    FleetCostReportResponse,
    FleetDepreciationResponse,
    MaintenanceEventCreate,
    MaintenanceEventResponse,
    PlatformSettingsResponse,
    PlatformSettingsUpdate,
    PlatformUserCreate,
    PlatformUserResponse,
    PlatformUserUpdate,
    VehicleCreate,
    VehicleProfileResponse,
    VehicleUpdate,
)

router = APIRouter(prefix="/api/admin/platform", tags=["admin-platform"])


def _driver_response(d) -> FleetDriverResponse:
    days = None
    if d.license_expires_at:
        days = (d.license_expires_at - date.today()).days
    # Use persisted safety_score — avoid per-row DrivingBehaviorService lookups on list/CRUD.
    return FleetDriverResponse(
        id=d.id,
        name=d.name,
        license_no=d.license_no,
        phone=d.phone,
        email=d.email,
        hiring_date=d.hiring_date,
        status=d.status,
        vehicle_code=d.vehicle_code,
        license_plate=d.license_plate,
        salary_per_km=d.salary_per_km,
        salary_per_trip=d.salary_per_trip,
        current_balance=d.current_balance,
        safety_score=d.safety_score,
        trips_completed=d.trips_completed,
        total_km=d.total_km,
        license_expires_at=d.license_expires_at,
        avg_rating=d.avg_rating,
        days_until_license_expiry=days,
        photo_url=getattr(d, "photo_url", None),
        has_password=bool(getattr(d, "password_hash", None)),
    )


def _user_response(u) -> PlatformUserResponse:
    return PlatformUserResponse(
        id=u.id,
        email=u.email,
        name=u.name,
        role=u.role,
        is_active=u.is_active,
        last_login_at=u.last_login_at,
        created_at=u.created_at,
    )


@router.get("/settings", response_model=PlatformSettingsResponse)
async def get_settings():
    s = get_platform_config()
    return PlatformSettingsResponse(**s.__dict__)


@router.patch("/settings", response_model=PlatformSettingsResponse)
async def patch_settings(body: PlatformSettingsUpdate):
    patch = body.model_dump(exclude_unset=True)
    s = update_platform_config(patch)
    if patch.get("checkout_base_url"):
        from travel_platform.growth.branding_store import update_branding

        update_branding("default", {"checkout_base_url": patch["checkout_base_url"]})
    return PlatformSettingsResponse(**s.__dict__)


@router.get("/users", response_model=list[PlatformUserResponse])
async def get_users():
    return [_user_response(u) for u in list_users()]


@router.post("/users", response_model=PlatformUserResponse, status_code=201)
async def post_user(body: PlatformUserCreate):
    try:
        u = create_user(
            email=body.email,
            name=body.name,
            role=body.role,
            password=body.password,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return _user_response(u)


@router.patch("/users/{user_id}", response_model=PlatformUserResponse)
async def patch_user(user_id: str, body: PlatformUserUpdate):
    try:
        u = update_user(user_id, body.model_dump(exclude_unset=True))
    except KeyError:
        raise HTTPException(status_code=404, detail="User not found") from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return _user_response(u)


@router.delete("/users/{user_id}", status_code=204)
async def remove_user(user_id: str):
    try:
        delete_user(user_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="User not found") from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/drivers", response_model=list[FleetDriverResponse])
async def get_drivers(status: str | None = None):
    rows = await asyncio.to_thread(list_drivers, status)
    return [_driver_response(d) for d in rows]


_DRIVER_PHOTO_DIR = Path(
    os.getenv("POREIAGO_DATA_DIR") or Path(__file__).resolve().parents[1] / "data"
) / "uploads" / "driver_photos"
_MAX_DRIVER_PHOTO_BYTES = 4 * 1024 * 1024
_ALLOWED_PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


@router.post("/drivers/photo-upload")
async def upload_driver_photo(file: UploadFile = File(...)):
    """Admin upload — returns a public URL for photo_url on create/update."""
    import mimetypes

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Επιτρέπονται μόνο εικόνες (JPG, PNG, WebP)")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Άδειο αρχείο")
    if len(content) > _MAX_DRIVER_PHOTO_BYTES:
        raise HTTPException(status_code=400, detail="Η εικόνα είναι πολύ μεγάλη (μέγ. 4 MB)")

    ext = Path(file.filename or "photo.jpg").suffix.lower()
    if ext not in _ALLOWED_PHOTO_EXT:
        guessed = mimetypes.guess_extension(file.content_type or "") or ".jpg"
        ext = guessed if guessed in _ALLOWED_PHOTO_EXT else ".jpg"
    safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "", Path(file.filename or "photo").stem)[:40] or "photo"
    filename = f"{safe_stem}-{uuid.uuid4().hex[:10]}{ext}"

    _DRIVER_PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    out_path = _DRIVER_PHOTO_DIR / filename
    out_path.write_bytes(content)
    url = f"/api/site/driver-photos/{filename}"
    return {"ok": True, "url": url, "filename": filename}


@router.post("/drivers", response_model=FleetDriverResponse, status_code=201)
async def post_driver(body: FleetDriverCreate):
    try:
        d = await asyncio.to_thread(create_driver, body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return _driver_response(d)


@router.get("/drivers/{driver_id}", response_model=FleetDriverResponse)
async def get_driver_api(driver_id: str):
    d = await asyncio.to_thread(get_driver, driver_id)
    if not d:
        raise HTTPException(status_code=404, detail="Driver not found")
    return _driver_response(d)


@router.patch("/drivers/{driver_id}", response_model=FleetDriverResponse)
async def patch_driver(driver_id: str, body: FleetDriverUpdate):
    try:
        d = await asyncio.to_thread(update_driver, driver_id, body.model_dump(exclude_unset=True))
    except KeyError:
        raise HTTPException(status_code=404, detail="Driver not found") from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return _driver_response(d)


@router.delete("/drivers/{driver_id}", status_code=204)
async def remove_driver(driver_id: str):
    try:
        await asyncio.to_thread(delete_driver, driver_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Driver not found") from None
    return Response(status_code=204)

@router.get("/fleet/availability")
async def get_fleet_availability(plate: str):
    """Check if vehicle plate can accept new bookings (maintenance / KTEO / service)."""
    return service_service.check_dispatch_availability(plate)


@router.post("/fleet/dispatch-blocked", response_model=FleetAlertResponse)
async def post_fleet_dispatch_blocked(body: DispatchBlockedRequest):
    """Record a blocked booking attempt and notify fleet manager (log)."""
    return service_service.record_dispatch_blocked(
        body.plate,
        body.reason,
        trip_title=body.trip_title,
    )


@router.get("/fleet/vehicles", response_model=list[VehicleProfileResponse])
async def get_fleet_vehicles():
    return service_service.list_vehicles()


@router.post("/fleet/vehicles", response_model=VehicleProfileResponse, status_code=201)
async def post_fleet_vehicle(body: VehicleCreate):
    try:
        return service_service.create_vehicle(body.model_dump(exclude_unset=True))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/fleet/vehicles/{vehicle_id}", response_model=VehicleProfileResponse)
async def get_fleet_vehicle(vehicle_id: str):
    row = service_service.get_vehicle(vehicle_id)
    if not row:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return row


@router.patch("/fleet/vehicles/{vehicle_id}", response_model=VehicleProfileResponse)
async def patch_fleet_vehicle(vehicle_id: str, body: VehicleUpdate):
    try:
        return service_service.update_vehicle(vehicle_id, body.model_dump(exclude_unset=True))
    except KeyError:
        raise HTTPException(status_code=404, detail="Vehicle not found") from None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.delete("/fleet/vehicles/{vehicle_id}")
async def delete_fleet_vehicle(vehicle_id: str):
    if not service_service.delete_vehicle(vehicle_id):
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"ok": True, "id": vehicle_id}


@router.post("/fleet/vehicles/{vehicle_id}/odometer", response_model=VehicleProfileResponse)
async def sync_vehicle_odometer(vehicle_id: str, odometer_km: float):
    try:
        return service_service.sync_odometer_from_telemetry(vehicle_id, odometer_km)
    except KeyError:
        raise HTTPException(status_code=404, detail="Vehicle not found") from None


@router.get("/fleet/maintenance-events", response_model=list[MaintenanceEventResponse])
async def get_maintenance_events(vehicle_id: str | None = None):
    return service_service.list_maintenance_events(vehicle_id=vehicle_id)


@router.post("/fleet/maintenance-events", response_model=MaintenanceEventResponse, status_code=201)
async def post_maintenance_event(body: MaintenanceEventCreate):
    try:
        return service_service.create_maintenance_event(body.model_dump(exclude_unset=True))
    except KeyError:
        raise HTTPException(status_code=404, detail="Vehicle not found") from None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/fleet/maintenance-events/{event_id}/attachments")
async def post_maintenance_attachment(event_id: str, file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    safe_name = file.filename.replace("..", "_").replace("/", "_").replace("\\", "_")
    out_name = f"{event_id}-{int(datetime.now().timestamp())}-{safe_name}"
    out_path = Path(UPLOAD_DIR) / out_name
    content = await file.read()
    out_path.write_bytes(content)
    try:
        meta = service_service.attach_to_event(
            event_id=event_id,
            file_name=file.filename,
            mime_type=file.content_type or "application/octet-stream",
            size_bytes=len(content),
            storage_path=str(out_path),
        )
    except KeyError:
        out_path.unlink(missing_ok=True)
        raise HTTPException(status_code=404, detail="Maintenance event not found") from None
    return meta


@router.post("/fleet/alerts/scan", response_model=list[FleetAlertResponse])
async def post_fleet_alert_scan():
    return service_service.scan_predictive_alerts()


@router.get("/fleet/alerts", response_model=list[FleetAlertResponse])
async def get_fleet_alerts(unresolved_only: bool = True):
    return service_service.list_alerts(unresolved_only=unresolved_only)


@router.post("/fleet/alerts/{alert_id}/resolve", response_model=FleetAlertResponse)
async def post_fleet_alert_resolve(alert_id: str):
    try:
        return service_service.resolve_alert(alert_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Alert not found") from None


@router.get("/fleet/reports/costs", response_model=FleetCostReportResponse)
async def get_fleet_cost_report(vehicle_id: str, date_from: date, date_to: date):
    try:
        return service_service.get_vehicle_cost_report(vehicle_id, date_from, date_to)
    except KeyError:
        raise HTTPException(status_code=404, detail="Vehicle not found") from None


@router.get("/fleet/reports/depreciation", response_model=FleetDepreciationResponse)
async def get_fleet_depreciation(vehicle_id: str, as_of: date | None = None):
    try:
        return service_service.estimate_book_value(vehicle_id, as_of=as_of)
    except KeyError:
        raise HTTPException(status_code=404, detail="Vehicle not found") from None


@router.get("/fleet/dashboard")
async def get_fleet_dashboard_cards():
    return service_service.dashboard_cards()


@router.get("/backups", response_model=list[BackupInfoResponse])
async def get_backups():
    return [
        BackupInfoResponse(
            id=b["id"],
            filename=b["filename"],
            size_bytes=b["size_bytes"],
            created_at=datetime.fromisoformat(b["created_at"].replace("Z", "+00:00")),
            includes=b["includes"],
        )
        for b in list_backups()
    ]


@router.post("/backups", response_model=BackupCreateResponse)
async def post_backup():
    b = create_backup()
    return BackupCreateResponse(
        backup=BackupInfoResponse(
            id=b["id"],
            filename=b["filename"],
            size_bytes=b["size_bytes"],
            created_at=datetime.fromisoformat(b["created_at"].replace("Z", "+00:00")),
            includes=b["includes"],
        ),
        message="Το backup δημιουργήθηκε επιτυχώς",
    )


@router.post("/backups/{backup_id}/restore", response_model=BackupRestoreResponse)
async def post_restore(backup_id: str):
    try:
        result = restore_backup(backup_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Backup not found") from None
    return BackupRestoreResponse(**result)


@router.get("/backups/{backup_id}/download")
async def download_backup(backup_id: str):
    path = BACKUP_DIR / f"{backup_id}.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Backup not found")
    return FileResponse(path, filename=path.name, media_type="application/json")


@router.delete("/backups/{backup_id}", status_code=204)
async def remove_backup(backup_id: str):
    try:
        delete_backup(backup_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Backup not found") from None


@router.post("/operations/master-qr", response_model=MasterQrIssueResponse)
async def issue_master_qr(body: MasterQrIssueRequest):
    from travel_platform.operations.master_qr_bridge import issue_master_qr_hybrid

    result = await issue_master_qr_hybrid(body.trip_id, driver_id=body.driver_id)
    return MasterQrIssueResponse(
        qr_content=result["qr_content"],
        qr_token=result.get("qr_token"),
        auth_url=result.get("auth_url") or result["qr_content"],
        trip_id=result["trip_id"],
        tenant_id=result["tenant_id"],
        expires_at=result["expires_at"],
        manifest_url=result["manifest_url"],
        source=result.get("source", "local"),
    )


@router.post("/operations/notify-driver-push", response_model=DriverShiftPushResponse)
async def notify_driver_shift_push(body: DriverShiftPushRequest):
    """Έκδοση Master QR + Web Push «Άνοιξε βάρδια» στο κινητό οδηγού."""
    from travel_platform.notifications.driver_push_service import send_driver_shift_invite_push
    from travel_platform.operations.master_qr_bridge import issue_master_qr_hybrid
    from travel_platform.operations.master_qr_normalize import build_driver_auth_url, driver_app_public_base

    result = await issue_master_qr_hybrid(body.trip_id, driver_id=body.driver_id)
    auth_url = result.get("auth_url") or result.get("qr_content")
    qr_token = result.get("qr_token")
    if qr_token:
        auth_url = build_driver_auth_url(qr_token, base_url=driver_app_public_base())

    push_result = await send_driver_shift_invite_push(
        tenant_id=str(result["tenant_id"]),
        trip_id=int(result["trip_id"]),
        driver_id=body.driver_id,
        message=body.message,
        trip_title=body.trip_title,
        auth_url=auth_url,
        qr_token=qr_token,
    )

    return DriverShiftPushResponse(
        ok=bool(push_result.get("ok")),
        auth_url=auth_url or "",
        expires_at=int(result["expires_at"]),
        trip_id=int(result["trip_id"]),
        push=push_result,
    )


@router.get("/operations/master-qr/{trip_id}/png")
async def master_qr_png(
    trip_id: int,
    driver_id: str | None = Query(default=None),
    frontend_base: str | None = Query(default=None, description="Override public driver app URL"),
):
    """Issue Master QR and return PNG (magic link URL encoded)."""
    from travel_platform.operations.master_qr_bridge import issue_master_qr_hybrid
    from travel_platform.operations.master_qr_image import render_qr_png
    from travel_platform.operations.master_qr_normalize import build_driver_auth_url

    if trip_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid trip_id")

    result = await issue_master_qr_hybrid(trip_id, driver_id=driver_id)
    qr_token = result.get("qr_token")
    auth_url = result.get("auth_url") or result.get("qr_content")
    if frontend_base and qr_token:
        auth_url = build_driver_auth_url(qr_token, base_url=frontend_base)

    try:
        png = render_qr_png(auth_url)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"QR render failed: {exc}") from exc

    filename = f"master-qr-trip-{trip_id}.png"
    return Response(
        content=png,
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.post("/trips/sync", response_model=TripsSyncResponse)
async def sync_trips_admin(body: TripsSyncRequest):
    from travel_platform.operations.trips_sync import sync_trips_to_postgres

    payload = [t.model_dump() for t in body.trips]
    result = await sync_trips_to_postgres(payload, tenant_id=body.tenant_id)
    return TripsSyncResponse(**result)


@router.get("/branding", response_model=BrandingAdminResponse)
async def get_admin_branding():
    from travel_platform.growth.branding_store import get_branding

    return BrandingAdminResponse(**get_branding().to_dict())


@router.put("/branding", response_model=BrandingAdminResponse)
async def put_admin_branding(body: BrandingAdminUpdate):
    from travel_platform.growth.branding_store import update_branding

    patch = body.model_dump(exclude_unset=True)
    return BrandingAdminResponse(**update_branding("default", patch).to_dict())


@router.get("/partners/webhooks", response_model=list[PartnerWebhookResponse])
async def list_partner_webhooks():
    from travel_platform.growth.partner_store import list_subscriptions

    return [PartnerWebhookResponse(**s.to_dict()) for s in list_subscriptions()]


@router.post("/partners/webhooks", response_model=PartnerWebhookResponse)
async def create_partner_webhook(body: PartnerWebhookCreate):
    from travel_platform.growth.partner_store import register_subscription

    try:
        sub = register_subscription(
            partner_name=body.partner_name,
            target_url=body.target_url,
            event_types=body.event_types,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return PartnerWebhookResponse(**sub.to_dict())


@router.delete("/partners/webhooks/{sub_id}", status_code=204)
async def delete_partner_webhook(sub_id: str):
    from travel_platform.growth.partner_store import delete_subscription

    if not delete_subscription(sub_id):
        raise HTTPException(status_code=404, detail="Subscription not found")


@router.post("/partners/dispatch", response_model=PartnerDispatchResponse)
async def dispatch_partner_webhook(body: PartnerDispatchRequest):
    from travel_platform.growth.partner_store import dispatch_event

    try:
        result = dispatch_event(body.event_type, body.payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return PartnerDispatchResponse(**result)


@router.get("/pricing/quote", response_model=PricingQuotePublicResponse)
async def get_public_pricing_quote(
    trip_id: int = Query(..., gt=0),
    base_price: float = Query(..., gt=0),
    total_seats: int = Query(..., gt=0),
    sold_seats: int = Query(0, ge=0),
):
    """B2C dynamic price — uses platform settings thresholds (no JWT)."""
    from travel_platform.revenue.dynamic_pricing import compute_quote_pure
    from travel_platform.settings.platform_store import get_platform_config

    cfg = get_platform_config()
    quote = compute_quote_pure(
        base_price,
        total_seats,
        sold_seats,
        trip_id=trip_id,
        high_threshold=cfg.pricing_high_occupancy_threshold,
        high_markup_pct=cfg.pricing_high_occupancy_markup_pct,
        low_threshold=cfg.pricing_low_occupancy_threshold,
        low_discount_pct=cfg.pricing_low_occupancy_discount_pct,
    )
    return PricingQuotePublicResponse(
        trip_id=quote.trip_id,
        base_price_eur=float(quote.base_price_eur),
        final_price_eur=float(quote.final_price_eur),
        occupancy_ratio=quote.occupancy_ratio,
        sold_seats=sold_seats,
        total_seats=total_seats,
        applied_rule=quote.applied_rule.value if quote.applied_rule else None,
        adjustment_pct=quote.adjustment_pct,
    )


@router.get("/abandoned/carts", response_model=list[AbandonedCartResponse])
async def list_abandoned_carts(include_completed: bool = False):
    from travel_platform.revenue.abandoned_carts import list_carts

    return [AbandonedCartResponse(**c.to_dict()) for c in list_carts(include_completed=include_completed)]


@router.post("/abandoned/scan", response_model=AbandonedScanResponse)
async def scan_abandoned_carts(body: AbandonedScanRequest, request: Request):
    from travel_platform.revenue.abandoned_carts import scan_and_send_recovery

    origin = request.headers.get("origin") or request.headers.get("referer", "")
    base = body.base_url or (origin.rstrip("/") if origin else "http://localhost:5173")
    stats = await scan_and_send_recovery(base_url=base, pending_minutes=body.pending_minutes)
    return AbandonedScanResponse(**stats)
