"""Office product modules — trips (buses) vs Rent — derived from plan + settings.

IMPORTANT — never disable Rent globally:
- Hiding Rent for one office (e.g. Achillio Travel) MUST be per-tenant only.
- PoreiaGo platform / demo offices keep Rent so Super Admin can operate the product.
- Use ``apply_known_office_rent_policy`` / ``ensure_known_office_rent_modules`` —
  never a global flag or mass update without slug/domain filters.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.models.tenant import Tenant, TenantPlan

logger = logging.getLogger(__name__)

# Achillio Travel bus-only offices (custom domain / known slugs).
_ACHILLIO_TRAVEL_SLUGS = frozenset(
    {
        "admin-achillio-gr",
        "achillio-travel",
        "achilliotravel",
    }
)
_ACHILLIO_DOMAIN_RE = re.compile(r"(^|\.)achilliotravel\.com$", re.I)
_POREIAGO_PLATFORM_SLUGS = frozenset(
    {
        "poreiago",
        "platform",
        "demo",
        "admin-poreiago",
        "poreiago-saas",
        "poreiago-platform",
    }
)
_POREIAGO_DOMAIN_RE = re.compile(r"(^|\.)poreiago\.com$", re.I)


def parse_tenant_settings(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}
    return data if isinstance(data, dict) else {}


def initial_settings_for_plan(plan: TenantPlan | str, *, office_name: str | None = None) -> dict[str, Any]:
    """Seed settings_json when provisioning a new office."""
    plan_value = plan.value if isinstance(plan, TenantPlan) else str(plan or "starter")
    settings: dict[str, Any] = {"theme": {"primary": "#005d90"}}
    if plan_value == TenantPlan.RENT.value:
        settings["addons"] = {"rent": True}
        settings["modules"] = {"trips_enabled": False, "rent_enabled": True}
        name = str(office_name or "").strip()
        settings["site_appearance"] = {
            "rent_office_name": name,
            "footer_brand_name": name,
            "rent_hero_title": "Το όχημά σας, σε λίγα βήματα",
            "rent_hero_copy": (
                "Κράτηση, ημερολόγιο και χάρτης παραλαβής — όλα σε μία σελίδα."
            ),
            "rent_guest_hero_title": "Δες τον στόλο πριν κλείσεις",
            "rent_guest_hero_copy": "",
            "rent_cta_label": "Βρες όχημα",
            "show_fleet_section": False,
            "show_why_us_section": False,
        }
    return settings


def modules_for_settings(
    *,
    plan: TenantPlan | str | None,
    settings: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Resolve public storefront modules.

    - plan ``rent`` → Rent only (no bus trips on homepage)
    - bus plans → trips on; Rent when ``addons.rent`` (or explicit modules override)
    - ``settings.modules`` can override either flag
    """
    plan_value = (
        plan.value
        if isinstance(plan, TenantPlan)
        else str(plan or TenantPlan.STARTER.value).strip().lower()
    )
    bag = settings if isinstance(settings, dict) else {}
    addons = bag.get("addons") if isinstance(bag.get("addons"), dict) else {}
    override = bag.get("modules") if isinstance(bag.get("modules"), dict) else {}

    rent_only = plan_value == TenantPlan.RENT.value
    rent_addon = bool(addons.get("rent") or addons.get("rent_addon"))

    trips_default = not rent_only
    rent_default = rent_only or rent_addon

    trips_enabled = (
        bool(override["trips_enabled"]) if "trips_enabled" in override else trips_default
    )
    rent_enabled = (
        bool(override["rent_enabled"]) if "rent_enabled" in override else rent_default
    )

    # Never leave an office with zero public product surface.
    if not trips_enabled and not rent_enabled:
        trips_enabled = True

    if rent_enabled and not trips_enabled:
        mode = "rent_only"
    elif rent_enabled and trips_enabled:
        mode = "both"
    else:
        mode = "trips_only"

    return {
        "trips_enabled": trips_enabled,
        "rent_enabled": rent_enabled,
        "plan": plan_value,
        "mode": mode,
    }


def modules_for_tenant(tenant: Tenant) -> dict[str, Any]:
    return modules_for_settings(
        plan=tenant.plan,
        settings=parse_tenant_settings(tenant.settings_json),
    )


def enable_rent_addon_in_settings(settings: dict[str, Any] | None = None) -> dict[str, Any]:
    """Merge Rent add-on onto an existing bus office settings bag."""
    bag = dict(settings or {})
    addons = dict(bag.get("addons") or {})
    addons["rent"] = True
    bag["addons"] = addons
    modules = dict(bag.get("modules") or {})
    modules["rent_enabled"] = True
    if "trips_enabled" not in modules:
        modules["trips_enabled"] = True
    bag["modules"] = modules
    return bag


def disable_rent_addon_in_settings(settings: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Turn off Rent for a SINGLE office (keeps trips).

    Call only with an explicit tenant target — never for all rows.
    """
    bag = dict(settings or {})
    addons = dict(bag.get("addons") or {})
    addons["rent"] = False
    addons.pop("rent_addon", None)
    bag["addons"] = addons
    modules = dict(bag.get("modules") or {})
    modules["rent_enabled"] = False
    modules["trips_enabled"] = True
    bag["modules"] = modules
    return bag


def _tenant_domain(tenant: Any) -> str:
    return str(getattr(tenant, "custom_domain", None) or "").strip().lower().removeprefix("www.")


def _tenant_slug(tenant: Any) -> str:
    return str(getattr(tenant, "slug", None) or "").strip().lower()


def is_achillio_travel_office(tenant: Any) -> bool:
    """True for Achillio Travel bus office — Rent stays off by policy.

    Historic platform seed slug ``achillio`` is NEVER Achillio Travel — even when
    ``custom_domain`` was wrongly set to achilliotravel.com (that poison caused
    Rent Wallet share URLs to point at the wrong office).
    """
    slug = _tenant_slug(tenant)
    subdomain = str(getattr(tenant, "subdomain", None) or "").strip().lower()
    # Platform / demo seed wins over a stolen Achillio Travel domain.
    if slug in _POREIAGO_PLATFORM_SLUGS or slug == "achillio":
        return False
    if subdomain in _POREIAGO_PLATFORM_SLUGS or subdomain == "achillio":
        return False
    if slug in _ACHILLIO_TRAVEL_SLUGS or subdomain in _ACHILLIO_TRAVEL_SLUGS:
        return True
    domain = _tenant_domain(tenant)
    if domain and _ACHILLIO_DOMAIN_RE.search(domain):
        return True
    return False


def is_poreiago_platform_office(tenant: Any) -> bool:
    """True for PoreiaGo platform / demo office that must keep Rent visible.

    The historic seed uses slug/subdomain ``achillio`` with legal_name PoreiaGo.
    That is NOT Achillio Travel (which requires travel slugs like admin-achillio-gr).
    """
    slug = _tenant_slug(tenant)
    # Legacy demo/platform seed slug — keep Rent even if legal_name/domain drifted.
    if slug in _POREIAGO_PLATFORM_SLUGS or slug == "achillio":
        return True
    subdomain = str(getattr(tenant, "subdomain", None) or "").strip().lower()
    if subdomain in _POREIAGO_PLATFORM_SLUGS or subdomain == "achillio":
        return True
    if is_achillio_travel_office(tenant):
        return False
    legal = str(getattr(tenant, "legal_name", None) or "").strip().lower()
    domain = _tenant_domain(tenant)
    if domain and _POREIAGO_DOMAIN_RE.search(domain):
        return True
    # Any office branded PoreiaGo (not Achillio Travel) keeps the Rent desk.
    if "poreiago" in legal:
        return True
    return False


def apply_known_office_rent_policy(tenant: Any) -> dict[str, Any] | None:
    """
    Per-office Rent policy for known platform / Achillio tenants.

    Returns updated settings dict when a change is required, else None.
    Never touches unrelated customer offices.
    """
    current = parse_tenant_settings(getattr(tenant, "settings_json", None))
    mods = modules_for_settings(plan=getattr(tenant, "plan", None), settings=current)

    if is_achillio_travel_office(tenant):
        if not mods["rent_enabled"]:
            return None
        return disable_rent_addon_in_settings(current)

    if is_poreiago_platform_office(tenant):
        updated = enable_rent_addon_in_settings(current) if not mods["rent_enabled"] else dict(current)
        changed = not mods["rent_enabled"]

        # Never seed Achillio Travel legal_name into PoreiaGo platform appearance.
        office_name = "PoreiaGo"
        legal = str(getattr(tenant, "legal_name", None) or "").strip()
        if legal and "achillio" not in legal.lower() and "poreiago" in legal.lower():
            office_name = legal

        appearance = updated.get("site_appearance")
        if not isinstance(appearance, dict):
            seeded = initial_settings_for_plan(TenantPlan.RENT, office_name=office_name)
            appearance = seeded.get("site_appearance")
            if isinstance(appearance, dict):
                updated["site_appearance"] = appearance
                changed = True
        else:
            appearance = dict(appearance)
            brand_was_achillio = any(
                "achillio" in str(appearance.get(k) or "").lower()
                for k in ("footer_brand_name", "rent_office_name")
            ) or ("achillio" in legal.lower())
            for key in ("footer_brand_name", "rent_office_name"):
                val = str(appearance.get(key) or "")
                if not val.strip() or "achillio" in val.lower():
                    appearance[key] = office_name
                    changed = True
            logo = str(appearance.get("logo_url") or "").strip()
            # Clear Achillio-named URLs and opaque uploads left from brand drift.
            if logo and (
                "achillio" in logo.lower()
                or brand_was_achillio
            ):
                appearance["logo_url"] = ""
                changed = True
            if "achillio" in str(appearance.get("hero_image_url") or "").lower():
                appearance["hero_image_url"] = ""
                changed = True
            updated["site_appearance"] = appearance

        # Platform is hybrid: trips + rent.
        modules = dict(updated.get("modules") or {})
        if not modules.get("trips_enabled") or not modules.get("rent_enabled"):
            modules["trips_enabled"] = True
            modules["rent_enabled"] = True
            updated["modules"] = modules
            changed = True

        return updated if changed else None

    return None


ACHILLIO_TRAVEL_CANONICAL_SLUG = "admin-achillio-gr"
ACHILLIO_TRAVEL_CANONICAL_DOMAIN = "achilliotravel.com"


async def _heal_subscription_plan_column(session: Any) -> None:
    """Contabo DBs sometimes miss subscriptions.plan — ADD COLUMN IF NOT EXISTS."""
    from sqlalchemy import text

    try:
        await session.execute(
            text(
                "ALTER TABLE IF EXISTS subscriptions "
                "ADD COLUMN IF NOT EXISTS plan VARCHAR(32) NOT NULL DEFAULT 'starter'"
            )
        )
        await session.commit()
    except Exception:
        await session.rollback()
        logger.exception("Could not heal subscriptions.plan column")


def _tenant_noload_options():
    from sqlalchemy.orm import noload

    return (
        noload(Tenant.users),
        noload(Tenant.bookings),
        noload(Tenant.subscription),
    )


async def ensure_achillio_travel_office(session: Any) -> dict[str, Any]:
    """
    Idempotent: ensure the real Achillio Travel office exists and owns achilliotravel.com.

    - Creates slug=admin-achillio-gr when missing (production Contabo often only
      had the PoreiaGo seed slug=achillio, so Host seal blocked every login).
    - Sets custom_domain=achilliotravel.com on that office only.
    - Clears poisoned achilliotravel.com from the PoreiaGo platform seed.
    - Optionally upserts an admin user when ACHILLIO_ADMIN_EMAIL + password
      are provided via env (never hardcodes secrets in the repo).
    """
    import os
    from uuid import uuid4

    from sqlalchemy import or_, select, text

    from app.models.user import User, UserRole
    from app.services.auth_service import hash_password

    created = False
    domain_set = False
    poison_cleared = 0
    admin_upserted = False

    await _heal_subscription_plan_column(session)
    opts = _tenant_noload_options()

    # Free the custom domain from any non-Achillio office (esp. platform seed).
    result = await session.execute(select(Tenant).options(*opts))
    for tenant in list(result.scalars().all()):
        domain = _tenant_domain(tenant)
        if not domain or "achilliotravel.com" not in domain:
            continue
        if is_achillio_travel_office(tenant):
            continue
        tenant.custom_domain = None
        poison_cleared += 1
        logger.info(
            "Cleared poisoned achilliotravel.com from slug=%s before Achillio ensure",
            _tenant_slug(tenant),
        )

    # Prefer canonical slug; else any existing Achillio Travel classifier hit.
    result = await session.execute(
        select(Tenant)
        .options(*opts)
        .where(
            or_(
                Tenant.slug == ACHILLIO_TRAVEL_CANONICAL_SLUG,
                Tenant.subdomain == ACHILLIO_TRAVEL_CANONICAL_SLUG,
            )
        )
        .limit(1)
    )
    office = result.scalar_one_or_none()
    if office is None:
        result = await session.execute(select(Tenant).options(*opts).limit(120))
        for tenant in result.scalars().all():
            if is_achillio_travel_office(tenant):
                office = tenant
                break

    if office is None:
        office = Tenant(
            id=uuid4(),
            slug=ACHILLIO_TRAVEL_CANONICAL_SLUG,
            legal_name="Achillio Travel",
            subdomain=ACHILLIO_TRAVEL_CANONICAL_SLUG,
            custom_domain=ACHILLIO_TRAVEL_CANONICAL_DOMAIN,
            plan=TenantPlan.PROFESSIONAL,
            is_active=True,
            settings_json=json.dumps(
                initial_settings_for_plan(
                    TenantPlan.PROFESSIONAL,
                    office_name="Achillio Travel",
                ),
                ensure_ascii=False,
            ),
        )
        session.add(office)
        await session.flush()
        created = True
        domain_set = True
        logger.info("Created Achillio Travel office slug=%s", office.slug)
    else:
        if not str(getattr(office, "legal_name", "") or "").strip():
            office.legal_name = "Achillio Travel"
        current = _tenant_domain(office)
        if current != ACHILLIO_TRAVEL_CANONICAL_DOMAIN:
            office.custom_domain = ACHILLIO_TRAVEL_CANONICAL_DOMAIN
            domain_set = True
            logger.info(
                "Bound custom_domain=%s on Achillio Travel slug=%s",
                ACHILLIO_TRAVEL_CANONICAL_DOMAIN,
                _tenant_slug(office),
            )
        # Keep Rent off for Achillio Travel.
        updated = apply_known_office_rent_policy(office)
        if updated is not None:
            office.settings_json = json.dumps(updated, ensure_ascii=False)

    admin_email = (os.getenv("ACHILLIO_ADMIN_EMAIL") or "").strip().lower()
    admin_password = os.getenv("ACHILLIO_ADMIN_PASSWORD") or ""
    if admin_email and admin_password and len(admin_password) >= 8:
        try:
            await session.execute(text("SET LOCAL row_security = off"))
        except Exception:
            pass
        existing = await session.execute(
            select(User).where(
                User.tenant_id == office.id,
                User.email == admin_email,
            ).limit(1)
        )
        user = existing.scalar_one_or_none()
        if user is None:
            user = User(
                id=uuid4(),
                tenant_id=office.id,
                email=admin_email,
                password_hash=hash_password(admin_password),
                full_name=admin_email.split("@")[0],
                roles=[
                    UserRole.TENANT_ADMIN.value,
                    UserRole.DISPATCHER.value,
                    UserRole.SUPERADMIN.value,
                ],
                is_active=True,
                mfa_enabled=False,
            )
            session.add(user)
            admin_upserted = True
            logger.info("Created Achillio Travel admin %s", admin_email)
        else:
            user.password_hash = hash_password(admin_password)
            user.is_active = True
            admin_upserted = True
            logger.info("Reset Achillio Travel admin password for %s", admin_email)

    await session.commit()
    try:
        from middleware.domain_tenant import clear_host_resolve_cache

        clear_host_resolve_cache()
    except Exception:
        pass

    return {
        "created": created,
        "domain_set": domain_set,
        "poison_cleared": poison_cleared,
        "admin_upserted": admin_upserted,
        "slug": _tenant_slug(office),
        "tenant_id": str(office.id),
        "custom_domain": office.custom_domain or "",
    }


async def ensure_known_office_rent_modules(session: Any) -> dict[str, int]:
    """
    Idempotent: Achillio Travel → Rent off; PoreiaGo platform → Rent on.

    Scoped to known offices only — never mass-disables Rent.
    Also ensures the Achillio Travel office + custom_domain mapping exists.
    """
    from sqlalchemy import select

    try:
        await ensure_achillio_travel_office(session)
    except Exception:
        logger.exception("ensure_achillio_travel_office failed")

    result = await session.execute(select(Tenant).options(*_tenant_noload_options()))
    tenants = list(result.scalars().all())
    disabled = 0
    enabled = 0
    for tenant in tenants:
        # Heal drifted Achillio legal_name / stolen custom_domain on PoreiaGo seed.
        if is_poreiago_platform_office(tenant):
            legal = str(getattr(tenant, "legal_name", None) or "").strip()
            if (not legal) or ("achillio" in legal.lower()) or legal.lower() == "achillio":
                tenant.legal_name = "PoreiaGo"
                logger.info(
                    "Healed PoreiaGo platform legal_name (was %r) slug=%s",
                    legal or "",
                    _tenant_slug(tenant),
                )
            domain = _tenant_domain(tenant)
            if domain and "achilliotravel.com" in domain:
                tenant.custom_domain = None
                logger.info(
                    "Cleared Achillio Travel custom_domain from PoreiaGo platform slug=%s",
                    _tenant_slug(tenant),
                )

        updated = apply_known_office_rent_policy(tenant)
        if updated is None:
            continue
        tenant.settings_json = json.dumps(updated, ensure_ascii=False)
        if is_achillio_travel_office(tenant):
            disabled += 1
            logger.info(
                "Rent disabled for Achillio Travel office slug=%s domain=%s",
                _tenant_slug(tenant),
                _tenant_domain(tenant) or "—",
            )
        else:
            enabled += 1
            logger.info(
                "Rent enabled for PoreiaGo platform office slug=%s",
                _tenant_slug(tenant),
            )
    if disabled or enabled:
        await session.commit()
    return {"achillio_rent_disabled": disabled, "poreiago_rent_enabled": enabled}
