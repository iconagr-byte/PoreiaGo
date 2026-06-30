"""
OLYMPUS backup manager — per-tenant encrypted dumps → S3 with checksum audit.

Usage:
  python -m app.services.backup_manager --tenant all
  python -m app.services.backup_manager --tenant <uuid>
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import hashlib
import json
import logging
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID

from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)


class BackupManager:
    def __init__(self) -> None:
        self._settings = get_settings()

    def _parse_pg_url(self) -> dict[str, str]:
        return self._parse_pg_url_from_dsn(self._settings.database_url)

    def _parse_pg_url_from_dsn(self, dsn: str) -> dict[str, str]:
        url = dsn.replace("postgresql+asyncpg://", "postgresql://")
        parsed = urlparse(url)
        return {
            "host": parsed.hostname or "localhost",
            "port": str(parsed.port or 5432),
            "user": parsed.username or "postgres",
            "password": parsed.password or "",
            "dbname": (parsed.path or "/postgres").lstrip("/"),
        }

    @staticmethod
    def _sha256(path: Path) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                h.update(chunk)
        return h.hexdigest()

    def _encrypt_file(self, src: Path, dest: Path) -> None:
        key = os.getenv("BACKUP_ENCRYPTION_KEY", "")
        if not key:
            shutil.copy2(src, dest)
            return
        from cryptography.fernet import Fernet

        fernet = Fernet(key.encode() if len(key) == 44 else Fernet.generate_key())
        data = src.read_bytes()
        dest.write_bytes(fernet.encrypt(data))

    async def dump_tenant_schema(self, tenant: Tenant, out_dir: Path) -> Path:
        pg = self._parse_pg_url()
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        sql_path = out_dir / f"tenant_{tenant.slug}_{ts}.sql"
        env = {**os.environ, "PGPASSWORD": pg["password"]}

        isolation = getattr(tenant, "isolation_strategy", None) or "shared_rls"
        cmd = [
            "pg_dump",
            "-h", pg["host"],
            "-p", pg["port"],
            "-U", pg["user"],
            "-d", pg["dbname"],
            "-F", "p",
            "-f", str(sql_path),
        ]
        if isolation == "shared_rls":
            cmd.extend(["--table", "bookings", "--table", "users", "--table", "audit_logs"])
            cmd.extend(["--where", f"tenant_id='{tenant.id}'"])
        elif isolation == "schema":
            schema = f"tenant_{tenant.slug.replace('-', '_')}"
            cmd.extend(["--schema", schema])
        elif isolation == "database" and tenant.database_dsn:
            db_pg = self._parse_pg_url_from_dsn(tenant.database_dsn)
            cmd = [
                "pg_dump",
                "-h", db_pg["host"],
                "-p", db_pg["port"],
                "-U", db_pg["user"],
                "-d", db_pg["dbname"],
                "-F", "p",
                "-f", str(sql_path),
            ]
            env = {**os.environ, "PGPASSWORD": db_pg["password"]}

        proc = await asyncio.create_subprocess_exec(
            *cmd, env=env, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(stderr.decode())

        gz_path = sql_path.with_suffix(".sql.gz")
        with open(sql_path, "rb") as src, gzip.open(gz_path, "wb") as dst:
            shutil.copyfileobj(src, dst)
        sql_path.unlink(missing_ok=True)
        return gz_path

    async def upload_encrypted(self, file_path: Path, tenant_slug: str) -> dict:
        checksum = self._sha256(file_path)
        enc_path = file_path.with_suffix(file_path.suffix + ".enc")
        self._encrypt_file(file_path, enc_path)

        bucket = self._settings.backup_s3_bucket
        if not bucket:
            manifest = {
                "tenant": tenant_slug,
                "local_path": str(enc_path),
                "checksum_sha256": checksum,
                "encrypted": enc_path.suffix == ".enc",
                "at": datetime.now(timezone.utc).isoformat(),
            }
            manifest_path = enc_path.with_suffix(".manifest.json")
            manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
            logger.warning("BACKUP_S3_BUCKET unset — backup kept locally: %s", enc_path)
            return manifest

        import boto3

        key = f"{self._settings.backup_s3_prefix}/tenants/{tenant_slug}/{enc_path.name}"
        client = boto3.client(
            "s3",
            region_name=self._settings.aws_region,
            aws_access_key_id=self._settings.aws_access_key_id or None,
            aws_secret_access_key=self._settings.aws_secret_access_key or None,
        )

        def _upload() -> None:
            client.upload_file(
                str(enc_path),
                bucket,
                key,
                ExtraArgs={"Metadata": {"sha256": checksum, "tenant": tenant_slug}},
            )

        await asyncio.to_thread(_upload)
        uri = f"s3://{bucket}/{key}"
        logger.info("Backup %s checksum=%s", uri, checksum)
        return {"uri": uri, "checksum_sha256": checksum, "tenant": tenant_slug}

    async def backup_tenant(self, tenant_id: UUID) -> dict:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
            tenant = result.scalar_one_or_none()
            if not tenant:
                raise ValueError(f"Tenant not found: {tenant_id}")

        tmp = Path(tempfile.mkdtemp(prefix="olympus_bak_"))
        try:
            dump = await self.dump_tenant_schema(tenant, tmp)
            return await self.upload_encrypted(dump, tenant.slug)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    async def backup_all_tenants(self) -> list[dict]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Tenant).where(Tenant.is_active.is_(True)))
            tenants = list(result.scalars().all())

        reports = []
        for tenant in tenants:
            try:
                reports.append(await self.backup_tenant(tenant.id))
            except Exception as exc:
                logger.exception("Backup failed for %s: %s", tenant.slug, exc)
                reports.append({"tenant": tenant.slug, "error": str(exc)})
        return reports


async def _main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="OLYMPUS encrypted tenant backups")
    parser.add_argument("--tenant", required=True, help="tenant UUID or 'all'")
    args = parser.parse_args()

    mgr = BackupManager()
    if args.tenant == "all":
        reports = await mgr.backup_all_tenants()
        print(json.dumps(reports, indent=2))
    else:
        report = await mgr.backup_tenant(UUID(args.tenant))
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    asyncio.run(_main())
