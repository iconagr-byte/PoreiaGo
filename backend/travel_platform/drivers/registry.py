"""Driver registry — personnel CRUD."""

from __future__ import annotations

import json
from datetime import date
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_service import TenantScopedService
from core.exceptions import PlatformError
from travel_platform.drivers.domain import DriverRecord, DriverStatus, PersonalInfo


class DriverRegistryService(TenantScopedService):
    async def create_driver(
        self,
        personal_info: PersonalInfo,
        hiring_date: date,
        *,
        salary_per_km: Decimal | None = None,
        salary_per_trip: Decimal | None = None,
        bonus_structure: dict | None = None,
    ) -> DriverRecord:
        await self._bind_tenant_rls()
        driver_id = uuid4()
        bonus = bonus_structure or {}
        await self._session.execute(
            text("""
                INSERT INTO drivers (
                    id, tenant_id, personal_info, hiring_date, status,
                    salary_per_km, salary_per_trip, bonus_structure, current_balance
                )
                VALUES (
                    :id, :tenant, :info::jsonb, :hiring, 'active',
                    :per_km, :per_trip, :bonus::jsonb, 0
                )
            """),
            {
                "id": str(driver_id),
                "tenant": str(self._tenant_id),
                "info": json.dumps(personal_info.to_dict()),
                "hiring": hiring_date,
                "per_km": salary_per_km,
                "per_trip": salary_per_trip,
                "bonus": json.dumps(bonus),
            },
        )
        await self._audit(
            "driver.created",
            "driver",
            str(driver_id),
            metadata={"name": personal_info.name},
        )
        return await self.get_driver(driver_id)

    async def get_driver(self, driver_id: UUID) -> DriverRecord:
        await self._bind_tenant_rls()
        r = await self._session.execute(
            text("""
                SELECT id, tenant_id, personal_info, hiring_date, status,
                       salary_per_km, salary_per_trip, bonus_structure, current_balance, created_at
                FROM drivers
                WHERE id = :id AND tenant_id = :tenant
            """),
            {"id": str(driver_id), "tenant": str(self._tenant_id)},
        )
        row = r.mappings().first()
        if not row:
            raise PlatformError(f"Driver {driver_id} not found")
        return self._row_to_driver(row)

    async def list_drivers(
        self,
        *,
        status: DriverStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[DriverRecord]:
        await self._bind_tenant_rls()
        status_clause = "AND status = :status" if status else ""
        params: dict = {"tenant": str(self._tenant_id), "limit": limit, "offset": offset}
        if status:
            params["status"] = status.value
        r = await self._session.execute(
            text(f"""
                SELECT id, tenant_id, personal_info, hiring_date, status,
                       salary_per_km, salary_per_trip, bonus_structure, current_balance, created_at
                FROM drivers
                WHERE tenant_id = :tenant {status_clause}
                ORDER BY personal_info->>'name'
                LIMIT :limit OFFSET :offset
            """),
            params,
        )
        return [self._row_to_driver(row) for row in r.mappings()]

    async def update_status(self, driver_id: UUID, status: DriverStatus) -> DriverRecord:
        await self._bind_tenant_rls()
        await self._session.execute(
            text("""
                UPDATE drivers SET status = :status, updated_at = NOW()
                WHERE id = :id AND tenant_id = :tenant
            """),
            {"id": str(driver_id), "tenant": str(self._tenant_id), "status": status.value},
        )
        await self._audit("driver.status_changed", "driver", str(driver_id), metadata={"status": status.value})
        return await self.get_driver(driver_id)

    def _row_to_driver(self, row) -> DriverRecord:
        info = row["personal_info"]
        if isinstance(info, str):
            info = json.loads(info)
        bonus = row["bonus_structure"] or {}
        if isinstance(bonus, str):
            bonus = json.loads(bonus)
        return DriverRecord(
            id=UUID(str(row["id"])),
            tenant_id=UUID(str(row["tenant_id"])),
            personal_info=PersonalInfo.from_dict(info or {}),
            hiring_date=row["hiring_date"],
            status=DriverStatus(row["status"]),
            salary_per_km=Decimal(str(row["salary_per_km"])) if row["salary_per_km"] is not None else None,
            salary_per_trip=Decimal(str(row["salary_per_trip"])) if row["salary_per_trip"] is not None else None,
            bonus_structure=bonus,
            current_balance=Decimal(str(row["current_balance"])),
            created_at=row.get("created_at"),
        )
