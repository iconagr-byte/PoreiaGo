import { API_BASE } from '../config/api.js';
import { normalizeTrip } from '../lib/trips/tripMarket.js';

/**
 * Published trips for the current office Host (tenant-scoped).
 * Native Wallet: pass tenantId (Host is localhost).
 * Never falls back to shared mock / localStorage catalogs.
 *
 * @param {string | { host?: string, tenantId?: string }} [hostOrOpts]
 */
export async function fetchPublicOfficeTrips(hostOrOpts) {
  let effectiveHost =
    typeof hostOrOpts === 'string' ? hostOrOpts : String(hostOrOpts?.host || '');
  if (!effectiveHost && typeof window !== 'undefined') {
    effectiveHost = window.location.host || window.location.hostname || '';
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
      const hostOnly = String(effectiveHost || '')
        .split(':')[0]
        .toLowerCase();
      if (sealed && (isNativeApp() || isPlatformMarketingHost(hostOnly))) {
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
    const res = await fetch(`${API_BASE}/api/site/trips${q}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((t) => normalizeTrip(t));
      }
    }
  } catch {
    /* offline / API down — empty list (never bleed another office) */
  }
  return [];
}
