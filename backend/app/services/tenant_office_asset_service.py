"""Tenant-scoped logo/hero files for office site appearance."""

from __future__ import annotations

from pathlib import Path
from uuid import UUID

from app.core.data_paths import poreiago_data_dir
from travel_platform.media.image_optimize import optimize_driver_photo

_ALLOWED_KINDS = frozenset({"logo", "hero"})
_MAX_BYTES = 4 * 1024 * 1024


def office_asset_root() -> Path:
    root = poreiago_data_dir() / "uploads" / "office_site"
    root.mkdir(parents=True, exist_ok=True)
    return root


def tenant_asset_dir(tenant_id: UUID) -> Path:
    d = office_asset_root() / str(tenant_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def public_asset_url(tenant_id: UUID, kind: str, filename: str) -> str:
    return f"/api/site/office-assets/{tenant_id}/{kind}/{filename}"


def save_office_asset(
    tenant_id: UUID,
    kind: str,
    *,
    content: bytes,
    filename: str | None = None,
) -> dict:
    kind = str(kind or "").strip().lower()
    if kind not in _ALLOWED_KINDS:
        raise ValueError("Invalid asset kind")
    if not content:
        raise ValueError("Άδειο αρχείο")
    if len(content) > _MAX_BYTES:
        raise ValueError("Η εικόνα είναι πολύ μεγάλη (μέγ. 4 MB)")

    max_side = 640 if kind == "logo" else 1600
    quality = 86 if kind == "logo" else 84
    optimized = optimize_driver_photo(content, max_side=max_side, quality=quality)
    if optimized.ext in (".bin", ".heic"):
        raise ValueError("Μη έγκυρη εικόνα — δοκιμάστε JPG ή PNG")

    folder = tenant_asset_dir(tenant_id)
    for old in folder.glob(f"{kind}.*"):
        old.unlink(missing_ok=True)

    stable = folder / f"{kind}{optimized.ext}"
    stable.write_bytes(optimized.content)
    url = public_asset_url(tenant_id, kind, stable.name)
    return {
        "ok": True,
        "kind": kind,
        "url": url,
        "filename": stable.name,
        "bytes": len(optimized.content),
        "content_type": optimized.content_type,
    }


def clear_office_asset(tenant_id: UUID, kind: str) -> None:
    kind = str(kind or "").strip().lower()
    if kind not in _ALLOWED_KINDS:
        raise ValueError("Invalid asset kind")
    folder = tenant_asset_dir(tenant_id)
    for old in folder.glob(f"{kind}.*"):
        old.unlink(missing_ok=True)


def resolve_office_asset_path(tenant_id: UUID, kind: str, filename: str) -> Path | None:
    kind = str(kind or "").strip().lower()
    if kind not in _ALLOWED_KINDS:
        return None
    name = Path(str(filename or "")).name
    if not name or ".." in name:
        return None
    if not name.startswith(f"{kind}."):
        return None
    path = (tenant_asset_dir(tenant_id) / name).resolve()
    root = tenant_asset_dir(tenant_id).resolve()
    if not str(path).startswith(str(root)) or not path.is_file():
        return None
    return path
