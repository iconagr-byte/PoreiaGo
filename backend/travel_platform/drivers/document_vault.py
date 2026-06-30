"""Document vault — S3-linked licenses/certs with 30-day expiry alerts."""

from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID, uuid4

from sqlalchemy import text
from core.base_service import TenantScopedService
from travel_platform.drivers.domain import DriverDocument

EXPIRY_ALERT_DAYS = 30


class DriverDocumentVaultService(TenantScopedService):
    async def register_document(
        self,
        driver_id: UUID,
        doc_type: str,
        storage_key: str,
        expires_at: date,
        *,
        file_name: str | None = None,
    ) -> DriverDocument:
        await self._bind_tenant_rls()
        doc_id = uuid4()
        await self._session.execute(
            text("""
                INSERT INTO driver_documents (
                    id, tenant_id, driver_id, doc_type, storage_key, file_name, expires_at
                )
                VALUES (:id, :tenant, :driver, :type, :key, :fname, :exp)
            """),
            {
                "id": str(doc_id),
                "tenant": str(self._tenant_id),
                "driver": str(driver_id),
                "type": doc_type,
                "key": storage_key,
                "fname": file_name,
                "exp": expires_at,
            },
        )
        await self._audit(
            "driver.document_uploaded",
            "driver_document",
            str(doc_id),
            metadata={"doc_type": doc_type, "expires_at": expires_at.isoformat()},
        )
        return self._to_document(doc_id, driver_id, doc_type, storage_key, file_name, expires_at)

    async def list_documents(self, driver_id: UUID) -> list[DriverDocument]:
        await self._bind_tenant_rls()
        r = await self._session.execute(
            text("""
                SELECT id, doc_type, storage_key, file_name, expires_at
                FROM driver_documents
                WHERE driver_id = :driver AND tenant_id = :tenant
                ORDER BY expires_at ASC
            """),
            {"driver": str(driver_id), "tenant": str(self._tenant_id)},
        )
        today = date.today()
        docs = []
        for row in r.mappings():
            exp = row["expires_at"]
            days_left = (exp - today).days
            docs.append(
                DriverDocument(
                    id=UUID(str(row["id"])),
                    driver_id=driver_id,
                    doc_type=row["doc_type"],
                    storage_key=row["storage_key"],
                    file_name=row["file_name"],
                    expires_at=exp,
                    days_until_expiry=days_left,
                    alert_required=days_left <= EXPIRY_ALERT_DAYS,
                )
            )
        return docs

    async def find_expiring_documents(self, within_days: int = EXPIRY_ALERT_DAYS) -> list[dict]:
        """Used by Celery — documents expiring within N days, alert not yet sent."""
        await self._bind_tenant_rls()
        deadline = date.today() + timedelta(days=within_days)
        r = await self._session.execute(
            text("""
                SELECT d.id, d.driver_id, d.doc_type, d.expires_at,
                       dr.personal_info->>'name' AS driver_name,
                       dr.personal_info->>'email' AS driver_email
                FROM driver_documents d
                JOIN drivers dr ON dr.id = d.driver_id
                WHERE d.tenant_id = :tenant
                  AND d.expires_at <= :deadline
                  AND d.expires_at >= CURRENT_DATE
                  AND d.alert_sent_at IS NULL
            """),
            {"tenant": str(self._tenant_id), "deadline": deadline},
        )
        return [dict(row) for row in r.mappings()]

    async def mark_alert_sent(self, document_id: UUID) -> None:
        await self._bind_tenant_rls()
        await self._session.execute(
            text("""
                UPDATE driver_documents SET alert_sent_at = NOW()
                WHERE id = :id AND tenant_id = :tenant
            """),
            {"id": str(document_id), "tenant": str(self._tenant_id)},
        )

    def _to_document(
        self,
        doc_id: UUID,
        driver_id: UUID,
        doc_type: str,
        storage_key: str,
        file_name: str | None,
        expires_at: date,
    ) -> DriverDocument:
        days_left = (expires_at - date.today()).days
        return DriverDocument(
            id=doc_id,
            driver_id=driver_id,
            doc_type=doc_type,
            storage_key=storage_key,
            file_name=file_name,
            expires_at=expires_at,
            days_until_expiry=days_left,
            alert_required=days_left <= EXPIRY_ALERT_DAYS,
        )
