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
            "rent_guest_hero_title": "Ενοικίαση αυτοκινήτου",
            "rent_guest_hero_title_accent": "— αναζήτησε, σύγκρινε & κλείσε",
            "rent_guest_hero_copy": "",
            "rent_guest_hero_benefits": [
                "Δωρεάν ακύρωση στις περισσότερες κρατήσεις",
                "Πολλαπλά σημεία παραλαβής",
                "Υποστήριξη γραφείου & οδική βοήθεια",
            ],
            "rent_search_show_dropoff_toggle": True,
            "rent_search_show_promo": True,
            "rent_search_submit_label": "Αναζήτηση",
            "rent_cta_label": "Βρες όχημα",
            "show_fleet_section": False,
            "show_why_us_section": False,
        }
    else:
        settings["modules"] = {"trips_enabled": True, "rent_enabled": False}
    return settings


def resolve_provision_plan_and_settings(
    *,
    plan: TenantPlan | str,
    service_mode: str | None = None,
    office_name: str | None = None,
) -> tuple[TenantPlan, dict[str, Any]]:
    """Map UI service mode → TenantPlan + settings_json seed."""
    mode = str(service_mode or "buses").strip().lower()
    if mode not in {"buses", "rent", "both"}:
        mode = "buses"

    raw_plan = plan if isinstance(plan, TenantPlan) else TenantPlan(str(plan or "starter"))
    if mode == "rent":
        resolved = TenantPlan.RENT
        return resolved, initial_settings_for_plan(resolved, office_name=office_name)

    # Bus bill plans never use the standalone rent enum.
    if raw_plan == TenantPlan.RENT:
        raw_plan = TenantPlan.STARTER

    settings = initial_settings_for_plan(raw_plan, office_name=office_name)
    if mode == "both":
        settings = enable_rent_addon_in_settings(settings)
    else:
        settings["modules"] = {"trips_enabled": True, "rent_enabled": False}
        addons = dict(settings.get("addons") or {})
        addons["rent"] = False
        settings["addons"] = addons
    return raw_plan, settings


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


async def _heal_legacy_tenant_name_column(session: Any, *, commit: bool = True) -> None:
    """
    Contabo legacy schema still has tenants.name NOT NULL.

    The ORM maps legal_name only, so INSERT leaves name=null and fails. Drop the
    NOT NULL constraint when the column exists, then backfill from legal_name/slug.
    """
    from sqlalchemy import text

    try:
        await session.execute(
            text(
                """
                DO $$
                BEGIN
                  IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'tenants'
                      AND column_name = 'name'
                  ) THEN
                    ALTER TABLE tenants ALTER COLUMN name DROP NOT NULL;
                    BEGIN
                      ALTER TABLE tenants ALTER COLUMN name SET DEFAULT '';
                    EXCEPTION WHEN OTHERS THEN
                      NULL;
                    END;
                    UPDATE tenants
                       SET name = COALESCE(NULLIF(BTRIM(name), ''), legal_name, slug, '')
                     WHERE name IS NULL OR BTRIM(COALESCE(name, '')) = '';
                  END IF;
                END $$;
                """
            )
        )
        if commit:
            await session.commit()
    except Exception:
        if commit:
            await session.rollback()
        logger.exception("Could not heal legacy tenants.name column")
        if not commit:
            raise


async def pg_tenant_plan_type_exists(session: Any) -> bool:
    """True only when PostgreSQL has a real enum/domain type named tenant_plan."""
    from sqlalchemy import text

    return bool(
        await session.scalar(
            text(
                """
                SELECT EXISTS (
                  SELECT 1
                  FROM pg_type t
                  JOIN pg_namespace n ON n.oid = t.typnamespace
                  WHERE n.nspname = 'public'
                    AND t.typname = 'tenant_plan'
                )
                """
            )
        )
    )


async def detect_tenant_plan_persist_style(session: Any) -> str:
    """
    Contabo often stores plan as uppercase tokens (STARTER) in VARCHAR,
    while alembic/dev uses lowercase values (starter). Detect which.
    """
    from sqlalchemy import text

    from app.models.tenant import TenantPlan

    sample = await session.scalar(
        text("SELECT plan::text FROM tenants WHERE plan IS NOT NULL LIMIT 1")
    )
    if sample is not None:
        token = str(sample).strip()
        names = {m.name for m in TenantPlan}
        values = {m.value for m in TenantPlan}
        if token in names:
            return "name"
        if token in values:
            return "value"
        if token.upper() in names:
            return "name"
        if token.lower() in values:
            return "value"

    # Prefer enum labels only when the PG type actually exists.
    if await pg_tenant_plan_type_exists(session):
        label = await session.scalar(
            text(
                """
                SELECT e.enumlabel
                FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'tenant_plan'
                ORDER BY e.enumsortorder
                LIMIT 1
                """
            )
        )
        if label is not None:
            token = str(label).strip()
            if token in {m.name for m in TenantPlan} or token.isupper():
                return "name"
    return "value"


def tenant_plan_db_token(plan: Any, style: str) -> str:
    """Persist TenantPlan as Contabo expects (name vs value)."""
    if hasattr(plan, "name") and hasattr(plan, "value"):
        return plan.name if style == "name" else plan.value
    raw = str(plan or "starter").strip()
    if style == "name":
        return raw.upper()
    return raw.lower()


def tenant_plan_sql_expr(*, has_plan_enum: bool) -> str:
    """
    Bind expression for plan inserts.
    CAST only when PG type tenant_plan exists — Contabo VARCHAR must stay plain.
    """
    if has_plan_enum:
        return "CAST(:plan AS tenant_plan)"
    return ":plan"


async def prepare_contabo_tenant_write(session: Any) -> dict[str, Any]:
    """
    Same-transaction schema softeners for Contabo create-office inserts.

    - tenants.name NOT NULL → nullable (+ empty default)
    - plan check constraints that omit ``rent`` → dropped
    - PG enum tenant_plan missing rent → ADD VALUE (only if type exists)
    Does NOT commit — stays inside the request transaction.
    """
    from sqlalchemy import text

    flags: dict[str, Any] = {
        "has_name_col": False,
        "plan_softened": False,
        "plan_style": "value",
        "has_plan_enum": False,
    }
    try:
        flags["has_plan_enum"] = await pg_tenant_plan_type_exists(session)
    except Exception:
        logger.debug("tenant_plan type detect failed", exc_info=True)
        flags["has_plan_enum"] = False
    try:
        flags["plan_style"] = await detect_tenant_plan_persist_style(session)
    except Exception:
        logger.debug("plan persist style detect failed", exc_info=True)
        flags["plan_style"] = "value"

    flags["has_name_col"] = bool(
        await session.scalar(
            text(
                """
                SELECT EXISTS (
                  SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public'
                    AND table_name = 'tenants'
                    AND column_name = 'name'
                )
                """
            )
        )
    )
    async def _safe(label: str, sql: str) -> bool:
        try:
            async with session.begin_nested():
                await session.execute(text(sql))
            return True
        except Exception:
            logger.debug("prepare_contabo_tenant_write %s skipped", label, exc_info=True)
            return False

    if flags["has_name_col"]:
        # asyncpg rejects multi-statement prepared SQL — one ALTER per execute.
        await _safe("drop_name_not_null", "ALTER TABLE tenants ALTER COLUMN name DROP NOT NULL")
        await _safe("name_default", "ALTER TABLE tenants ALTER COLUMN name SET DEFAULT ''")

    # PG enum type (if any). Contabo usually uses VARCHAR (native_enum=False).
    if flags["has_plan_enum"]:
        # Contabo labels are uppercase; also try lowercase for drifted schemas.
        if await _safe("enum_rent_upper", "ALTER TYPE tenant_plan ADD VALUE IF NOT EXISTS 'RENT'"):
            flags["plan_softened"] = True
        if await _safe("enum_rent_lower", "ALTER TYPE tenant_plan ADD VALUE IF NOT EXISTS 'rent'"):
            flags["plan_softened"] = True

    # Drop CHECK constraints that lock plan to starter/professional/enterprise.
    if await _safe(
        "plan_checks",
        """
        DO $$
        DECLARE r RECORD;
        BEGIN
          FOR r IN
            SELECT c.conname, t.relname AS tbl
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname IN ('tenants', 'subscriptions')
              AND c.contype = 'c'
              AND pg_get_constraintdef(c.oid) ILIKE '%plan%'
              AND pg_get_constraintdef(c.oid) NOT ILIKE '%rent%'
          LOOP
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
          END LOOP;
        END $$;
        """,
    ):
        flags["plan_softened"] = True
    return flags


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
    await _heal_legacy_tenant_name_column(session)
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
        # Contabo legacy: keep tenants.name in sync with legal_name when present.
        try:
            await session.execute(
                text(
                    "UPDATE tenants SET name = COALESCE(name, :n) "
                    "WHERE id = :id AND EXISTS ("
                    "  SELECT 1 FROM information_schema.columns"
                    "  WHERE table_schema = 'public' AND table_name = 'tenants'"
                    "    AND column_name = 'name')"
                ),
                {"n": "Achillio Travel", "id": office.id},
            )
        except Exception:
            logger.debug("tenants.name backfill skipped", exc_info=True)
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
            # Office admin only — never platform superadmin (slug=achillio seed).
            user = User(
                id=uuid4(),
                tenant_id=office.id,
                email=admin_email,
                password_hash=hash_password(admin_password),
                full_name=admin_email.split("@")[0],
                roles=[
                    UserRole.TENANT_ADMIN.value,
                    UserRole.DISPATCHER.value,
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

    trips_seeded = 0
    bookings_healed = 0
    from travel_platform.operations.achillio_seed_trips import (
        achillio_seed_trip_catalog,
        heal_achillio_seed_booking_departures,
        seed_achillio_office_excursions,
    )

    try:
        seed_result = seed_achillio_office_excursions(str(office.id))
        trips_seeded = int(seed_result.get("saved") or 0)
    except Exception:
        logger.exception("Achillio office excursion seed failed")
        seed_result = {}

    try:
        heal = await heal_achillio_seed_booking_departures(
            session,
            tenant_id=str(office.id),
            trips=achillio_seed_trip_catalog(),
        )
        bookings_healed = int(heal.get("updated") or 0)
    except Exception:
        logger.exception(
            "Achillio seed booking departure heal failed (catalog saved=%s)",
            trips_seeded,
        )

    return {
        "created": created,
        "domain_set": domain_set,
        "poison_cleared": poison_cleared,
        "admin_upserted": admin_upserted,
        "trips_seeded": trips_seeded,
        "bookings_healed": bookings_healed,
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
