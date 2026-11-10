"""Platform / office / database backups under data/backups/."""

from __future__ import annotations

import json
import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from travel_platform.settings.drivers_store import (
    drivers_for_export,
    replace_drivers_for_tenant,
    replace_drivers_from_backup,
)
from travel_platform.settings.office_customers_store import (
    list_customers,
    replace_customers_for_tenant,
)
from travel_platform.settings.payment_settings_store import (
    read_payment_settings,
    write_payment_settings,
)
from travel_platform.settings.platform_store import get_platform_config, update_platform_config
from travel_platform.settings.seat_pricing_store import read_seat_pricing, write_seat_pricing
from travel_platform.settings.users_store import replace_users_from_backup, users_for_export
from travel_platform.telemetry.settings_store import get_telemetry_settings

logger = logging.getLogger(__name__)

_WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
BACKUP_DIR = Path(os.getenv("PLATFORM_BACKUP_DIR", str(_WORKSPACE_ROOT / "data" / "backups")))

SCOPE_PLATFORM = "platform"
SCOPE_OFFICE = "office"
SCOPE_DATABASE = "database"

OFFICE_INCLUDES = [
    "tenant",
    "appearance",
    "admin_ui",
    "customers",
    "drivers",
    "office_users",
    "trip_catalog",
    "payment_settings",
    "seat_pricing",
    "bookings",
]


def _ensure_dir() -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    return BACKUP_DIR


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if hasattr(value, "value") and not isinstance(value, type):
        try:
            return _json_safe(value.value)
        except Exception:
            pass
    if hasattr(value, "__float__") and type(value).__name__ == "Decimal":
        return float(value)
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    return str(value)


def _parse_settings_json(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _meta_from_payload(payload: dict[str, Any], *, fallback_id: str, size_bytes: int, created_at: str) -> dict[str, Any]:
    scope = str(payload.get("scope") or SCOPE_PLATFORM)
    includes = payload.get("includes")
    if not isinstance(includes, list):
        includes = [k for k in payload.keys() if k not in ("version", "created_at", "scope", "tenant_id", "tenant_label")]
    return {
        "id": fallback_id,
        "filename": f"{fallback_id}.json",
        "size_bytes": size_bytes,
        "created_at": created_at or payload.get("created_at") or _now().isoformat(),
        "scope": scope,
        "tenant_id": payload.get("tenant_id"),
        "tenant_label": payload.get("tenant_label"),
        "includes": [str(x) for x in includes],
        "kind": "json",
        "restorable": scope != SCOPE_DATABASE,
    }


def list_backups() -> list[dict[str, Any]]:
    root = _ensure_dir()
    items: list[dict[str, Any]] = []

    for path in root.glob("backup-*.json"):
        if path.name.endswith(".meta.json"):
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            payload = {}
        stat = path.stat()
        created = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
        meta = _meta_from_payload(
            payload if isinstance(payload, dict) else {},
            fallback_id=path.stem,
            size_bytes=stat.st_size,
            created_at=created,
        )
        meta["filename"] = path.name
        items.append(meta)

    for path in root.glob("database-*.sql.gz"):
        meta_path = path.with_suffix("").with_suffix(".meta.json")  # database-xxx.sql.meta.json — fix
        # path = database-FOO.sql.gz → stem chain: .gz then .sql
        meta_path = Path(str(path).removesuffix(".sql.gz") + ".meta.json")
        payload: dict[str, Any] = {}
        if meta_path.is_file():
            try:
                payload = json.loads(meta_path.read_text(encoding="utf-8"))
            except Exception:
                payload = {}
        stat = path.stat()
        created = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
        items.append(
            {
                "id": path.name.removesuffix(".sql.gz"),
                "filename": path.name,
                "size_bytes": stat.st_size,
                "created_at": payload.get("created_at") or created,
                "scope": SCOPE_DATABASE,
                "tenant_id": payload.get("tenant_id"),
                "tenant_label": payload.get("tenant_label"),
                "includes": payload.get("includes") or ["postgres_dump"],
                "kind": "database",
                "restorable": False,
                "db_mode": payload.get("db_mode") or ("office" if payload.get("tenant_id") else "full"),
            }
        )

    items.sort(key=lambda b: str(b.get("created_at") or ""), reverse=True)
    return items


def create_backup() -> dict[str, Any]:
    """Legacy platform-wide JSON snapshot (all offices' drivers/users)."""
    return create_platform_backup()


def create_platform_backup() -> dict[str, Any]:
    root = _ensure_dir()
    now = _now()
    backup_id = f"backup-{now.strftime('%Y%m%d-%H%M%S')}-{uuid4().hex[:6]}"
    path = root / f"{backup_id}.json"

    payload = {
        "version": 2,
        "scope": SCOPE_PLATFORM,
        "created_at": now.isoformat(),
        "includes": ["platform_settings", "telemetry_settings", "users", "drivers"],
        "platform_settings": get_platform_config().__dict__,
        "telemetry_settings": get_telemetry_settings().__dict__,
        "users": users_for_export(),
        "drivers": drivers_for_export(),
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return _meta_from_payload(payload, fallback_id=backup_id, size_bytes=path.stat().st_size, created_at=now.isoformat()) | {
        "path": str(path),
        "filename": path.name,
    }


async def _load_tenant_row(tenant_id: str) -> dict[str, Any]:
    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.models.tenant import Tenant

    tid = UUID(str(tenant_id))
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Tenant).where(Tenant.id == tid).limit(1))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise ValueError(f"Το γραφείο δεν βρέθηκε: {tenant_id}")
        settings = _parse_settings_json(tenant.settings_json)
        appearance = settings.get("site_appearance") if isinstance(settings.get("site_appearance"), dict) else {}
        label = tenant.legal_name or tenant.slug or str(tenant.id)
        return {
            "tenant": {
                "id": str(tenant.id),
                "slug": tenant.slug,
                "legal_name": tenant.legal_name,
                "subdomain": tenant.subdomain,
                "custom_domain": tenant.custom_domain,
                "plan": getattr(tenant.plan, "value", tenant.plan),
                "is_active": bool(tenant.is_active),
                "settings_json": tenant.settings_json,
                "theme_config": tenant.theme_config,
                "isolation_strategy": tenant.isolation_strategy,
            },
            "appearance": appearance,
            "tenant_label": label,
            "settings": settings,
        }


async def _export_office_users(tenant_id: str) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.models.user import User

    tid = UUID(str(tenant_id))
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.tenant_id == tid))
        rows = result.scalars().all()
        out = []
        for u in rows:
            out.append(
                {
                    "id": str(u.id),
                    "email": u.email,
                    "full_name": u.full_name,
                    "roles": list(u.roles or []),
                    "is_active": bool(u.is_active),
                    "password_hash": u.password_hash,
                    "mfa_enabled": bool(u.mfa_enabled),
                }
            )
        return out


async def _export_office_bookings(tenant_id: str) -> list[dict[str, Any]]:
    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking

    tid = UUID(str(tenant_id))
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Booking).where(Booking.tenant_id == tid))
        rows = result.scalars().all()
        out = []
        for b in rows:
            out.append(
                _json_safe(
                    {
                        "id": b.id,
                        "trip_id": b.trip_id,
                        "customer_user_id": b.customer_user_id,
                        "reference_code": b.reference_code,
                        "status": b.status,
                        "payment_status": b.payment_status,
                        "seat_label": b.seat_label,
                        "passenger_name": b.passenger_name,
                        "passenger_email": b.passenger_email,
                        "passenger_vat_id": b.passenger_vat_id,
                        "total_price": b.total_price,
                        "amount_paid": b.amount_paid,
                        "amount_eur": b.amount_eur,
                        "fiscal_mark": b.fiscal_mark,
                        "currency": b.currency,
                        "metadata_json": b.metadata_json,
                        "notes": b.notes,
                    }
                )
            )
        return out


async def create_office_backup(
    tenant_id: str,
    *,
    client_extras: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Full office snapshot: appearance, menus (client), customers, drivers, trips, payments, bookings."""
    from travel_platform.operations.tenant_trip_catalog_store import list_tenant_trips

    tid = str(tenant_id or "").strip()
    if not tid:
        raise ValueError("Απαιτείται γραφείο (tenant_id)")

    loaded = await _load_tenant_row(tid)
    trips = list_tenant_trips(tid, published_only=False)
    customers = list_customers(tid)
    drivers = drivers_for_export(tid)
    try:
        office_users = await _export_office_users(tid)
    except Exception as exc:
        logger.warning("office users export failed: %s", exc)
        office_users = []
    try:
        bookings = await _export_office_bookings(tid)
    except Exception as exc:
        logger.warning("office bookings export failed: %s", exc)
        bookings = []

    extras = client_extras if isinstance(client_extras, dict) else {}
    admin_ui = {
        "nav_layout": extras.get("nav_layout"),
        "nav_order": extras.get("nav_order"),
        "nav_service_mode": extras.get("nav_service_mode"),
        "buses_hub_layout": extras.get("buses_hub_layout"),
    }

    now = _now()
    slug = str(loaded["tenant"].get("slug") or "office")[:40]
    backup_id = f"backup-office-{slug}-{now.strftime('%Y%m%d-%H%M%S')}-{uuid4().hex[:6]}"
    path = _ensure_dir() / f"{backup_id}.json"

    payload = {
        "version": 2,
        "scope": SCOPE_OFFICE,
        "created_at": now.isoformat(),
        "tenant_id": tid,
        "tenant_label": loaded["tenant_label"],
        "includes": list(OFFICE_INCLUDES),
        "tenant": loaded["tenant"],
        "appearance": loaded["appearance"],
        "admin_ui": admin_ui,
        "customers": customers,
        "drivers": drivers,
        "office_users": office_users,
        "trip_catalog": trips,
        "payment_settings": read_payment_settings(tid),
        "seat_pricing": read_seat_pricing(tid),
        "bookings": bookings,
    }
    path.write_text(json.dumps(_json_safe(payload), indent=2, ensure_ascii=False), encoding="utf-8")
    return _meta_from_payload(payload, fallback_id=backup_id, size_bytes=path.stat().st_size, created_at=now.isoformat()) | {
        "path": str(path),
        "filename": path.name,
    }


async def create_database_backup() -> dict[str, Any]:
    """Full Postgres dump (pg_dump → .sql.gz). Download-only — not restorable via UI."""
    from app.services.backup_service import BackupService

    now = _now()
    backup_id = f"database-{now.strftime('%Y%m%d-%H%M%S')}-{uuid4().hex[:6]}"
    root = _ensure_dir()
    dump_path = await BackupService().create_dump()
    tmp_parent = dump_path.parent
    try:
        dest = root / f"{backup_id}.sql.gz"
        shutil.move(str(dump_path), str(dest))
        meta = {
            "version": 2,
            "scope": SCOPE_DATABASE,
            "created_at": now.isoformat(),
            "includes": ["postgres_dump"],
            "filename": dest.name,
            "id": backup_id,
            "db_mode": "full",
        }
        meta_path = root / f"{backup_id}.meta.json"
        meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        return {
            "id": backup_id,
            "filename": dest.name,
            "size_bytes": dest.stat().st_size,
            "created_at": now.isoformat(),
            "scope": SCOPE_DATABASE,
            "tenant_id": None,
            "tenant_label": None,
            "includes": ["postgres_dump"],
            "kind": "database",
            "restorable": False,
            "db_mode": "full",
            "path": str(dest),
        }
    finally:
        shutil.rmtree(tmp_parent, ignore_errors=True)


async def create_office_database_backup(tenant_id: str) -> dict[str, Any]:
    """Postgres dump filtered to one office (tenant_id). Download-only."""
    import tempfile

    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.models.tenant import Tenant
    from app.services.backup_manager import BackupManager

    tid = str(tenant_id or "").strip()
    if not tid:
        raise ValueError("Απαιτείται γραφείο για DB backup ανά γραφείο")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Tenant).where(Tenant.id == UUID(tid)).limit(1))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise ValueError(f"Το γραφείο δεν βρέθηκε: {tenant_id}")

    now = _now()
    slug = str(tenant.slug or "office")[:40]
    backup_id = f"database-office-{slug}-{now.strftime('%Y%m%d-%H%M%S')}-{uuid4().hex[:6]}"
    root = _ensure_dir()
    tmp_dir = Path(tempfile.mkdtemp(prefix="office_pg_dump_"))
    try:
        dump_path = await BackupManager().dump_tenant_schema(tenant, tmp_dir)
        dest = root / f"{backup_id}.sql.gz"
        shutil.move(str(dump_path), str(dest))
        label = tenant.legal_name or tenant.slug or tid
        meta = {
            "version": 2,
            "scope": SCOPE_DATABASE,
            "created_at": now.isoformat(),
            "includes": ["postgres_office_dump"],
            "filename": dest.name,
            "id": backup_id,
            "tenant_id": tid,
            "tenant_label": label,
            "db_mode": "office",
        }
        meta_path = root / f"{backup_id}.meta.json"
        meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
        return {
            "id": backup_id,
            "filename": dest.name,
            "size_bytes": dest.stat().st_size,
            "created_at": now.isoformat(),
            "scope": SCOPE_DATABASE,
            "tenant_id": tid,
            "tenant_label": label,
            "includes": ["postgres_office_dump"],
            "kind": "database",
            "restorable": False,
            "db_mode": "office",
            "path": str(dest),
        }
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def resolve_backup_path(backup_id: str) -> Path:
    root = _ensure_dir()
    bid = str(backup_id or "").strip()
    if not bid or "/" in bid or ".." in bid:
        raise FileNotFoundError(backup_id)
    for candidate in (
        root / f"{bid}.json",
        root / f"{bid}.sql.gz",
    ):
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(backup_id)


def read_backup(backup_id: str) -> dict[str, Any]:
    path = resolve_backup_path(backup_id)
    if path.suffix == ".gz" or path.name.endswith(".sql.gz"):
        raise ValueError("Το database dump δεν ανοίγει ως JSON — κατεβάστε το αρχείο")
    return json.loads(path.read_text(encoding="utf-8"))


async def _restore_office(data: dict[str, Any]) -> dict[str, Any]:
    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.models.tenant import Tenant
    from travel_platform.operations.tenant_trip_catalog_store import replace_tenant_catalog

    tid = str(data.get("tenant_id") or (data.get("tenant") or {}).get("id") or "").strip()
    if not tid:
        raise ValueError("Το office backup δεν έχει tenant_id")

    tenant_blob = data.get("tenant") if isinstance(data.get("tenant"), dict) else {}
    restored = {
        "restored": True,
        "message": f"Επαναφορά γραφείου από backup",
        "restored_users": 0,
        "restored_drivers": 0,
        "restored_settings": False,
        "restored_customers": 0,
        "restored_trips": 0,
        "admin_ui": data.get("admin_ui") if isinstance(data.get("admin_ui"), dict) else {},
        "scope": SCOPE_OFFICE,
        "tenant_id": tid,
    }

    # Tenant appearance / settings
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Tenant).where(Tenant.id == UUID(tid)).limit(1))
            tenant = result.scalar_one_or_none()
            if tenant:
                if tenant_blob.get("settings_json") is not None:
                    tenant.settings_json = tenant_blob.get("settings_json")
                elif isinstance(data.get("appearance"), dict):
                    settings = _parse_settings_json(tenant.settings_json)
                    settings["site_appearance"] = data["appearance"]
                    tenant.settings_json = json.dumps(settings, ensure_ascii=False)
                if tenant_blob.get("theme_config") is not None:
                    tenant.theme_config = tenant_blob.get("theme_config")
                await db.commit()
                restored["restored_settings"] = True
    except Exception as exc:
        logger.exception("office tenant restore failed: %s", exc)

    if isinstance(data.get("customers"), list):
        rows = replace_customers_for_tenant(tid, data["customers"])
        restored["restored_customers"] = len(rows) if isinstance(rows, list) else 0

    if isinstance(data.get("drivers"), list):
        restored["restored_drivers"] = replace_drivers_for_tenant(tid, data["drivers"])

    if isinstance(data.get("trip_catalog"), list):
        restored["restored_trips"] = replace_tenant_catalog(tid, data["trip_catalog"])

    if isinstance(data.get("payment_settings"), dict):
        write_payment_settings(data["payment_settings"], tid)

    if isinstance(data.get("seat_pricing"), dict):
        write_seat_pricing(data["seat_pricing"], tid)

    # Office staff users — best-effort upsert by email
    users = data.get("office_users") if isinstance(data.get("office_users"), list) else []
    if users:
        try:
            from app.core.database import AsyncSessionLocal
            from app.models.user import User
            from sqlalchemy import select

            async with AsyncSessionLocal() as db:
                for row in users:
                    if not isinstance(row, dict):
                        continue
                    email = str(row.get("email") or "").strip().lower()
                    if not email:
                        continue
                    existing = (
                        await db.execute(
                            select(User).where(User.tenant_id == UUID(tid), User.email == email).limit(1)
                        )
                    ).scalar_one_or_none()
                    if existing:
                        existing.full_name = str(row.get("full_name") or existing.full_name)
                        if row.get("password_hash"):
                            existing.password_hash = str(row["password_hash"])
                        if isinstance(row.get("roles"), list):
                            existing.roles = [str(r) for r in row["roles"]]
                        existing.is_active = bool(row.get("is_active", True))
                    else:
                        pw = str(row.get("password_hash") or "").strip()
                        if not pw:
                            continue
                        db.add(
                            User(
                                id=UUID(str(row["id"])) if row.get("id") else uuid4(),
                                tenant_id=UUID(tid),
                                email=email,
                                full_name=str(row.get("full_name") or email.split("@")[0]),
                                password_hash=pw,
                                roles=[str(r) for r in (row.get("roles") or ["tenant_admin"])],
                                is_active=bool(row.get("is_active", True)),
                            )
                        )
                    restored["restored_users"] += 1
                await db.commit()
        except Exception as exc:
            logger.warning("office users restore failed: %s", exc)

    return restored


def _restore_platform(data: dict[str, Any], backup_id: str) -> dict[str, Any]:
    restored_users = 0
    restored_drivers = 0
    restored_settings = False

    if data.get("platform_settings"):
        update_platform_config(data["platform_settings"])
        restored_settings = True

    if data.get("telemetry_settings"):
        from travel_platform.telemetry.settings_store import update_telemetry_settings

        update_telemetry_settings(data["telemetry_settings"])

    if data.get("users"):
        restored_users = replace_users_from_backup(data["users"])

    if data.get("drivers"):
        restored_drivers = replace_drivers_from_backup(data["drivers"])

    return {
        "restored": True,
        "message": f"Επαναφορά πλατφόρμας από {backup_id}",
        "restored_users": restored_users,
        "restored_drivers": restored_drivers,
        "restored_settings": restored_settings,
        "scope": SCOPE_PLATFORM,
        "admin_ui": {},
    }


def restore_backup(backup_id: str) -> dict[str, Any]:
    data = read_backup(backup_id)
    scope = str(data.get("scope") or SCOPE_PLATFORM)
    if scope == SCOPE_DATABASE:
        raise ValueError("Το database dump δεν επαναφέρεται από το UI — χρησιμοποιήστε pg_restore στον server")
    if scope == SCOPE_OFFICE:
        import asyncio

        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(_restore_office(data))
        raise RuntimeError("Use restore_backup_async inside async context")
    return _restore_platform(data, backup_id)


async def restore_backup_async(backup_id: str) -> dict[str, Any]:
    data = read_backup(backup_id)
    scope = str(data.get("scope") or SCOPE_PLATFORM)
    if scope == SCOPE_DATABASE:
        raise ValueError("Το database dump δεν επαναφέρεται από το UI — χρησιμοποιήστε pg_restore στον server")
    if scope == SCOPE_OFFICE:
        return await _restore_office(data)
    return _restore_platform(data, backup_id)


def delete_backup(backup_id: str) -> None:
    path = resolve_backup_path(backup_id)
    path.unlink(missing_ok=True)
    meta = BACKUP_DIR / f"{backup_id}.meta.json"
    if meta.is_file():
        meta.unlink()
