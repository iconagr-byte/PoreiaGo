"""Admin + public payment settings (methods, deposit, bank accounts)."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from travel_platform.payments.bank_deposit_confirm import (
    build_confirm_patch,
    record_confirm_audit,
    validate_confirm_request,
)
from travel_platform.payments.cash_payment_confirm import (
    CashPaymentChannel,
    build_cash_payment_patch,
    record_cash_audit,
    validate_cash_payment_request,
)
from travel_platform.settings.payment_audit_store import (
    filter_payment_audit,
    list_payment_audit,
    serialize_payment_audit_csv,
)
from travel_platform.settings.payment_settings_store import (
    add_bank_account,
    delete_bank_account,
    get_public_payment_settings,
    patch_payment_settings,
    read_payment_settings,
    update_bank_account,
)

router = APIRouter(tags=["payment-settings"])


class DepositSettingsModel(BaseModel):
    enabled: bool = True
    percent: int = Field(default=30, ge=5, le=90)


class PaymentMethodModel(BaseModel):
    enabled: bool = True
    label: str = ""


class PaymentSecurityModel(BaseModel):
    require_amount_on_confirm: bool = True
    require_reference_on_confirm: bool = True
    validate_iban_checksum: bool = True
    audit_payment_actions: bool = True
    mask_iban_public: bool = False
    notify_customer_on_payment: bool = True
    notify_admin_on_payment: bool = True
    notify_sms_on_fiscal_receipt: bool = True
    notify_push_on_fiscal_receipt: bool = True
    notify_erp_on_fiscal_receipt: bool = True
    notify_admin_on_fiscal_issues: bool = True
    admin_notification_email: str = ""
    email_spam_filter_enabled: bool = True
    block_disposable_emails: bool = True
    email_deliverability_headers: bool = True
    blocked_email_domains: list[str] = Field(default_factory=list)
    allowed_email_domains: list[str] = Field(default_factory=list)


class PublicSecurityModel(BaseModel):
    mask_iban_public: bool = False


class BankAccountModel(BaseModel):
    id: str
    label: str
    bank_name: str
    beneficiary: str
    iban: str
    bic: str = ""
    currency: str = "EUR"
    enabled: bool = True
    is_default: bool = False
    reference_template: str = "VOY-{pnr}"
    instructions: str = ""


class BankAccountCreate(BaseModel):
    label: str = ""
    bank_name: str
    beneficiary: str
    iban: str
    bic: str = ""
    currency: str = "EUR"
    enabled: bool = True
    is_default: bool = False
    reference_template: str = "VOY-{pnr}"
    instructions: str = ""


class BankAccountUpdate(BaseModel):
    label: str | None = None
    bank_name: str | None = None
    beneficiary: str | None = None
    iban: str | None = None
    bic: str | None = None
    currency: str | None = None
    enabled: bool | None = None
    is_default: bool | None = None
    reference_template: str | None = None
    instructions: str | None = None


class PaymentSettingsPatch(BaseModel):
    deposit: DepositSettingsModel | None = None
    methods: dict[str, PaymentMethodModel] | None = None
    global_bank_instructions: str | None = None
    security: PaymentSecurityModel | None = None


class PaymentSettingsResponse(BaseModel):
    deposit: DepositSettingsModel
    methods: dict[str, PaymentMethodModel]
    bank_accounts: list[BankAccountModel]
    global_bank_instructions: str = ""
    security: PaymentSecurityModel = Field(default_factory=PaymentSecurityModel)


class PublicPaymentSettingsResponse(BaseModel):
    deposit: DepositSettingsModel
    methods: dict[str, PaymentMethodModel]
    bank_accounts: list[BankAccountModel]
    global_bank_instructions: str = ""
    security: PublicSecurityModel | None = None


class ConfirmBankDepositBody(BaseModel):
    confirmed_amount: float | None = None
    reference_code: str | None = None
    note: str | None = None


class RecordCashPaymentBody(BaseModel):
    amount: float = Field(gt=0)
    channel: Literal["office_counter", "driver_on_bus"]
    reference_code: str | None = None
    receipt_number: str | None = Field(default=None, max_length=64)
    note: str | None = None
    idempotency_key: str | None = Field(default=None, max_length=128)


class PaymentAuditEntry(BaseModel):
    id: str
    at: str
    action: str
    booking_id: str
    amount_eur: float | None = None
    reference: str | None = None
    actor_id: str | None = None
    detail: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


async def _load_booking_for_confirm(booking_key: str) -> dict[str, Any] | None:
    from ticketing.customer_bookings import get_booking

    local = await get_booking(booking_key.strip())
    if local:
        return local

    try:
        from api.admin_bookings_router import _find_booking, _resolve_tenant_id
        from api.admin_booking_mapper import booking_to_admin_dict
        from app.core.auth_deps import apply_tenant_rls
        from app.core.database import AsyncSessionLocal

        tenant_id = await _resolve_tenant_id(None)
        async with AsyncSessionLocal() as db:
            await apply_tenant_rls(db, tenant_id)
            booking = await _find_booking(db, tenant_id, booking_key)
            if booking:
                return booking_to_admin_dict(booking)
    except Exception:
        pass
    return None


async def _persist_confirmed_booking(booking_key: str, booking: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    from ticketing.customer_bookings import upsert_booking

    merged = {**booking, **patch}
    email = merged.get("email") or "unknown@local.invalid"
    saved = await upsert_booking(merged, customer_email=email)

    try:
        from api.admin_booking_mapper import apply_patch_to_booking, booking_to_admin_dict
        from api.admin_bookings_router import _find_booking, _resolve_tenant_id
        from app.core.auth_deps import apply_tenant_rls
        from app.core.database import AsyncSessionLocal

        tenant_id = await _resolve_tenant_id(None)
        async with AsyncSessionLocal() as db:
            await apply_tenant_rls(db, tenant_id)
            pg_booking = await _find_booking(db, tenant_id, booking_key)
            if pg_booking:
                apply_patch_to_booking(pg_booking, patch)
                await db.commit()
                await db.refresh(pg_booking)
                pg_dict = booking_to_admin_dict(pg_booking)
                await upsert_booking(pg_dict, customer_email=pg_dict.get("email") or email)
                return pg_dict
    except Exception:
        pass

    return saved


@router.get("/api/site/payment-settings", response_model=PublicPaymentSettingsResponse)
async def get_site_payment_settings():
    return PublicPaymentSettingsResponse(**get_public_payment_settings())


@router.get("/api/admin/platform/payment-settings", response_model=PaymentSettingsResponse)
async def get_admin_payment_settings():
    data = read_payment_settings()
    return PaymentSettingsResponse(**data)


@router.patch("/api/admin/platform/payment-settings", response_model=PaymentSettingsResponse)
async def patch_admin_payment_settings(body: PaymentSettingsPatch):
    patch: dict = {}
    if body.deposit is not None:
        patch["deposit"] = body.deposit.model_dump()
    if body.methods is not None:
        patch["methods"] = {k: v.model_dump() for k, v in body.methods.items()}
    if body.global_bank_instructions is not None:
        patch["global_bank_instructions"] = body.global_bank_instructions
    if body.security is not None:
        patch["security"] = body.security.model_dump()
    if not patch:
        raise HTTPException(status_code=400, detail="Empty patch")
    saved = patch_payment_settings(patch)
    return PaymentSettingsResponse(**saved)


@router.get("/api/admin/platform/payment-audit", response_model=list[PaymentAuditEntry])
async def get_payment_audit(limit: int = Query(default=50, ge=1, le=200)):
    return list_payment_audit(limit=limit)


@router.get("/api/admin/platform/payment-audit/export")
async def export_payment_audit_csv(
    limit: int = Query(default=200, ge=1, le=500),
    fiscal_only: bool = Query(default=False),
):
    rows = list_payment_audit(limit=limit)
    filtered = filter_payment_audit(rows, fiscal_only=fiscal_only)
    content = serialize_payment_audit_csv(filtered)
    suffix = "fiscal" if fiscal_only else "payments"
    filename = f"payment-audit-{suffix}.csv"
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/api/admin/platform/bookings/{booking_key}/confirm-bank-deposit")
async def confirm_bank_deposit(
    booking_key: str,
    body: ConfirmBankDepositBody,
    request: Request,
):
    from decimal import Decimal

    from api.admin_booking_mapper import booking_to_admin_dict
    from api.admin_bookings_router import _find_booking, _resolve_tenant_id
    from app.core.auth_deps import apply_tenant_rls
    from app.core.database import AsyncSessionLocal
    from app.models.fiscal_invoice import FiscalInvoice
    from app.services.booking_payment_service import BookingPaymentService
    from app.services.payment_dispatch import dispatch_fiscal_receipt
    from sqlalchemy import select
    from ticketing.payment_confirmation_email import (
        EVENT_BANK_CONFIRMED,
        send_payment_confirmation_notifications,
    )

    booking = await _load_booking_for_confirm(booking_key)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    try:
        validate_confirm_request(booking, body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    expected_amount = float(booking.get("balanceDue") or booking.get("price") or 0)
    capture_amount = Decimal(str(body.confirmed_amount if body.confirmed_amount is not None else expected_amount))

    tenant_id = await _resolve_tenant_id(None)
    actor_id = getattr(request.state, "user_id", None)
    fiscal_invoice_id = None
    result_status = "captured"
    saved: dict[str, Any] = booking

    async with AsyncSessionLocal() as db:
        await apply_tenant_rls(db, tenant_id)
        pg_booking = await _find_booking(db, tenant_id, booking_key)
        if not pg_booking:
            raise HTTPException(status_code=404, detail="Booking not found in Postgres")

        try:
            result = await BookingPaymentService(db).record_bank_deposit(
                tenant_id=tenant_id,
                booking_id=pg_booking.id,
                amount=capture_amount,
                reference_code=str(body.reference_code or booking.get("pnr") or booking_key),
                idempotency_key=f"bank-deposit:{body.reference_code or booking_key}",
                actor_id=str(actor_id) if actor_id else None,
                note=body.note,
            )
            await db.commit()
            await db.refresh(pg_booking)
            result_status = result.status
            fiscal_invoice_id = result.fiscal_invoice_id

            fiscal_invoices = []
            if fiscal_invoice_id:
                inv_result = await db.execute(
                    select(FiscalInvoice)
                    .where(FiscalInvoice.booking_id == pg_booking.id)
                    .order_by(FiscalInvoice.created_at),
                )
                fiscal_invoices = list(inv_result.scalars().all())

            saved = booking_to_admin_dict(pg_booking, fiscal_invoices=fiscal_invoices)
            patch = build_confirm_patch(saved, body.note)
            saved = {**saved, **{k: v for k, v in patch.items() if k in (
                "paymentStatus", "paymentMethod", "notes", "boardingPassIssued",
            )}}
        except Exception as exc:
            await db.rollback()
            raise HTTPException(status_code=500, detail="Bank deposit confirmation failed") from exc

    if fiscal_invoice_id and result_status == "captured":
        dispatch_fiscal_receipt(str(fiscal_invoice_id))

    amount = float(capture_amount)
    record_confirm_audit(
        booking_id=str(saved.get("id") or booking_key),
        amount_eur=amount,
        reference=body.reference_code,
        actor_id=str(actor_id) if actor_id else None,
        detail=body.note,
    )

    try:
        await send_payment_confirmation_notifications(saved, event=EVENT_BANK_CONFIRMED)
    except Exception:
        pass

    try:
        from ticketing.customer_bookings import upsert_booking

        email = saved.get("email") or "unknown@local.invalid"
        await upsert_booking(saved, customer_email=email)
    except Exception:
        pass

    return saved


@router.post("/api/admin/platform/bookings/{booking_key}/record-cash-payment")
async def record_cash_payment_admin(
    booking_key: str,
    body: RecordCashPaymentBody,
    request: Request,
):
    """BackOffice — καταχώρηση μετρητών (γκισέ ή οδηγός) με απόδειξη myDATA."""
    from decimal import Decimal

    from api.admin_booking_mapper import booking_to_admin_dict
    from api.admin_bookings_router import _find_booking, _resolve_tenant_id
    from app.core.auth_deps import apply_tenant_rls
    from app.core.database import AsyncSessionLocal
    from app.services.booking_payment_service import BookingPaymentService
    from app.services.payment_dispatch import dispatch_fiscal_receipt
    from ticketing.payment_confirmation_email import (
        EVENT_CASH_PAYMENT,
        send_payment_confirmation_notifications,
    )

    booking = await _load_booking_for_confirm(booking_key)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    try:
        channel = validate_cash_payment_request(booking, body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    tenant_id = await _resolve_tenant_id(None)
    actor_id = getattr(request.state, "user_id", None)
    fiscal_invoice_id = None
    result_status = "captured"
    pg_snapshot: dict[str, Any] = {}

    async with AsyncSessionLocal() as db:
        await apply_tenant_rls(db, tenant_id)
        pg_booking = await _find_booking(db, tenant_id, booking_key)
        if not pg_booking:
            raise HTTPException(status_code=404, detail="Booking not found in Postgres")

        try:
            result = await BookingPaymentService(db).record_cash_payment(
                tenant_id=tenant_id,
                booking_id=pg_booking.id,
                amount=Decimal(str(body.amount)),
                channel=channel,
                idempotency_key=body.idempotency_key,
                actor_id=str(actor_id) if actor_id else None,
                note=body.note,
                receipt_number=body.receipt_number,
            )
            await db.commit()
            await db.refresh(pg_booking)
            result_status = result.status
            fiscal_invoice_id = result.fiscal_invoice_id
            from app.models.fiscal_invoice import FiscalInvoice
            from sqlalchemy import select

            fiscal_invoices = []
            if fiscal_invoice_id:
                inv_result = await db.execute(
                    select(FiscalInvoice)
                    .where(FiscalInvoice.booking_id == pg_booking.id)
                    .order_by(FiscalInvoice.created_at),
                )
                fiscal_invoices = list(inv_result.scalars().all())

            pg_snapshot = {
                "id": pg_booking.id,
                "amount_paid": float(pg_booking.amount_paid),
                "total_price": float(pg_booking.total_price),
                "admin": booking_to_admin_dict(pg_booking, fiscal_invoices=fiscal_invoices),
            }
        except Exception as exc:
            await db.rollback()
            raise HTTPException(status_code=500, detail="Cash payment failed") from exc

    if fiscal_invoice_id and result_status == "captured":
        dispatch_fiscal_receipt(str(fiscal_invoice_id))

    balance = round(max(pg_snapshot["total_price"] - pg_snapshot["amount_paid"], 0.0), 2)
    patch = build_cash_payment_patch(
        pg_snapshot["admin"],
        channel=channel,
        amount_paid_now=float(body.amount),
        new_amount_paid=pg_snapshot["amount_paid"],
        new_balance=balance,
        note=body.note,
        receipt_number=body.receipt_number,
    )
    saved = await _persist_confirmed_booking(booking_key, pg_snapshot["admin"], patch)

    record_cash_audit(
        booking_id=str(pg_snapshot["id"]),
        amount_eur=float(body.amount),
        channel=channel,
        actor_id=str(actor_id) if actor_id else None,
        reference=body.reference_code,
        detail=body.note,
        receipt_number=body.receipt_number,
    )

    try:
        await send_payment_confirmation_notifications(saved, event=EVENT_CASH_PAYMENT)
    except Exception:
        pass

    return {
        **saved,
        "cashPayment": {
            "status": result_status,
            "channel": channel.value,
            "amountCaptured": float(body.amount),
            "balanceDue": balance,
            "fiscalInvoiceId": str(fiscal_invoice_id) if fiscal_invoice_id else None,
        },
    }


@router.post("/api/admin/platform/bank-accounts", response_model=BankAccountModel)
async def create_bank_account(body: BankAccountCreate):
    try:
        account = add_bank_account(body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return BankAccountModel(**account)


@router.patch("/api/admin/platform/bank-accounts/{account_id}", response_model=BankAccountModel)
async def patch_bank_account(account_id: str, body: BankAccountUpdate):
    try:
        account = update_bank_account(account_id, body.model_dump(exclude_unset=True))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Bank account not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return BankAccountModel(**account)


@router.delete("/api/admin/platform/bank-accounts/{account_id}", response_model=PaymentSettingsResponse)
async def remove_bank_account(account_id: str):
    try:
        saved = delete_bank_account(account_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PaymentSettingsResponse(**saved)
