"""
Admin platform API — ρυθμίσεις πλατφόρμας, χρήστες, backup.

Προστατεύεται από TenantContextMiddleware: Bearer JWT + admin role.
Τοπικό dev χωρίς JWT: ADMIN_AUTH_DISABLED=1
"""

from __future__ import annotations

import logging
import os
import re
import uuid
from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

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
    DEMO_TENANT_ID,
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
    FleetExpenseCreate,
    FleetExpenseResponse,
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


def _driver_response(d, *, enrich_safety: bool = False) -> FleetDriverResponse:
    days = None
    if d.license_expires_at:
        days = (d.license_expires_at - date.today()).days
    safety = d.safety_score
    # List endpoints skip live telemetry enrichment — keeps /drivers snappy for dropdowns.
    if enrich_safety:
        try:
            from uuid import UUID
            from travel_platform.telemetry.driving_behavior import DrivingBehaviorService

            profile = DrivingBehaviorService().get_profile(UUID(d.id))
            safety = profile.safety_score
        except Exception:
            pass
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
        safety_score=safety,
        trips_completed=d.trips_completed,
        total_km=d.total_km,
        license_expires_at=d.license_expires_at,
        avg_rating=d.avg_rating,
        days_until_license_expiry=days,
        photo_url=getattr(d, "photo_url", None),
        has_password=bool(getattr(d, "password_hash", None)),
    )


def _request_tenant_id(request: Request) -> str:
    """
    Office scope for file-backed drivers/fleet.

    Prefer request.state.tenant_id (set by DomainTenant + JWT middleware).
    Fall back to Bearer JWT tenant_id so creates never silently land in the
    demo office when Host is the platform domain.
    """
    tid = getattr(request.state, "tenant_id", None)
    if tid:
        return str(tid)
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:].strip()
        if token:
            try:
                import jwt
                from middleware.tenant import _jwt_settings

                secret, algorithm, _ = _jwt_settings()
                if secret:
                    payload = jwt.decode(token, secret, algorithms=[algorithm])
                    raw = payload.get("tenant_id")
                    if raw:
                        return str(raw)
            except Exception:
                pass
    return DEMO_TENANT_ID


def _driver_for_tenant(driver_id: str, tenant_id: str):
    d = get_driver(driver_id)
    if not d:
        return None
    driver_tid = getattr(d, "tenant_id", None) or DEMO_TENANT_ID
    if str(driver_tid) != str(tenant_id):
        return None
    return d


def _driver_for_chat(driver_id: str, tenant_id: str):
    """
    Resolve a driver for office chat.

    Driver portal coerces demo-tenant sessions onto the live SaaS tenant so GPS
    and chat land in the office inbox. Drivers themselves may still be stored
    under DEMO_TENANT_ID — allow that pairing here so threads stay readable.
    """
    did = str(driver_id or "").strip()
    if not did:
        return None
    d = get_driver(did)
    if not d:
        return None
    driver_tid = str(getattr(d, "tenant_id", None) or DEMO_TENANT_ID)
    office_tid = str(tenant_id or "")
    if driver_tid == office_tid:
        return d
    if driver_tid == str(DEMO_TENANT_ID) and office_tid and office_tid != str(DEMO_TENANT_ID):
        return d
    return None


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
async def get_drivers(request: Request, status: str | None = None):
    tenant_id = _request_tenant_id(request)
    return [
        _driver_response(d, enrich_safety=False)
        for d in list_drivers(status, tenant_id=tenant_id)
    ]


_DRIVER_PHOTO_DIR = Path(
    os.getenv("POREIAGO_DATA_DIR") or Path(__file__).resolve().parents[1] / "data"
) / "uploads" / "driver_photos"
_MAX_DRIVER_PHOTO_BYTES = 4 * 1024 * 1024
_ALLOWED_PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


@router.post("/drivers/photo-upload")
async def upload_driver_photo(file: UploadFile = File(...)):
    """Admin upload — returns a public URL for photo_url on create/update."""
    from travel_platform.media.image_optimize import optimize_driver_photo

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Επιτρέπονται μόνο εικόνες (JPG, PNG, WebP)")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Άδειο αρχείο")
    if len(content) > _MAX_DRIVER_PHOTO_BYTES:
        raise HTTPException(status_code=400, detail="Η εικόνα είναι πολύ μεγάλη (μέγ. 4 MB)")

    optimized = optimize_driver_photo(content)
    if optimized.ext == ".bin":
        raise HTTPException(status_code=400, detail="Μη έγκυρη εικόνα")
    safe_stem = re.sub(r"[^a-zA-Z0-9_-]+", "", Path(file.filename or "photo").stem)[:40] or "photo"
    filename = f"{safe_stem}-{uuid.uuid4().hex}{optimized.ext}"

    _DRIVER_PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    out_path = _DRIVER_PHOTO_DIR / filename
    out_path.write_bytes(optimized.content)
    url = f"/api/site/driver-photos/{filename}"
    return {
        "ok": True,
        "url": url,
        "filename": filename,
        "bytes": len(optimized.content),
        "content_type": optimized.content_type,
    }


@router.post("/drivers", response_model=FleetDriverResponse, status_code=201)
async def post_driver(request: Request, body: FleetDriverCreate):
    data = body.model_dump()
    data["tenant_id"] = _request_tenant_id(request)
    try:
        d = create_driver(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return _driver_response(d, enrich_safety=True)


@router.get("/drivers/{driver_id}", response_model=FleetDriverResponse)
async def get_driver_api(request: Request, driver_id: str):
    d = _driver_for_tenant(driver_id, _request_tenant_id(request))
    if not d:
        raise HTTPException(status_code=404, detail="Driver not found")
    return _driver_response(d, enrich_safety=True)


@router.patch("/drivers/{driver_id}", response_model=FleetDriverResponse)
async def patch_driver(request: Request, driver_id: str, body: FleetDriverUpdate):
    if not _driver_for_tenant(driver_id, _request_tenant_id(request)):
        raise HTTPException(status_code=404, detail="Driver not found")
    try:
        d = update_driver(driver_id, body.model_dump(exclude_unset=True))
    except KeyError:
        raise HTTPException(status_code=404, detail="Driver not found") from None
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return _driver_response(d, enrich_safety=True)


@router.delete("/drivers/{driver_id}", status_code=204)
async def remove_driver(request: Request, driver_id: str):
    if not _driver_for_tenant(driver_id, _request_tenant_id(request)):
        raise HTTPException(status_code=404, detail="Driver not found")
    try:
        delete_driver(driver_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Driver not found") from None


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
async def get_fleet_vehicles(request: Request):
    return service_service.list_vehicles(tenant_id=_request_tenant_id(request))


@router.post("/fleet/vehicles", response_model=VehicleProfileResponse, status_code=201)
async def post_fleet_vehicle(request: Request, body: VehicleCreate):
    data = body.model_dump(exclude_unset=True)
    data["tenant_id"] = _request_tenant_id(request)
    try:
        return service_service.create_vehicle(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/fleet/vehicles/{vehicle_id}", response_model=VehicleProfileResponse)
async def get_fleet_vehicle(request: Request, vehicle_id: str):
    row = service_service.get_vehicle(vehicle_id, tenant_id=_request_tenant_id(request))
    if not row:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return row


@router.patch("/fleet/vehicles/{vehicle_id}", response_model=VehicleProfileResponse)
async def patch_fleet_vehicle(request: Request, vehicle_id: str, body: VehicleUpdate):
    try:
        return service_service.update_vehicle(
            vehicle_id,
            body.model_dump(exclude_unset=True),
            tenant_id=_request_tenant_id(request),
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Vehicle not found") from None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.delete("/fleet/vehicles/{vehicle_id}")
async def delete_fleet_vehicle(request: Request, vehicle_id: str):
    if not service_service.delete_vehicle(vehicle_id, tenant_id=_request_tenant_id(request)):
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"ok": True, "id": vehicle_id}


@router.post("/fleet/vehicles/{vehicle_id}/odometer", response_model=VehicleProfileResponse)
async def sync_vehicle_odometer(request: Request, vehicle_id: str, odometer_km: float):
    if not service_service.get_vehicle(vehicle_id, tenant_id=_request_tenant_id(request)):
        raise HTTPException(status_code=404, detail="Vehicle not found")
    try:
        return service_service.sync_odometer_from_telemetry(vehicle_id, odometer_km)
    except KeyError:
        raise HTTPException(status_code=404, detail="Vehicle not found") from None


@router.get("/fleet/maintenance-events", response_model=list[MaintenanceEventResponse])
async def get_maintenance_events(request: Request, vehicle_id: str | None = None):
    tenant_id = _request_tenant_id(request)
    if vehicle_id and not service_service.get_vehicle(vehicle_id, tenant_id=tenant_id):
        raise HTTPException(status_code=404, detail="Vehicle not found")
    events = service_service.list_maintenance_events(vehicle_id=vehicle_id)
    if vehicle_id:
        return events
    owned = {v["id"] for v in service_service.list_vehicles(tenant_id=tenant_id)}
    return [e for e in events if e.get("vehicle_id") in owned]


@router.post("/fleet/maintenance-events", response_model=MaintenanceEventResponse, status_code=201)
async def post_maintenance_event(request: Request, body: MaintenanceEventCreate):
    data = body.model_dump(exclude_unset=True)
    vehicle_id = data.get("vehicle_id")
    if not vehicle_id or not service_service.get_vehicle(
        vehicle_id, tenant_id=_request_tenant_id(request)
    ):
        raise HTTPException(status_code=404, detail="Vehicle not found")
    try:
        return service_service.create_maintenance_event(data)
    except KeyError:
        raise HTTPException(status_code=404, detail="Vehicle not found") from None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/fleet/maintenance-events/{event_id}/attachments")
async def post_maintenance_attachment(request: Request, event_id: str, file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    event_rows = service_service.list_maintenance_events()
    event = next((e for e in event_rows if e.get("id") == event_id), None)
    if not event or not service_service.get_vehicle(
        event.get("vehicle_id"), tenant_id=_request_tenant_id(request)
    ):
        raise HTTPException(status_code=404, detail="Maintenance event not found")
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
async def post_fleet_alert_scan(request: Request):
    tenant_id = _request_tenant_id(request)
    alerts = service_service.scan_predictive_alerts()
    owned = {v["id"] for v in service_service.list_vehicles(tenant_id=tenant_id)}
    return [a for a in alerts if a.get("vehicle_id") in owned]


@router.get("/fleet/alerts", response_model=list[FleetAlertResponse])
async def get_fleet_alerts(request: Request, unresolved_only: bool = True):
    tenant_id = _request_tenant_id(request)
    alerts = service_service.list_alerts(unresolved_only=unresolved_only)
    owned = {v["id"] for v in service_service.list_vehicles(tenant_id=tenant_id)}
    return [a for a in alerts if a.get("vehicle_id") in owned]


@router.post("/fleet/alerts/{alert_id}/resolve", response_model=FleetAlertResponse)
async def post_fleet_alert_resolve(request: Request, alert_id: str):
    tenant_id = _request_tenant_id(request)
    owned = {v["id"] for v in service_service.list_vehicles(tenant_id=tenant_id)}
    try:
        alert = service_service.resolve_alert(alert_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Alert not found") from None
    if alert.get("vehicle_id") not in owned:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.get("/fleet/reports/costs", response_model=FleetCostReportResponse)
async def get_fleet_cost_report(
    request: Request, vehicle_id: str, date_from: date, date_to: date
):
    if not service_service.get_vehicle(vehicle_id, tenant_id=_request_tenant_id(request)):
        raise HTTPException(status_code=404, detail="Vehicle not found")
    try:
        return service_service.get_vehicle_cost_report(vehicle_id, date_from, date_to)
    except KeyError:
        raise HTTPException(status_code=404, detail="Vehicle not found") from None


@router.get("/fleet/reports/depreciation", response_model=FleetDepreciationResponse)
async def get_fleet_depreciation(
    request: Request, vehicle_id: str, as_of: date | None = None
):
    if not service_service.get_vehicle(vehicle_id, tenant_id=_request_tenant_id(request)):
        raise HTTPException(status_code=404, detail="Vehicle not found")
    try:
        return service_service.estimate_book_value(vehicle_id, as_of=as_of)
    except KeyError:
        raise HTTPException(status_code=404, detail="Vehicle not found") from None


@router.get("/fleet/dashboard")
async def get_fleet_dashboard_cards(request: Request):
    return service_service.dashboard_cards(tenant_id=_request_tenant_id(request))


@router.get("/fleet/availability-board")
async def get_fleet_availability_board(request: Request):
    return service_service.list_availability(tenant_id=_request_tenant_id(request))


@router.get("/fleet/calendar")
async def get_fleet_calendar(request: Request, within_days: int = Query(120, ge=7, le=365)):
    return service_service.list_calendar(
        tenant_id=_request_tenant_id(request),
        within_days=within_days,
    )


@router.get("/fleet/documents")
async def get_fleet_documents(request: Request, vehicle_id: str | None = None):
    return service_service.list_documents(
        tenant_id=_request_tenant_id(request),
        vehicle_id=vehicle_id,
    )


@router.post("/fleet/vehicles/{vehicle_id}/documents", status_code=201)
async def post_fleet_vehicle_document(
    request: Request,
    vehicle_id: str,
    file: UploadFile = File(...),
    kind: str = Query("registration"),
    expires_at: date | None = None,
):
    tenant_id = _request_tenant_id(request)
    if not service_service.get_vehicle(vehicle_id, tenant_id=tenant_id):
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    safe_name = file.filename.replace("..", "_").replace("/", "_").replace("\\", "_")
    out_name = f"doc-{vehicle_id}-{int(datetime.now().timestamp())}-{safe_name}"
    out_path = Path(UPLOAD_DIR) / out_name
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Άδειο αρχείο")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(content)
    try:
        doc = service_service.add_vehicle_document(
            vehicle_id,
            {
                "kind": kind,
                "file_name": file.filename,
                "mime_type": file.content_type or "application/octet-stream",
                "size_bytes": len(content),
                "storage_path": str(out_path),
                "url": f"/api/admin/platform/fleet/documents/file/{out_name}",
                "expires_at": expires_at.isoformat() if expires_at else None,
            },
            tenant_id=tenant_id,
        )
    except KeyError:
        out_path.unlink(missing_ok=True)
        raise HTTPException(status_code=404, detail="Vehicle not found") from None
    return doc


@router.delete("/fleet/vehicles/{vehicle_id}/documents/{document_id}")
async def delete_fleet_vehicle_document(request: Request, vehicle_id: str, document_id: str):
    if not service_service.delete_vehicle_document(
        vehicle_id, document_id, tenant_id=_request_tenant_id(request)
    ):
        raise HTTPException(status_code=404, detail="Document not found")
    return {"ok": True}


@router.get("/fleet/documents/file/{filename}")
async def get_fleet_document_file(filename: str):
    safe = Path(filename).name
    path = Path(UPLOAD_DIR) / safe
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)


@router.get("/fleet/expenses", response_model=list[FleetExpenseResponse])
async def get_fleet_expenses(request: Request, vehicle_id: str | None = None):
    return service_service.list_expenses(
        tenant_id=_request_tenant_id(request),
        vehicle_id=vehicle_id,
    )


@router.post("/fleet/expenses", response_model=FleetExpenseResponse, status_code=201)
async def post_fleet_expense(request: Request, body: FleetExpenseCreate):
    data = body.model_dump(exclude_unset=True)
    data["tenant_id"] = _request_tenant_id(request)
    try:
        return service_service.create_expense(data)
    except KeyError:
        raise HTTPException(status_code=404, detail="Vehicle not found") from None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.delete("/fleet/expenses/{expense_id}")
async def delete_fleet_expense(request: Request, expense_id: str):
    if not service_service.delete_expense(expense_id, tenant_id=_request_tenant_id(request)):
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"ok": True}


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


def _spawn_passenger_sync(trip_id: int, tenant_id: str | None) -> None:
    """Passenger↔ticketing sync must not delay Master QR minting."""
    import asyncio
    import logging

    async def _run() -> None:
        try:
            from travel_platform.operations.boarding_office_sync import sync_trip_passengers_to_ticketing

            await sync_trip_passengers_to_ticketing(trip_id, tenant_id=tenant_id)
        except Exception as exc:
            logging.getLogger(__name__).warning(
                "background passenger sync failed trip=%s: %s", trip_id, exc
            )

    try:
        asyncio.get_running_loop().create_task(_run())
    except RuntimeError:
        pass


@router.post("/operations/master-qr", response_model=MasterQrIssueResponse)
async def issue_master_qr(body: MasterQrIssueRequest, request: Request):
    from travel_platform.operations.master_qr_bridge import (
        issue_master_qr_hybrid,
        resolve_platform_tenant_id,
    )

    tenant_id = _request_tenant_id(request)
    if tenant_id == DEMO_TENANT_ID:
        tenant_id = await resolve_platform_tenant_id()
    result = await issue_master_qr_hybrid(
        body.trip_id,
        driver_id=body.driver_id,
        tenant_id=tenant_id,
    )
    _spawn_passenger_sync(body.trip_id, str(result.get("tenant_id") or tenant_id))
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
async def notify_driver_shift_push(body: DriverShiftPushRequest, request: Request):
    """Έκδοση Master QR + Web Push «Άνοιξε βάρδια» στο κινητό οδηγού."""
    from travel_platform.notifications.driver_push_service import send_driver_shift_invite_push
    from travel_platform.operations.master_qr_bridge import (
        issue_master_qr_hybrid,
        resolve_platform_tenant_id,
    )
    from travel_platform.operations.master_qr_normalize import build_driver_auth_url, driver_app_public_base

    tenant_id = _request_tenant_id(request)
    if tenant_id == DEMO_TENANT_ID:
        tenant_id = await resolve_platform_tenant_id()
    result = await issue_master_qr_hybrid(
        body.trip_id,
        driver_id=body.driver_id,
        tenant_id=tenant_id,
    )
    _spawn_passenger_sync(body.trip_id, str(result.get("tenant_id") or tenant_id))
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
    request: Request,
    trip_id: int,
    driver_id: str | None = Query(default=None),
    frontend_base: str | None = Query(default=None, description="Override public driver app URL"),
):
    """Issue Master QR and return PNG (magic link URL encoded)."""
    from travel_platform.operations.master_qr_bridge import (
        issue_master_qr_hybrid,
        resolve_platform_tenant_id,
    )
    from travel_platform.operations.master_qr_image import render_qr_png
    from travel_platform.operations.master_qr_normalize import build_driver_auth_url

    if trip_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid trip_id")

    tenant_id = _request_tenant_id(request)
    if tenant_id == DEMO_TENANT_ID:
        tenant_id = await resolve_platform_tenant_id()
    result = await issue_master_qr_hybrid(trip_id, driver_id=driver_id, tenant_id=tenant_id)
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
async def sync_trips_admin(request: Request, body: TripsSyncRequest):
    from travel_platform.operations.trips_sync import sync_trips_to_postgres

    # Never trust body.tenant_id alone — prefer JWT / request tenant context.
    tenant_id = _request_tenant_id(request)
    if body.tenant_id and str(body.tenant_id).strip() and str(body.tenant_id).strip() != tenant_id:
        # Only allow body tenant when request has no office JWT (legacy) AND
        # body matches the resolved platform tenant — still prefer request.
        logger.warning(
            "Ignoring body.tenant_id=%s; using request tenant=%s",
            body.tenant_id,
            tenant_id,
        )
    payload = [t.model_dump() for t in body.trips]
    result = await sync_trips_to_postgres(
        payload,
        tenant_id=tenant_id,
        replace_catalog=bool(getattr(body, "replace_catalog", False)),
    )
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


# ── Driver ↔ office chat ──────────────────────────────────────────────


class DriverChatSendBody(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)
    trip_id: int | None = None
    sender_name: str | None = None


async def _chat_tenant_id(request: Request) -> str:
    """Office scope for driver chat — JWT / request tenant, never global platform id."""
    tid = _request_tenant_id(request)
    if tid:
        return str(tid)
    raise HTTPException(status_code=401, detail="Tenant required")


@router.get("/driver-chat/threads")
async def admin_chat_threads(
    request: Request,
    limit: int = Query(50, ge=1, le=200),
):
    from travel_platform.driver.chat_store import list_threads

    tenant_id = await _chat_tenant_id(request)
    threads = list_threads(tenant_id=tenant_id, limit=limit)
    for t in threads:
        d = _driver_for_chat(t.get("driver_id"), tenant_id)
        fallback_name = None
        if t.get("last_sender") == "driver" and t.get("sender_name"):
            fallback_name = t.get("sender_name")
        t["driver_name"] = (d.name if d else None) or fallback_name
        t["vehicle_plate"] = (d.license_plate or d.vehicle_code) if d else None
        t["driver_missing"] = d is None
    return {"tenant_id": tenant_id, "threads": threads}


@router.get("/driver-chat/unread")
async def admin_chat_unread(request: Request):
    from travel_platform.driver.chat_store import unread_counts

    tenant_id = await _chat_tenant_id(request)
    counts = unread_counts(tenant_id=tenant_id)
    return {"tenant_id": tenant_id, "unread": counts.get("office", 0)}


@router.get("/driver-chat/{driver_id}/messages")
async def admin_chat_messages(
    driver_id: str,
    request: Request,
    after: str | None = Query(default=None),
    limit: int = Query(100, ge=1, le=500),
):
    from travel_platform.driver.chat_store import list_messages, unread_counts

    tenant_id = await _chat_tenant_id(request)
    driver = _driver_for_chat(driver_id, tenant_id)
    # Allow reading historical threads even if the driver row was removed.
    messages = list_messages(
        tenant_id=tenant_id,
        driver_id=driver_id,
        after_id=after,
        limit=limit,
        viewer="office",
    )
    if driver is None and not messages:
        raise HTTPException(status_code=404, detail="Ο οδηγός δεν βρέθηκε")
    counts = unread_counts(tenant_id=tenant_id, driver_id=driver_id)
    return {
        "driver_id": driver_id,
        "driver_name": driver.name if driver else None,
        "driver_missing": driver is None,
        "messages": messages,
        "unread": counts.get("office", 0),
    }


@router.post("/driver-chat/{driver_id}/messages")
async def admin_chat_send(driver_id: str, body: DriverChatSendBody, request: Request):
    from travel_platform.driver.chat_store import append_message

    tenant_id = await _chat_tenant_id(request)
    driver = _driver_for_chat(driver_id, tenant_id)
    if not driver:
        # Still allow office reply on an existing thread (driver may be demo-tenant).
        from travel_platform.driver.chat_store import list_messages

        existing = list_messages(
            tenant_id=tenant_id,
            driver_id=driver_id,
            limit=1,
            viewer="office",
        )
        if not existing and not get_driver(driver_id):
            raise HTTPException(status_code=404, detail="Ο οδηγός δεν βρέθηκε")
    try:
        row = append_message(
            tenant_id=tenant_id,
            driver_id=driver_id,
            sender="office",
            body=body.body,
            trip_id=body.trip_id,
            sender_name=body.sender_name or "Γραφείο",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        from travel_platform.notifications.driver_chat_push import notify_office_message_to_driver

        await notify_office_message_to_driver(
            tenant_id=tenant_id,
            driver_id=driver_id,
            body=str(row.get("body") or body.body),
            message_id=str(row.get("id") or "") or None,
            sender_name=body.sender_name or "Γραφείο",
        )
    except Exception:
        # Chat send must succeed even if push delivery fails.
        pass

    return {"ok": True, "message": row}


@router.post("/driver-chat/{driver_id}/read")
async def admin_chat_read(driver_id: str, request: Request):
    from travel_platform.driver.chat_store import mark_thread_read

    tenant_id = await _chat_tenant_id(request)
    # Mark read even when the driver row is missing / demo-tenant mismatched.
    from travel_platform.driver.chat_store import list_messages

    existing = list_messages(
        tenant_id=tenant_id,
        driver_id=driver_id,
        limit=1,
        viewer="office",
    )
    if not existing and not _driver_for_chat(driver_id, tenant_id):
        raise HTTPException(status_code=404, detail="Ο οδηγός δεν βρέθηκε")
    changed = mark_thread_read(tenant_id=tenant_id, driver_id=driver_id, reader="office")
    return {"ok": True, "marked": changed, "driver_id": driver_id}
