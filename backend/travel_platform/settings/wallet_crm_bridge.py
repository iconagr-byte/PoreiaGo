"""Mirror My Wallet ``customer_accounts`` into office CRM (Πελάτες).

Admin CRM historically lived only in ``office_customers.json``. Wallet
register / Google never wrote there, so wallet profiles (e.g. Google name
«Axilleas Charalambidis») were invisible in Πελάτες even for the same office.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def prefer_display_name(crm_name: str | None, wallet_name: str | None) -> str:
    """Prefer a fuller wallet/Google name over a short booking surname."""
    w = str(wallet_name or "").strip()
    c = str(crm_name or "").strip()
    if not w:
        return c
    if not c:
        return w
    if w.lower() == c.lower():
        return c
    if len(w.split()) > len(c.split()):
        return w
    # Same token count but wallet looks like a real full name (contains space).
    if " " in w and " " not in c:
        return w
    return c


def mirror_wallet_account_to_crm(tenant_id: str | None, account: dict[str, Any] | None) -> dict[str, Any] | None:
    """Upsert one wallet account into buses CRM for its home office."""
    if not account:
        return None
    tid = str(tenant_id or account.get("wallet_tenant_id") or account.get("tenant_id") or "").strip()
    email = str(account.get("email") or "").strip().lower()
    if not tid or not email or "@" not in email:
        return None

    from travel_platform.settings.office_customers_store import get_customer_by_email, upsert_customer

    existing = get_customer_by_email(tid, email, service_scope="buses")
    name = prefer_display_name(
        (existing or {}).get("name"),
        account.get("name"),
    )
    phone = str(
        account.get("phone")
        or (existing or {}).get("phone")
        or ""
    ).strip()
    auth = str(account.get("auth_provider") or account.get("authProvider") or "email").strip() or "email"
    prev_source = str((existing or {}).get("source") or "").strip()
    # Keep explicit CRM sources; mark pure wallet inserts as wallet.
    source = prev_source if prev_source and prev_source not in ("wallet", "google") else "wallet"

    try:
        return upsert_customer(
            tid,
            {
                "email": email,
                "name": name,
                "phone": phone,
                "picture": account.get("picture") or (existing or {}).get("picture") or "",
                "source": source,
                "authProvider": auth,
                "serviceScope": "buses",
                "marketingOptIn": (existing or {}).get("marketingOptIn", True)
                if existing
                else True,
                "tags": (existing or {}).get("tags") or [],
                "tier": (existing or {}).get("tier") or "Silver",
            },
        )
    except ValueError as exc:
        logger.debug("wallet→CRM skip %s: %s", email, exc)
        return None
    except Exception:
        logger.exception("wallet→CRM mirror failed for %s", email)
        return None


async def sync_wallet_accounts_into_crm(tenant_id: str | None) -> int:
    """Persist every wallet account sealed to this office into buses CRM.

    Also upgrades existing CRM rows (booking surnames) by looking up the
    same email in ``customer_accounts`` — so «Dodopoulos» becomes the
    Google/wallet name «Axilleas Charalambidis» even when the account was
    booked before Wallet bind, as long as home office is this tenant or unset.

    Returns how many accounts were considered (mirrored or attempted).
    """
    tid = str(tenant_id or "").strip()
    if not tid:
        return 0
    from ticketing.customer_accounts import get_account, list_accounts_for_tenant
    from travel_platform.settings.office_customers_store import list_customers

    seen: set[str] = set()
    accounts = await list_accounts_for_tenant(tid)
    for acc in accounts:
        mirror_wallet_account_to_crm(tid, acc)
        email = str((acc or {}).get("email") or "").strip().lower()
        if email:
            seen.add(email)

    # CRM-first: upgrade booking-only rows from wallet profile by email.
    for row in list_customers(tid, service_scope="buses"):
        email = str((row or {}).get("email") or "").strip().lower()
        if not email or email in seen or "@" not in email:
            continue
        try:
            acc = await get_account(email)
        except Exception:
            continue
        if not acc:
            continue
        home = str(acc.get("wallet_tenant_id") or "").strip()
        # Never pull another office's wallet into this CRM.
        if home and home != tid:
            continue
        mirror_wallet_account_to_crm(tid, acc)
        seen.add(email)

    return len(seen)
