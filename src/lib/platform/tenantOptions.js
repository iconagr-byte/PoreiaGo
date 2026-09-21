/**
 * Shared helpers for Super Admin office pickers (Backup, password reset, …).
 */

/**
 * Unwrap `/platform/tenants` payloads and drop duplicate ids.
 * API returns `{ items, total, offset, limit }` — never flatten nested wrappers twice.
 */
export function normalizePlatformTenantList(payload) {
  let rows = [];
  if (Array.isArray(payload)) rows = payload;
  else if (Array.isArray(payload?.items)) rows = payload.items;
  else if (Array.isArray(payload?.tenants)) rows = payload.tenants;

  const seen = new Set();
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const id = row.id != null ? String(row.id) : '';
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    out.push(row);
  }
  return out;
}

/** Office picker label — always include slug so identical legal_names are distinguishable. */
export function formatPlatformTenantLabel(tenant) {
  if (!tenant || typeof tenant !== 'object') return '—';
  const name = String(tenant.legal_name || tenant.name || '').trim();
  const slug = String(tenant.slug || '').trim();
  const subdomain = String(tenant.subdomain || '').trim();
  const hostHint =
    subdomain && subdomain !== slug ? `${slug || '—'} / ${subdomain}` : slug;
  if (name && hostHint) return `${name} · ${hostHint}`;
  return name || hostHint || String(tenant.id || '—');
}
