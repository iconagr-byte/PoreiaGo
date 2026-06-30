"""
Backup / DR — pg_dump → gzip → S3.

Run via cron, Celery beat, or `python -m app.services.backup_service`.
"""

from __future__ import annotations

import asyncio
import gzip
import logging
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class BackupService:
    def __init__(self) -> None:
        self._settings = get_settings()

    def _parse_pg_url(self) -> dict[str, str]:
        url = self._settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
        parsed = urlparse(url)
        return {
            "host": parsed.hostname or "localhost",
            "port": str(parsed.port or 5432),
            "user": parsed.username or "postgres",
            "password": parsed.password or "",
            "dbname": (parsed.path or "/postgres").lstrip("/"),
        }

    async def create_dump(self) -> Path:
        pg = self._parse_pg_url()
        tmp_dir = Path(tempfile.mkdtemp(prefix="saas_pg_dump_"))
        sql_path = tmp_dir / f"dump_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.sql"
        env = {**os.environ, "PGPASSWORD": pg["password"]}
        cmd = [
            "pg_dump",
            "-h",
            pg["host"],
            "-p",
            pg["port"],
            "-U",
            pg["user"],
            "-d",
            pg["dbname"],
            "-F",
            "p",
            "-f",
            str(sql_path),
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            raise RuntimeError(f"pg_dump failed: {stderr.decode()}")
        gz_path = sql_path.with_suffix(".sql.gz")
        with open(sql_path, "rb") as src, gzip.open(gz_path, "wb") as dst:
            shutil.copyfileobj(src, dst)
        sql_path.unlink(missing_ok=True)
        return gz_path

    async def upload_to_s3(self, file_path: Path) -> str:
        bucket = self._settings.backup_s3_bucket
        if not bucket:
            raise ValueError("BACKUP_S3_BUCKET is not configured")

        import boto3

        key = f"{self._settings.backup_s3_prefix}/{file_path.name}"
        client = boto3.client(
            "s3",
            region_name=self._settings.aws_region,
            aws_access_key_id=self._settings.aws_access_key_id or None,
            aws_secret_access_key=self._settings.aws_secret_access_key or None,
        )

        def _upload() -> None:
            client.upload_file(str(file_path), bucket, key)

        await asyncio.to_thread(_upload)
        s3_uri = f"s3://{bucket}/{key}"
        logger.info("Backup uploaded to %s", s3_uri)
        return s3_uri

    async def run_full_backup(self) -> str:
        dump_path = await self.create_dump()
        try:
            return await self.upload_to_s3(dump_path)
        finally:
            shutil.rmtree(dump_path.parent, ignore_errors=True)


async def _main() -> None:
    logging.basicConfig(level=logging.INFO)
    uri = await BackupService().run_full_backup()
    print(uri)


if __name__ == "__main__":
    asyncio.run(_main())
