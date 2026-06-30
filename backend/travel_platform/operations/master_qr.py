"""
Master QR — one-time / daily token for drivers to load manifest without manual login.
Scanning the Master QR on the driver PWA exchanges for a short-lived driver session JWT.
"""

from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

import jwt
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_service import TenantScopedService
from core.config import platform_settings
from travel_platform.operations.master_qr_normalize import build_driver_auth_url, normalize_master_qr_input

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MasterQrPayload:
    qr_token: str
    auth_url: str
    trip_id: int
    tenant_id: UUID
    driver_id: str | None
    expires_at: datetime
    manifest_url: str

    @property
    def token(self) -> str:
        """Primary QR payload (magic link URL)."""
        return self.auth_url


class MasterQrService(TenantScopedService):
    """Issues and validates Master QR tokens bound to trip + tenant."""

    SCOPE = "manifest:read driver:scan"

    def __init__(self, session: AsyncSession, tenant_id: UUID, **kwargs):
        super().__init__(session, tenant_id, **kwargs)
        secret = platform_settings.master_qr_secret or platform_settings.auth_jwt_secret
        if not secret:
            raise MasterQrError("master_qr_secret or auth_jwt_secret must be configured")
        self._secret = secret
        self._ttl_hours = platform_settings.master_qr_ttl_hours

    async def issue_for_trip(
        self,
        trip_id: int,
        *,
        driver_id: str | None = None,
        issued_by: str | None = None,
    ) -> MasterQrPayload:
        await self._verify_trip_belongs_to_tenant(trip_id)
        now = datetime.now(timezone.utc)
        exp_ts = int(time.time()) + self._ttl_hours * 3600
        payload = {
            "typ": "master_qr",
            "tenant_id": str(self._tenant_id),
            "trip_id": trip_id,
            "driver_id": driver_id,
            "scope": self.SCOPE,
            "iat": int(now.timestamp()),
            "exp": exp_ts,
        }
        token = jwt.encode(payload, self._secret, algorithm="HS256")
        qr_token = self._wrap_qr_content(token)
        auth_url = build_driver_auth_url(qr_token)

        await self._persist_master_qr_record(trip_id, token_hash=self._hash(token), exp_ts=exp_ts)
        await self._audit(
            "operations.master_qr_issued",
            "trip",
            str(trip_id),
            metadata={"driver_id": driver_id, "issued_by": issued_by},
        )

        return MasterQrPayload(
            qr_token=qr_token,
            auth_url=auth_url,
            trip_id=trip_id,
            tenant_id=self._tenant_id,
            driver_id=driver_id,
            expires_at=datetime.fromtimestamp(exp_ts, tz=timezone.utc),
            manifest_url=f"/admin/boarding/{trip_id}",
        )

    async def exchange_for_driver_session(self, qr_raw: str) -> dict:
        """Driver app scans Master QR → returns driver JWT + manifest bootstrap."""
        token = self._unwrap_qr_content(normalize_master_qr_input(qr_raw))
        try:
            payload = jwt.decode(token, self._secret, algorithms=["HS256"])
        except jwt.PyJWTError as e:
            raise MasterQrError("Invalid or expired Master QR") from e

        if payload.get("typ") != "master_qr":
            raise MasterQrError("Not a Master QR token")
        if str(payload.get("tenant_id")) != str(self._tenant_id):
            raise TenantIsolationError("Master QR tenant mismatch")

        trip_id = payload["trip_id"]
        if not await self._is_master_qr_active(self._hash(token)):
            raise MasterQrError("Master QR revoked or unknown")

        driver_jwt = jwt.encode(
            {
                "sub": payload.get("driver_id") or "master-qr-driver",
                "tenant_id": str(self._tenant_id),
                "trip_id": trip_id,
                "roles": ["driver"],
                "scope": self.SCOPE,
                "exp": payload["exp"],
            },
            self._secret,
            algorithm="HS256",
        )
        await self._audit("operations.master_qr_exchanged", "trip", str(trip_id))
        return {
            "access_token": driver_jwt,
            "trip_id": trip_id,
            "manifest_url": f"/admin/boarding/{trip_id}",
        }

    def _wrap_qr_content(self, token: str) -> str:
        return f"mq1.{token}"

    def _unwrap_qr_content(self, raw: str) -> str:
        raw = raw.strip()
        if raw.startswith("mq1."):
            return raw[4:]
        return raw

    def _hash(self, token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    async def _verify_trip_belongs_to_tenant(self, trip_id: int) -> None:
        await self._bind_tenant_rls()
        r = await self._session.execute(
            text("SELECT 1 FROM trips WHERE id = :tid AND tenant_id = :tenant LIMIT 1"),
            {"tid": trip_id, "tenant": str(self._tenant_id)},
        )
        if not r.scalar():
            raise MasterQrError(f"Trip {trip_id} not found")

    async def _persist_master_qr_record(self, trip_id: int, token_hash: str, exp_ts: int) -> None:
        await self._bind_tenant_rls()
        await self._session.execute(
            text("""
                INSERT INTO master_qr_tokens (tenant_id, trip_id, token_hash, expires_at, revoked)
                VALUES (:tenant, :trip, :hash, to_timestamp(:exp), false)
                ON CONFLICT (tenant_id, trip_id) DO UPDATE
                SET token_hash = EXCLUDED.token_hash,
                    expires_at = EXCLUDED.expires_at,
                    revoked = false
            """),
            {"tenant": str(self._tenant_id), "trip": trip_id, "hash": token_hash, "exp": exp_ts},
        )

    async def _is_master_qr_active(self, token_hash: str) -> bool:
        await self._bind_tenant_rls()
        r = await self._session.execute(
            text("""
                SELECT 1 FROM master_qr_tokens
                WHERE tenant_id = :tenant AND token_hash = :hash
                  AND revoked = false AND expires_at > NOW()
            """),
            {"tenant": str(self._tenant_id), "hash": token_hash},
        )
        return r.scalar() is not None
