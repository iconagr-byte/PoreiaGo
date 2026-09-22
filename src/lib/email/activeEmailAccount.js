/**
 * Selected mailbox account id — browser preference only.
 * Full IMAP/SMTP credentials live in server SQLite (email_settings).
 */
import { officeStorageKey } from '../admin/officeTenantStore.js';

const STORAGE_KEY_BASE = 'email_active_account';

function storageKey() {
  return officeStorageKey(STORAGE_KEY_BASE);
}

/** Read last-selected email_settings id for this office (tenant-scoped). */
export function readActiveEmailAccountId() {
  try {
    const scoped = localStorage.getItem(storageKey());
    if (scoped) return scoped;
    // Legacy global key (pre-tenant-scope) — may point at another office's EMS id.
    return localStorage.getItem(STORAGE_KEY_BASE) || '';
  } catch {
    return '';
  }
}

export function writeActiveEmailAccountId(id) {
  try {
    const key = storageKey();
    if (id) {
      localStorage.setItem(key, id);
    } else {
      localStorage.removeItem(key);
    }
    // Drop unscoped legacy so stale EMS ids cannot leak across offices/PCs.
    localStorage.removeItem(STORAGE_KEY_BASE);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Keep a stored id only if it still exists on the server list for this office.
 * Stale localStorage (deleted/recreated account, other tenant) caused Sync → "Account not found".
 */
export function reconcileActiveEmailAccountId(accounts, preferredId = '') {
  const list = Array.isArray(accounts) ? accounts : [];
  const want = String(preferredId || '').trim();
  if (want && list.some((a) => a && a.id === want)) return want;
  return list[0]?.id || '';
}
