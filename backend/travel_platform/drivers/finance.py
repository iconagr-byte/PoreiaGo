"""
Driver finance — immutable earnings/expenses, ledger-based balance, versioned pay rates.
"""

from __future__ import annotations

import json
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_service import TenantScopedService
from core.exceptions import PlatformError
from travel_platform.drivers.domain import ExpenseCategory


class DriverFinanceService(TenantScopedService):
    async def record_earning(
        self,
        driver_id: UUID,
        amount: Decimal,
        *,
        trip_id: int | None = None,
        earning_type: str = "trip_commission",
        description: str | None = None,
        idempotency_key: str | None = None,
    ) -> UUID:
        await self._bind_tenant_rls()
        if amount <= 0:
            raise PlatformError("Earning amount must be positive")

        eid = uuid4()
        try:
            await self._session.execute(
                text("""
                    INSERT INTO driver_earnings (
                        id, tenant_id, driver_id, trip_id, amount, earning_type, description, idempotency_key
                    )
                    VALUES (:id, :tenant, :driver, :trip, :amount, :etype, :desc, :idem)
                """),
                {
                    "id": str(eid),
                    "tenant": str(self._tenant_id),
                    "driver": str(driver_id),
                    "trip": trip_id,
                    "amount": amount,
                    "etype": earning_type,
                    "desc": description,
                    "idem": idempotency_key,
                },
            )
        except Exception as e:
            if idempotency_key and "unique" in str(e).lower():
                return await self._earning_id_by_idempotency(idempotency_key)
            raise

        new_balance = await self._append_ledger(driver_id, "earning", amount, eid)
        await self._audit(
            "driver.earning_recorded",
            "driver",
            str(driver_id),
            metadata={"amount": str(amount), "trip_id": trip_id},
            financial=True,
        )
        return eid

    async def record_expense(
        self,
        driver_id: UUID,
        amount: Decimal,
        category: ExpenseCategory,
        *,
        trip_id: int | None = None,
        description: str | None = None,
        receipt_ref: str | None = None,
        idempotency_key: str | None = None,
    ) -> UUID:
        await self._bind_tenant_rls()
        if amount <= 0:
            raise PlatformError("Expense amount must be positive")

        xid = uuid4()
        await self._session.execute(
            text("""
                INSERT INTO driver_expenses (
                    id, tenant_id, driver_id, trip_id, amount, category, description, receipt_ref, idempotency_key
                )
                VALUES (:id, :tenant, :driver, :trip, :amount, :cat, :desc, :receipt, :idem)
            """),
            {
                "id": str(xid),
                "tenant": str(self._tenant_id),
                "driver": str(driver_id),
                "trip": trip_id,
                "amount": amount,
                "cat": category.value,
                "desc": description,
                "receipt": receipt_ref,
                "idem": idempotency_key,
            },
        )
        await self._append_ledger(driver_id, "expense", -amount, xid)
        await self._audit(
            "driver.expense_recorded",
            "driver",
            str(driver_id),
            metadata={"amount": str(amount), "category": category.value},
            financial=True,
        )
        return xid

    async def record_advance(self, driver_id: UUID, amount: Decimal, description: str | None = None) -> UUID:
        """Advance payment — reduces balance owed to driver."""
        await self._bind_tenant_rls()
        ref = uuid4()
        await self._append_ledger(driver_id, "advance", -amount, ref)
        await self._audit(
            "driver.advance_recorded",
            "driver",
            str(driver_id),
            metadata={"amount": str(amount), "description": description},
            financial=True,
        )
        return ref

    async def set_pay_rate(
        self,
        driver_id: UUID,
        *,
        salary_per_km: Decimal | None = None,
        salary_per_trip: Decimal | None = None,
        bonus_structure: dict | None = None,
        change_reason: str | None = None,
    ) -> UUID:
        """Versioned pay rate — supersedes previous row; updates drivers snapshot fields."""
        await self._bind_tenant_rls()
        rate_id = uuid4()
        bonus = bonus_structure or {}

        await self._session.execute(
            text("""
                UPDATE driver_pay_rates
                SET superseded_at = NOW()
                WHERE driver_id = :driver AND tenant_id = :tenant AND superseded_at IS NULL
            """),
            {"driver": str(driver_id), "tenant": str(self._tenant_id)},
        )
        await self._session.execute(
            text("""
                INSERT INTO driver_pay_rates (
                    id, tenant_id, driver_id, salary_per_km, salary_per_trip,
                    bonus_structure, created_by, change_reason
                )
                VALUES (:id, :tenant, :driver, :km, :trip, :bonus::jsonb, :by, :reason)
            """),
            {
                "id": str(rate_id),
                "tenant": str(self._tenant_id),
                "driver": str(driver_id),
                "km": salary_per_km,
                "trip": salary_per_trip,
                "bonus": json.dumps(bonus),
                "by": self._actor_id,
                "reason": change_reason,
            },
        )
        await self._session.execute(
            text("""
                UPDATE drivers
                SET salary_per_km = COALESCE(:km, salary_per_km),
                    salary_per_trip = COALESCE(:trip, salary_per_trip),
                    bonus_structure = COALESCE(:bonus::jsonb, bonus_structure),
                    updated_at = NOW()
                WHERE id = :driver AND tenant_id = :tenant
            """),
            {
                "driver": str(driver_id),
                "tenant": str(self._tenant_id),
                "km": salary_per_km,
                "trip": salary_per_trip,
                "bonus": json.dumps(bonus) if bonus else None,
            },
        )
        await self._audit(
            "driver.pay_rate_changed",
            "driver",
            str(driver_id),
            metadata={
                "rate_id": str(rate_id),
                "salary_per_km": str(salary_per_km) if salary_per_km else None,
                "salary_per_trip": str(salary_per_trip) if salary_per_trip else None,
                "reason": change_reason,
            },
            financial=True,
        )
        return rate_id

    async def _append_ledger(
        self,
        driver_id: UUID,
        entry_type: str,
        signed_amount: Decimal,
        reference_id: UUID,
    ) -> Decimal:
        r = await self._session.execute(
            text("SELECT current_balance FROM drivers WHERE id = :id AND tenant_id = :tenant FOR UPDATE"),
            {"id": str(driver_id), "tenant": str(self._tenant_id)},
        )
        current = r.scalar()
        if current is None:
            raise PlatformError("Driver not found")
        new_balance = Decimal(str(current)) + signed_amount

        await self._session.execute(
            text("""
                INSERT INTO driver_balance_ledger (
                    id, tenant_id, driver_id, entry_type, amount, balance_after, reference_id
                )
                VALUES (gen_random_uuid(), :tenant, :driver, :etype, :amount, :bal, :ref)
            """),
            {
                "tenant": str(self._tenant_id),
                "driver": str(driver_id),
                "etype": entry_type,
                "amount": signed_amount,
                "bal": new_balance,
                "ref": str(reference_id),
            },
        )
        await self._session.execute(
            text("UPDATE drivers SET current_balance = :bal, updated_at = NOW() WHERE id = :id"),
            {"bal": new_balance, "id": str(driver_id)},
        )
        return new_balance

    async def _earning_id_by_idempotency(self, key: str) -> UUID:
        r = await self._session.execute(
            text("SELECT id FROM driver_earnings WHERE idempotency_key = :k"),
            {"k": key},
        )
        val = r.scalar()
        return UUID(str(val)) if val else uuid4()
