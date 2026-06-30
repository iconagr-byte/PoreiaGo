"""Async fiscal receipt processing — triggered after payment capture commits."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_deps import apply_tenant_rls
from app.models.fiscal_invoice import FiscalInvoice, FiscalInvoiceKind, FiscalInvoiceStatus
from app.models.booking import Booking
from app.models.tenant import Tenant
from app.services.fiscal_invoice_service import FiscalInvoiceService
from app.services.fiscal_transmission_service import (
    FiscalTransmissionService,
    load_native_aade_credentials,
)
from core.exceptions import FiscalAPIError
from travel_platform.compliance.fiscal_factory import FiscalFactory

logger = logging.getLogger(__name__)


def _record_processing(*, invoice: FiscalInvoice | None, outcome: str, provider: str) -> None:
    try:
        from app.observability.fiscal_metrics import record_fiscal_processing

        record_fiscal_processing(
            outcome=outcome,
            provider=provider,
            invoice_kind=invoice.invoice_kind.value if invoice else "unknown",
        )
    except Exception:
        logger.debug("Fiscal metrics recording skipped", exc_info=True)


def _schedule_fiscal_failure_alert() -> None:
    try:
        from ticketing.fiscal_admin_alert_email import schedule_fiscal_immediate_alert

        schedule_fiscal_immediate_alert()
    except Exception:
        logger.debug("Fiscal failure alert scheduling skipped", exc_info=True)


async def process_fiscal_receipt(session: AsyncSession, fiscal_invoice_id: UUID) -> dict:
    """
    End-to-end fiscal issuance for one captured payment.

    1. Load FiscalInvoice + tenant TenantFiscalConfig (secrets decrypted in factory)
    2. Enqueue AADE submission for the exact charged amount
    3. FiscalFactory.issue_invoice via FiscalTransmissionService
    4. Persist MARK on FiscalInvoice + booking
    """
    result = await session.execute(
        select(FiscalInvoice).where(FiscalInvoice.id == fiscal_invoice_id),
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        _record_processing(invoice=None, outcome="not_found", provider="unknown")
        return {"status": "not_found", "fiscal_invoice_id": str(fiscal_invoice_id)}

    await apply_tenant_rls(session, invoice.tenant_id)

    tenant_row = await session.execute(select(Tenant).where(Tenant.id == invoice.tenant_id))
    tenant = tenant_row.scalar_one_or_none()
    factory = FiscalFactory.from_tenant_settings(
        tenant.settings_json if tenant else None,
        native_credentials=await load_native_aade_credentials(invoice.tenant_id),
    )

    if invoice.status == FiscalInvoiceStatus.ISSUED:
        provider = (invoice.metadata_json or {}).get("fiscal_provider") or factory.provider.value
        _record_processing(invoice=invoice, outcome="cached", provider=str(provider))
        return {
            "status": invoice.status.value,
            "fiscal_invoice_id": str(invoice.id),
            "mark": invoice.aade_mark,
            "provider": (invoice.metadata_json or {}).get("fiscal_provider") or factory.provider.value,
            "cached": True,
        }

    invoice = await FiscalInvoiceService(session).issue_to_aade(fiscal_invoice_id)
    await session.flush()

    transmission: dict | None = None
    if invoice.aade_submission_id and invoice.status in (
        FiscalInvoiceStatus.QUEUED,
        FiscalInvoiceStatus.FAILED,
    ):
        try:
            transmission = await FiscalTransmissionService(session).transmit_submission(
                invoice.aade_submission_id,
            )
        except FiscalAPIError as exc:
            invoice.status = FiscalInvoiceStatus.FAILED
            invoice.error_message = str(exc.message)[:2000]
            invoice.metadata_json = {
                **(invoice.metadata_json or {}),
                "fiscal_provider": factory.provider.value,
            }
            await session.flush()
            from api.admin_booking_mapper import local_id_from_reference
            from travel_platform.payments.fiscal_audit import record_fiscal_audit

            booking_row = await session.execute(
                select(Booking).where(Booking.id == invoice.booking_id),
            )
            booking = booking_row.scalar_one_or_none()
            if booking:
                record_fiscal_audit(
                    action="fiscal_receipt_failed",
                    booking_id=local_id_from_reference(booking.reference_code),
                    amount_eur=float(invoice.amount),
                    detail=str(exc.message)[:500],
                    metadata={"invoice_id": str(invoice.id), "provider": factory.provider.value},
                )
            logger.exception("process_fiscal_receipt failed invoice=%s", fiscal_invoice_id)
            _schedule_fiscal_failure_alert()
            _record_processing(invoice=invoice, outcome="failed", provider=factory.provider.value)
            return {
                "status": invoice.status.value,
                "fiscal_invoice_id": str(invoice.id),
                "provider": factory.provider.value,
                "error": str(exc.message),
            }

    await session.refresh(invoice)

    if invoice.status == FiscalInvoiceStatus.FAILED:
        _schedule_fiscal_failure_alert()

    if invoice.status == FiscalInvoiceStatus.ISSUED and invoice.aade_mark:
        await _notify_fiscal_receipt_issued(session, invoice)

    provider_name = (
        (transmission or {}).get("provider")
        or (invoice.metadata_json or {}).get("fiscal_provider")
        or factory.provider.value
    )
    outcome = "issued" if invoice.status == FiscalInvoiceStatus.ISSUED else invoice.status.value
    _record_processing(invoice=invoice, outcome=outcome, provider=str(provider_name))

    return {
        "status": invoice.status.value,
        "fiscal_invoice_id": str(invoice.id),
        "booking_id": str(invoice.booking_id),
        "invoice_kind": invoice.invoice_kind.value,
        "amount": str(invoice.amount),
        "aade_submission_id": str(invoice.aade_submission_id) if invoice.aade_submission_id else None,
        "mark": invoice.aade_mark,
        "provider": (transmission or {}).get("provider")
        or (invoice.metadata_json or {}).get("fiscal_provider")
        or factory.provider.value,
        "uid": (transmission or {}).get("uid"),
    }


# Backward-compatible alias
process_fiscal_invoice = process_fiscal_receipt


async def _notify_fiscal_receipt_issued(session: AsyncSession, invoice: FiscalInvoice) -> None:
    if invoice.invoice_kind == FiscalInvoiceKind.CREDIT_NOTE:
        try:
            from api.admin_booking_mapper import local_id_from_reference
            from app.models.booking import Booking
            from travel_platform.payments.fiscal_audit import record_fiscal_audit

            booking_row = await session.execute(
                select(Booking).where(Booking.id == invoice.booking_id),
            )
            booking = booking_row.scalar_one_or_none()
            if booking and invoice.aade_mark:
                meta = dict(booking.metadata_json or {})
                meta["fiscal_credit_mark"] = invoice.aade_mark
                booking.metadata_json = meta
                record_fiscal_audit(
                    action="fiscal_credit_note_issued",
                    booking_id=local_id_from_reference(booking.reference_code),
                    amount_eur=float(invoice.amount),
                    detail=f"Credit MARK {invoice.aade_mark}",
                    metadata={
                        "invoice_id": str(invoice.id),
                        "credited_mark": (invoice.metadata_json or {}).get("credited_mark"),
                    },
                )
        except Exception:
            logger.warning("Credit note audit failed invoice=%s", invoice.id, exc_info=True)
        return

    try:
        from api.admin_booking_mapper import booking_to_admin_dict
        from app.models.booking import Booking
        from ticketing.fiscal_notifications import (
            build_fiscal_webhook_payload,
            dispatch_fiscal_receipt_webhook,
            notify_fiscal_receipt_push,
            notify_fiscal_receipt_sms,
        )
        from ticketing.payment_confirmation_email import (
            INVOICE_KIND_LABELS,
            notify_fiscal_receipt_issued,
        )

        booking_row = await session.execute(
            select(Booking).where(Booking.id == invoice.booking_id),
        )
        booking = booking_row.scalar_one_or_none()
        if not booking:
            return

        inv_result = await session.execute(
            select(FiscalInvoice)
            .where(FiscalInvoice.booking_id == invoice.booking_id)
            .order_by(FiscalInvoice.created_at),
        )
        fiscal_invoices = list(inv_result.scalars().all())
        admin_view = booking_to_admin_dict(booking, fiscal_invoices=fiscal_invoices)
        provider = (invoice.metadata_json or {}).get("fiscal_provider")
        mark = str(invoice.aade_mark or "")
        kind_label = INVOICE_KIND_LABELS.get(
            invoice.invoice_kind.value,
            invoice.invoice_kind.value,
        )

        await notify_fiscal_receipt_issued(
            admin_view,
            mark=mark,
            invoice_kind=invoice.invoice_kind.value,
            amount=float(invoice.amount),
            provider=str(provider) if provider else None,
        )
        await notify_fiscal_receipt_sms(
            admin_view,
            mark=mark,
            amount=float(invoice.amount),
            invoice_kind_label=kind_label,
        )
        await notify_fiscal_receipt_push(
            admin_view,
            mark=mark,
            amount=float(invoice.amount),
            invoice_kind_label=kind_label,
            invoice_id=str(invoice.id),
        )
        dispatch_fiscal_receipt_webhook(
            str(invoice.tenant_id),
            build_fiscal_webhook_payload(
                admin_view,
                tenant_id=str(invoice.tenant_id),
                invoice_id=str(invoice.id),
                mark=mark,
                amount=float(invoice.amount),
                invoice_kind=invoice.invoice_kind.value,
                provider=str(provider) if provider else None,
            ),
        )

        from travel_platform.payments.fiscal_audit import record_fiscal_audit

        record_fiscal_audit(
            action="fiscal_receipt_issued",
            booking_id=admin_view.get("id") or str(booking.id),
            amount_eur=float(invoice.amount),
            detail=f"MARK {invoice.aade_mark}",
            metadata={
                "invoice_id": str(invoice.id),
                "mark": invoice.aade_mark,
                "provider": provider,
            },
        )
    except Exception:
        logger.warning("Fiscal receipt notifications failed invoice=%s", invoice.id, exc_info=True)

