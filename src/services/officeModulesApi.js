import { API_BASE } from '../config/api.js';
import {
  contractDesignLabel,
  designPagesForModules,
  isRentOnlyModules,
  officeModeFromModules,
  resolveDesignPageForModules,
} from '../lib/admin/officeDesignPages.js';
import { isAchillioTravelHost, isPlatformMarketingHost } from '../lib/platform/tenantHost.js';
import { canAccessPlatformOperatorUi, isImpersonating } from '../lib/saasJwt.js';

export {
  contractDesignLabel,
  designPagesForModules,
  isRentOnlyModules,
  officeModeFromModules,
  resolveDesignPageForModules,
};

export const DEFAULT_OFFICE_MODULES = {
  trips_enabled: true,
  rent_enabled: false,
  plan: 'starter',
  mode: 'trips_only',
  tenant_slug: null,
  office_kind: 'customer',
};

function normalizeModules(data = {}) {
  return {
    trips_enabled: data.trips_enabled !== false,
    rent_enabled: Boolean(data.rent_enabled),
    plan: String(data.plan || 'starter'),
    mode: String(data.mode || 'trips_only'),
    tenant_slug: data.tenant_slug ? String(data.tenant_slug) : null,
    office_kind: String(data.office_kind || 'customer'),
  };
}

/**
 * Public office modules for the current (or given) host.
 * Rent-only contracts → homepage shows only Rent; bus + add-on → both.
 */
export async function fetchOfficeModules(hostOrOpts) {
  let effectiveHost =
    typeof hostOrOpts === 'string'
      ? hostOrOpts
      : String(hostOrOpts?.host || '');
  if (!effectiveHost && typeof window !== 'undefined') {
    effectiveHost = window.location.hostname;
  }
  let tenantId =
    typeof hostOrOpts === 'object' && hostOrOpts
      ? String(hostOrOpts.tenantId || '').trim()
      : '';

  if (!tenantId) {
    try {
      const { getWalletTenantId } = await import('../lib/wallet/walletTenantSeal.js');
      const { isNativeApp } = await import('../lib/capacitor/isNativeApp.js');
      const { isPlatformMarketingHost } = await import('../lib/platform/tenantHost.js');
      const sealed = getWalletTenantId();
      if (sealed && (isNativeApp() || isPlatformMarketingHost(effectiveHost))) {
        tenantId = sealed;
      }
    } catch {
      /* ignore */
    }
  }

  const qs = new URLSearchParams();
  if (tenantId) qs.set('tenant_id', tenantId);
  else if (effectiveHost) qs.set('host', effectiveHost);
  const q = qs.toString() ? `?${qs}` : '';
  try {
    const res = await fetch(`${API_BASE}/api/site/modules${q}`);
    if (!res.ok) return { ...DEFAULT_OFFICE_MODULES };
    const data = await res.json().catch(() => ({}));
    return normalizeModules(data);
  } catch {
    return { ...DEFAULT_OFFICE_MODULES };
  }
}

/** Authenticated modules for the logged-in office (Back Office nav). */
export async function fetchAdminOfficeModules() {
  try {
    const { saasFetch } = await import('./saasApi.js');
    const data = await saasFetch('/api/v1/billing/modules');
    return normalizeModules(data);
  } catch {
    return { ...DEFAULT_OFFICE_MODULES };
  }
}

/** Slugs used by the PoreiaGo platform / demo office (not Achillio Travel). */
const POREIAGO_PLATFORM_SLUGS = new Set([
  'poreiago',
  'platform',
  'demo',
  'admin-poreiago',
  'poreiago-saas',
  'poreiago-platform',
  // Historic seed slug — Achillio Travel uses domain/slugs like admin-achillio-gr.
  'achillio',
]);

function isPoreiagoPlatformModules(modules) {
  if (!modules || modules.office_kind === 'achillio_travel') return false;
  if (modules.office_kind === 'poreiago_platform') return true;
  const slug = String(modules.tenant_slug || '')
    .trim()
    .toLowerCase();
  return Boolean(slug) && POREIAGO_PLATFORM_SLUGS.has(slug);
}

/**
 * Whether the Back Office «Ενοικιάσεις» menu should show.
 *
 * - PoreiaGo Super Admin (not impersonating) → always yes
 * - PoreiaGo marketing host (poreiago.com / localhost) → always yes
 * - Achillio Travel office → no (bus-only policy)
 * - Office with rent_enabled → yes
 * - PoreiaGo platform office (incl. seed slug achillio) → yes
 */
/**
 * Public storefront /rent — only when the office has Rent enabled.
 * PoreiaGo marketing host (poreiago.com) keeps Rent as product demo on the web.
 *
 * Native Wallet runs on localhost (also a “marketing” host) with a sealed office
 * tenant — never use the demo shortcut there; follow rent_enabled / office_kind.
 *
 * @param {object} [modules]
 * @param {{ hostname?: string, nativeWallet?: boolean, sealedTenant?: boolean }} [opts]
 */
export function shouldShowRentStorefront(modules, opts = {}) {
  const hostname =
    opts.hostname ||
    (typeof window !== 'undefined' ? window.location.hostname : '');
  // Achillio Travel domain is bus-only even if modules API drifts.
  if (isAchillioTravelHost(hostname)) return false;
  // Achillio Travel office is bus-only — check before marketing host, because
  // Capacitor Wallet uses localhost + sealed Achillio tenant.
  if (modules?.office_kind === 'achillio_travel') return false;
  // Sealed / native wallet: only show Rent if that office paid for the contract.
  if (opts.nativeWallet || opts.sealedTenant) {
    return Boolean(modules?.rent_enabled);
  }
  // PoreiaGo marketing keeps Rent as product demo (web only).
  if (isPlatformMarketingHost(hostname)) return true;
  return Boolean(modules?.rent_enabled);
}

export function shouldShowRentMenu(modules, opts = {}) {
  // Impersonating a tenant office → match that office (Achillio stays Rent-off).
  if (isImpersonating()) {
    if (modules?.office_kind === 'achillio_travel') return false;
    return (
      Boolean(modules?.rent_enabled) || isPoreiagoPlatformModules(modules)
    );
  }

  // Super Admin platform UI — always keep Ενοικιάσεις (host-agnostic).
  if (canAccessPlatformOperatorUi()) return true;

  const hostname =
    opts.hostname ||
    (typeof window !== 'undefined' ? window.location.hostname : '');
  // PoreiaGo apex Back Office must always see Rent, even if /billing/modules
  // returns a bus-only / mis-tagged office payload.
  if (isPlatformMarketingHost(hostname)) return true;

  if (modules?.office_kind === 'achillio_travel') return false;
  if (modules?.rent_enabled) return true;
  if (isPoreiagoPlatformModules(modules)) return true;
  return false;
}
