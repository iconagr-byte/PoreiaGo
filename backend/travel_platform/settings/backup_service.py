"""Platform backup — JSON snapshots to data/backups/."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from travel_platform.settings.platform_store import get_platform_config, update_platform_config
from travel_platform.settings.drivers_store import drivers_for_export, replace_drivers_from_backup
from travel_platform.settings.users_store import replace_users_from_backup, users_for_export
from travel_platform.telemetry.settings_store import get_telemetry_settings

_WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
BACKUP_DIR = Path(os.getenv("PLATFORM_BACKUP_DIR", str(_WORKSPACE_ROOT / "data" / "backups")))


def _ensure_dir() -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    return BACKUP_DIR


def list_backups() -> list[dict[str, Any]]:
    root = _ensure_dir()
    items = []
    for path in sorted(root.glob("backup-*.json"), reverse=True):
        stat = path.stat()
        items.append(
            {
                "id": path.stem,
                "filename": path.name,
                "size_bytes": stat.st_size,
                "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                "includes": ["platform_settings", "telemetry_settings", "users", "drivers"],
            }
        )
    return items


def create_backup() -> dict[str, Any]:
    root = _ensure_dir()
    now = datetime.now(timezone.utc)
    backup_id = f"backup-{now.strftime('%Y%m%d-%H%M%S')}-{uuid4().hex[:6]}"
    path = root / f"{backup_id}.json"

    payload = {
        "version": 1,
        "created_at": now.isoformat(),
        "platform_settings": get_platform_config().__dict__,
        "telemetry_settings": get_telemetry_settings().__dict__,
        "users": users_for_export(),
        "drivers": drivers_for_export(),
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    stat = path.stat()
    return {
        "id": backup_id,
        "filename": path.name,
        "size_bytes": stat.st_size,
        "created_at": now.isoformat(),
        "includes": list(payload.keys()),
        "path": str(path),
    }


def read_backup(backup_id: str) -> dict[str, Any]:
    path = _ensure_dir() / f"{backup_id}.json"
    if not path.is_file():
        raise FileNotFoundError(backup_id)
    return json.loads(path.read_text(encoding="utf-8"))


def restore_backup(backup_id: str) -> dict[str, Any]:
    data = read_backup(backup_id)
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
        "message": f"Επαναφορά από {backup_id}",
        "restored_users": restored_users,
        "restored_drivers": restored_drivers,
        "restored_settings": restored_settings,
    }


def delete_backup(backup_id: str) -> None:
    path = _ensure_dir() / f"{backup_id}.json"
    if path.is_file():
        path.unlink()
