"""Durable JSON / upload roots — prefer POREIAGO_DATA_DIR (Docker: /app/data)."""

from __future__ import annotations

import os
import shutil
from pathlib import Path


def poreiago_data_dir() -> Path:
    raw = (os.getenv("POREIAGO_DATA_DIR") or "").strip()
    if raw:
        return Path(raw)
    # backend/data when running from source without env
    return Path(__file__).resolve().parents[2] / "data"


def migrate_file_once(primary: Path, legacy: Path) -> Path:
    """Prefer primary under data dir; copy legacy once if needed."""
    if primary.is_file():
        return primary
    if legacy.is_file() and legacy.resolve() != primary.resolve():
        try:
            primary.parent.mkdir(parents=True, exist_ok=True)
            if not primary.exists():
                shutil.copy2(legacy, primary)
            return primary
        except OSError:
            return legacy
    return primary


def resolve_data_file(filename: str, *legacy_paths: Path) -> Path:
    primary = poreiago_data_dir() / filename
    for legacy in legacy_paths:
        primary = migrate_file_once(primary, legacy)
        if primary.is_file():
            return primary
    return primary
