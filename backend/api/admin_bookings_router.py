"""Admin bookings API — Postgres source of truth for BackOffice."""

from __future__ import annotations

import os
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from core.dependencies import get_tenant_id
from pydantic import BaseModel
from sqlalchemy import or_, select

router = APIRouter(tags=["admin-bookings"])

DEFAULT_TENANT_SLUG = os.getenv("DEFAULT_TENANT_SLUG", "achillio")


class AdminBookingPatch(BaseModel):
    status: str | None = None
    checkedIn: bool | None = None
    checkInStatus: str | None = None
    notes: str | None = None
    trip_title: str | None = None
    external_trip_id: int | None = None
    phone: str | None = None
    paymentStatus: str | None = None
    paymentMethod: str | None = None
    amountPaid: float | None = None
    balanceDue: float | None = None
    boardingPassIssued: bool | None = None


async def _resolve_tenant_id(tenant_id: UUID | None) -> UUID:
    if tenant_id:
        return tenant_id
    env_tid = os.getenv("DEFAULT_TENANT_ID", "").strip()
    if env_tid:
        return UUID(env_tid)
    from app.core.database import AsyncSessionLocal
    from app.models.tenant import Tenant

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Tenant).where(Tenant.slug == DEFAULT_TENANT_SLUG).limit(1),
        )
        tenant = result.scalar_one_or_none()
        if tenant:
            return tenant.id
    raise HTTPException(
        status_code=503,
        detail="Postgres tenant not configured. Run: python -m scripts.seed_saas_dev",
    )


async def _find_booking(session, tenant_id: UUID, booking_key: str):
    from app.models.booking import Booking
    from api.admin_booking_mapper import normalize_reference

    key = booking_key.strip()
    filters = []
    try:
        filters.append(Booking.id == UUID(key))
    except ValueError:
        pass
    ref = normalize_reference(key)
    filters.append(Booking.reference_code == ref)
    filters.append(Booking.reference_code == key.upper())
    if not filters:
        return None
    stmt = select(Booking).where(Booking.tenant_id == tenant_id, or_(*filters)).limit(1)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def _sync_sqlite_cache(admin_dict: dict[str, Any]) -> None:
    try:
        from ticketing.customer_bookings import upsert_booking

        email = admin_dict.get("email") or "unknown@local.invalid"
        await upsert_booking(admin_dict, customer_email=email)
    except Exception:
        pass


@router.get("/api/admin/platform/bookings")
async def list_admin_bookings(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    limit: int = Query(default=500, ge=1, le=1000),
):
    from app.core.auth_deps import apply_tenant_rls
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking
    from api.admin_booking_mapper import booking_to_admin_dict

    try:
        async with AsyncSessionLocal() as db:
            await apply_tenant_rls(db, tenant_id)
            result = await db.execute(
                select(Booking)
                .where(Booking.tenant_id == tenant_id)
                .order_by(Booking.created_at.desc())
                .limit(limit),
            )
            rows = list(result.scalars().all())
            booking_ids = [b.id for b in rows]
            fiscal_by_booking: dict[UUID, list] = {}
            if booking_ids:
                from app.models.fiscal_invoice import FiscalInvoice

                inv_result = await db.execute(
                    select(FiscalInvoice)
                    .where(FiscalInvoice.booking_id.in_(booking_ids))
                    .order_by(FiscalInvoice.created_at),
                )
                for inv in inv_result.scalars().all():
                    fiscal_by_booking.setdefault(inv.booking_id, []).append(inv)

            items = [
                booking_to_admin_dict(b, fiscal_invoices=fiscal_by_booking.get(b.id, []))
                for b in rows
            ]
            for item in items:
                await _sync_sqlite_cache(item)
            return items
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Postgres unavailable: {exc}",
        ) from exc


@router.get("/api/admin/platform/bookings/{booking_key}")
async def get_admin_booking(
    booking_key: str,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    from api.admin_booking_mapper import booking_to_admin_dict

    try:
        from app.core.auth_deps import apply_tenant_rls
        from app.core.database import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            await apply_tenant_rls(db, tenant_id)
            booking = await _find_booking(db, tenant_id, booking_key)
            if not booking:
                raise HTTPException(status_code=404, detail="Booking not found")
            from app.models.fiscal_invoice import FiscalInvoice

            inv_result = await db.execute(
                select(FiscalInvoice)
                .where(FiscalInvoice.booking_id == booking.id)
                .order_by(FiscalInvoice.created_at),
            )
            fiscal_invoices = list(inv_result.scalars().all())
            data = booking_to_admin_dict(booking, fiscal_invoices=fiscal_invoices)
        await _sync_sqlite_cache(data)
        return data
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.patch("/api/admin/platform/bookings/{booking_key}")
async def patch_admin_booking(
    booking_key: str,
    body: AdminBookingPatch,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    from app.core.auth_deps import apply_tenant_rls
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking
    from api.admin_booking_mapper import apply_patch_to_booking, booking_to_admin_dict

    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=400, detail="Empty patch")

    try:
        async with AsyncSessionLocal() as db:
            await apply_tenant_rls(db, tenant_id)
            booking = await _find_booking(db, tenant_id, booking_key)
            if not booking:
                raise HTTPException(status_code=404, detail="Booking not found")
            apply_patch_to_booking(booking, patch)
            await db.commit()
            await db.refresh(booking)
            data = booking_to_admin_dict(booking)
            await _sync_sqlite_cache(data)
            return data
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/api/admin/platform/bookings/{booking_key}/cancel")
async def cancel_admin_booking(
    booking_key: str,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    from app.core.auth_deps import apply_tenant_rls
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking, BookingStatus
    from api.admin_booking_mapper import booking_to_admin_dict

    try:
        async with AsyncSessionLocal() as db:
            await apply_tenant_rls(db, tenant_id)
            booking = await _find_booking(db, tenant_id, booking_key)
            if not booking:
                raise HTTPException(status_code=404, detail="Booking not found")
            booking.status = BookingStatus.CANCELLED
            meta = dict(booking.metadata_json or {})
            meta["check_in_status"] = "CANCELLED"
            meta["checked_in"] = False
            booking.metadata_json = meta

            credit_invoice_ids: list = []
            try:
                from app.services.fiscal_credit_note_service import FiscalCreditNoteService

                credit_invoice_ids = await FiscalCreditNoteService(db).create_for_cancelled_booking(
                    tenant_id=tenant_id,
                    booking_id=booking.id,
                )
            except Exception:
                import logging

                logging.getLogger(__name__).exception(
                    "Fiscal credit note creation failed booking=%s",
                    booking.id,
                )

            await db.commit()
            await db.refresh(booking)
            data = booking_to_admin_dict(booking)

            if credit_invoice_ids:
                try:
                    from app.services.payment_dispatch import dispatch_fiscal_receipt

                    for invoice_id in credit_invoice_ids:
                        dispatch_fiscal_receipt(str(invoice_id))
                except Exception:
                    pass

            try:
                from ticketing.cancel_service import cancel_ticket_booking

                local_id = booking_to_admin_dict(booking)["id"]
                await cancel_ticket_booking(local_id)
                await cancel_ticket_booking(str(booking.id))
            except Exception:
                pass

            await _sync_sqlite_cache(data)
            return data
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/api/admin/platform/fiscal-invoices/{invoice_id}/retry")
async def retry_fiscal_invoice(
    invoice_id: str,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    from app.core.auth_deps import apply_tenant_rls
    from app.core.database import AsyncSessionLocal
    from app.services.fiscal_retry_service import FiscalRetryService

    try:
        inv_uuid = UUID(invoice_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid invoice id") from exc

    try:
        async with AsyncSessionLocal() as db:
            await apply_tenant_rls(db, tenant_id)
            data = await FiscalRetryService(db).booking_view_after_retry(
                tenant_id=tenant_id,
                invoice_id=inv_uuid,
            )
            await db.commit()
        await _sync_sqlite_cache(data)
        return data
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/api/admin/platform/fiscal-queue")
async def list_fiscal_queue(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    limit: int = Query(default=100, ge=1, le=200),
):
    from app.core.auth_deps import apply_tenant_rls
    from app.core.database import AsyncSessionLocal
    from app.services.fiscal_queue_service import FiscalQueueService

    try:
        async with AsyncSessionLocal() as db:
            await apply_tenant_rls(db, tenant_id)
            return await FiscalQueueService(db).list_open_items(tenant_id, limit=limit)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/api/admin/platform/fiscal-stats")
async def get_fiscal_stats(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    days: int = Query(default=30, ge=1, le=365),
):
    from app.core.auth_deps import apply_tenant_rls
    from app.core.database import AsyncSessionLocal
    from app.services.fiscal_stats_service import FiscalStatsService

    try:
        async with AsyncSessionLocal() as db:
            await apply_tenant_rls(db, tenant_id)
            return await FiscalStatsService(db).get_summary(tenant_id, days=days)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/api/admin/platform/fiscal-invoices/export")
async def export_fiscal_invoices_csv(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    days: int = Query(default=90, ge=1, le=365),
    status: str | None = Query(default=None),
    limit: int = Query(default=2000, ge=1, le=5000),
):
    from fastapi.responses import Response

    from app.core.auth_deps import apply_tenant_rls
    from app.core.database import AsyncSessionLocal
    from app.services.fiscal_export_service import FiscalExportService, serialize_fiscal_invoices_csv

    try:
        async with AsyncSessionLocal() as db:
            await apply_tenant_rls(db, tenant_id)
            rows = await FiscalExportService(db).list_rows(
                tenant_id,
                days=days,
                status=status,
                limit=limit,
            )
        suffix = status or "all"
        content = serialize_fiscal_invoices_csv(rows)
        return Response(
            content=content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="fiscal-invoices-{suffix}.csv"'},
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/api/admin/platform/fiscal-reconciliation")
async def get_fiscal_reconciliation(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    days: int = Query(default=90, ge=1, le=365),
    only_gaps: bool = Query(default=True),
    limit: int = Query(default=200, ge=1, le=2000),
):
    from app.core.auth_deps import apply_tenant_rls
    from app.core.database import AsyncSessionLocal
    from app.services.fiscal_reconciliation_service import FiscalReconciliationService

    try:
        async with AsyncSessionLocal() as db:
            await apply_tenant_rls(db, tenant_id)
            return await FiscalReconciliationService(db).run(
                tenant_id,
                days=days,
                only_gaps=only_gaps,
                limit=limit,
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/api/admin/platform/fiscal-reconciliation/export")
async def export_fiscal_reconciliation_csv(
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
    days: int = Query(default=90, ge=1, le=365),
    only_gaps: bool = Query(default=False),
    limit: int = Query(default=2000, ge=1, le=5000),
):
    from fastapi.responses import Response

    from app.core.auth_deps import apply_tenant_rls
    from app.core.database import AsyncSessionLocal
    from app.services.fiscal_reconciliation_service import (
        FiscalReconciliationService,
        serialize_reconciliation_csv,
    )

    try:
        async with AsyncSessionLocal() as db:
            await apply_tenant_rls(db, tenant_id)
            data = await FiscalReconciliationService(db).run(
                tenant_id,
                days=days,
                only_gaps=only_gaps,
                limit=limit,
            )
        content = serialize_reconciliation_csv(data.get("items") or [])
        suffix = "gaps" if only_gaps else "all"
        return Response(
            content=content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="fiscal-reconciliation-{suffix}.csv"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/api/admin/platform/bookings/{booking_key}/issue-fiscal")
async def issue_fiscal_for_booking(
    booking_key: str,
    request: Request,
    tenant_id: Annotated[UUID, Depends(get_tenant_id)],
):
    from app.core.auth_deps import apply_tenant_rls
    from app.core.database import AsyncSessionLocal
    from app.services.fiscal_manual_issue_service import FiscalManualIssueService

    actor_id = getattr(request.state, "user_id", None)

    try:
        async with AsyncSessionLocal() as db:
            await apply_tenant_rls(db, tenant_id)
            booking = await _find_booking(db, tenant_id, booking_key)
            if not booking:
                raise HTTPException(status_code=404, detail="Booking not found")
            data = await FiscalManualIssueService(db).issue_missing_receipt(
                tenant_id=tenant_id,
                booking_id=booking.id,
                actor_id=str(actor_id) if actor_id else None,
            )
            await db.commit()
        await _sync_sqlite_cache(data)
        return data
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
