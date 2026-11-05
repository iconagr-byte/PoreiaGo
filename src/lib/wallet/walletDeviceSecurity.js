/**
 * Device-local wallet lock (PIN + Quick Login).
 * Persists per customer email on this device — no server round-trip.
 * Prefer Capacitor Preferences / LocalAuthentication when those plugins ship;
 * falls back to localStorage (works in web + Capacitor WebView).
 *
 * Quick Login: after PIN is set (and Quick Login enabled), a session vault is
 * kept on-device so logout → PIN unlock restores the customer JWT without
 * re-entering the password.
 */

const STORAGE_KEY = 'poreiago_wallet_device_security_v1';
const ACTIVE_KEY = 'poreiago_wallet_quick_login_active_v1';
const MIN_PIN_LEN = 4;
const MAX_PIN_LEN = 6;
const PBKDF2_ITERATIONS = 100_000;

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

function saveAll(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function emailKey(email) {
  return String(email || '').trim().toLowerCase();
}

function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function deriveHash(pin, saltBytes) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

async function hashPin(pin) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(pin, saltBytes);
  return `${toBase64(saltBytes)}:${hash}`;
}

async function verifyStoredPin(pin, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [saltB64, expectedHash] = stored.split(':');
  const hash = await deriveHash(pin, fromBase64(saltB64));
  return hash === expectedHash;
}

function getEntry(email) {
  const key = emailKey(email);
  if (!key) return null;
  const row = loadAll()[key];
  return row && typeof row === 'object' ? row : null;
}

function putEntry(email, patch) {
  const key = emailKey(email);
  if (!key) throw new Error('Μη έγκυρο email');
  const map = loadAll();
  map[key] = { ...(map[key] || {}), ...patch, updatedAt: new Date().toISOString() };
  saveAll(map);
  return map[key];
}

function normalizeVault(session = {}) {
  const accessToken = String(session.accessToken || session.access_token || '').trim();
  if (!accessToken) return null;
  return {
    accessToken,
    name: session.name || '',
    picture: session.picture || '',
    provider: session.provider || 'email',
    phone: session.phone || '',
    customerId: session.customerId || session.customer_id || '',
    tenantId: session.tenantId || session.tenant_id || '',
    savedAt: new Date().toISOString(),
  };
}

export function normalizePin(raw) {
  return String(raw || '').replace(/\D/g, '');
}

export function validatePinFormat(pin) {
  const digits = normalizePin(pin);
  if (digits.length < MIN_PIN_LEN || digits.length > MAX_PIN_LEN) {
    throw new Error(`Το PIN πρέπει να έχει ${MIN_PIN_LEN}–${MAX_PIN_LEN} ψηφία`);
  }
  return digits;
}

export function getWalletDeviceSecurity(email) {
  const row = getEntry(email);
  const hasPin = Boolean(row?.pinHash);
  const quickLoginEnabled = Boolean(row?.quickLoginEnabled ?? row?.biometricsEnabled);
  return {
    hasPin,
    biometricsEnabled: Boolean(row?.biometricsEnabled),
    quickLoginEnabled,
    hasVault: Boolean(row?.sessionVault?.accessToken),
    ready: hasPin && quickLoginEnabled && Boolean(row?.sessionVault?.accessToken),
    displayName: row?.displayName || '',
    updatedAt: row?.updatedAt || null,
  };
}

export function isBiometricsAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.PublicKeyCredential) return true;
  } catch {
    /* ignore */
  }
  // Capacitor LocalAuthentication not packaged yet — treat native WebView as capable UI.
  try {
    const cap = window.Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function isQuickLoginReady(email) {
  return getWalletDeviceSecurity(email).ready;
}

/** Pointer to the account that should offer Quick Login after logout. */
export function getActiveQuickLoginEmail() {
  try {
    return emailKey(localStorage.getItem(ACTIVE_KEY) || '');
  } catch {
    return '';
  }
}

export function setActiveQuickLoginEmail(email) {
  const key = emailKey(email);
  if (!key) {
    try {
      localStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  localStorage.setItem(ACTIVE_KEY, key);
}

/**
 * Candidate for the login screen: active email with PIN + vault + Quick Login on.
 */
export function getQuickLoginCandidate() {
  const active = getActiveQuickLoginEmail();
  if (!active) return null;
  const sec = getWalletDeviceSecurity(active);
  if (!sec.ready) return null;
  const row = getEntry(active);
  return {
    email: active,
    displayName: sec.displayName || row?.sessionVault?.name || active.split('@')[0] || active,
    picture: row?.sessionVault?.picture || '',
    biometricsEnabled: sec.biometricsEnabled,
  };
}

export function saveQuickLoginVault(email, session = {}) {
  const vault = normalizeVault(session);
  if (!vault) return getWalletDeviceSecurity(email);
  const displayName =
    String(session.name || session.displayName || '').trim() ||
    getEntry(email)?.displayName ||
    '';
  putEntry(email, {
    sessionVault: vault,
    ...(displayName ? { displayName } : {}),
  });
  return getWalletDeviceSecurity(email);
}

/**
 * After a normal password/Google login: refresh the vault if Quick Login is on.
 */
export function syncQuickLoginVaultIfEnabled(email, session = {}) {
  const sec = getWalletDeviceSecurity(email);
  if (!sec.hasPin || !sec.quickLoginEnabled) return sec;
  const next = saveQuickLoginVault(email, session);
  setActiveQuickLoginEmail(email);
  return next;
}

/**
 * Keep Quick Login available after logout (session keys cleared, vault stays).
 */
export function rememberQuickLoginOnLogout(email) {
  const key = emailKey(email);
  if (!key) return;
  if (isQuickLoginReady(key)) setActiveQuickLoginEmail(key);
}

export async function setQuickLoginEnabled(email, enabled, session = null) {
  const row = getEntry(email);
  if (enabled) {
    if (!row?.pinHash) {
      throw new Error('Ορίστε πρώτα PIN για τη Γρήγορη σύνδεση');
    }
    const vault = normalizeVault(session) || row.sessionVault;
    if (!vault?.accessToken) {
      throw new Error('Δεν υπάρχει ενεργή συνεδρία για Γρήγορη σύνδεση');
    }
    putEntry(email, {
      quickLoginEnabled: true,
      biometricsEnabled: true,
      sessionVault: vault,
      ...(session?.name ? { displayName: String(session.name).trim() } : {}),
    });
    setActiveQuickLoginEmail(email);
  } else {
    putEntry(email, {
      quickLoginEnabled: false,
      biometricsEnabled: false,
    });
    if (getActiveQuickLoginEmail() === emailKey(email)) {
      setActiveQuickLoginEmail('');
    }
  }
  return getWalletDeviceSecurity(email);
}

/** @deprecated use setQuickLoginEnabled — kept for existing callers/tests */
export async function setBiometricsEnabled(email, enabled) {
  return setQuickLoginEnabled(email, enabled);
}

export async function setWalletPin(email, { currentPin = '', newPin, session = null }) {
  const digits = validatePinFormat(newPin);
  const row = getEntry(email);
  if (row?.pinHash) {
    const ok = await verifyStoredPin(normalizePin(currentPin), row.pinHash);
    if (!ok) throw new Error('Το τρέχον PIN είναι λάθος');
  }
  const vault = normalizeVault(session) || row?.sessionVault || null;
  const patch = {
    pinHash: await hashPin(digits),
    // Setting a PIN activates Quick Login on this device when a session is available.
    quickLoginEnabled: true,
    biometricsEnabled: true,
  };
  if (vault) {
    patch.sessionVault = vault;
    if (session?.name) patch.displayName = String(session.name).trim();
  }
  putEntry(email, patch);
  if (vault) setActiveQuickLoginEmail(email);
  return getWalletDeviceSecurity(email);
}

export async function clearWalletPin(email, currentPin) {
  const row = getEntry(email);
  if (!row?.pinHash) return getWalletDeviceSecurity(email);
  const ok = await verifyStoredPin(normalizePin(currentPin), row.pinHash);
  if (!ok) throw new Error('Το τρέχον PIN είναι λάθος');
  putEntry(email, {
    pinHash: null,
    quickLoginEnabled: false,
    biometricsEnabled: false,
    sessionVault: null,
  });
  if (getActiveQuickLoginEmail() === emailKey(email)) {
    setActiveQuickLoginEmail('');
  }
  return getWalletDeviceSecurity(email);
}

export async function verifyWalletPin(email, pin) {
  const row = getEntry(email);
  if (!row?.pinHash) return false;
  return verifyStoredPin(normalizePin(pin), row.pinHash);
}

/**
 * Unlock stored session with PIN. Returns vault profile or throws.
 */
export async function unlockQuickLogin(email, pin) {
  const key = emailKey(email);
  const row = getEntry(key);
  if (!row?.pinHash) throw new Error('Δεν έχει οριστεί PIN σε αυτή τη συσκευή');
  if (!row.quickLoginEnabled && !row.biometricsEnabled) {
    throw new Error('Η Γρήγορη σύνδεση είναι απενεργοποιημένη');
  }
  if (!row.sessionVault?.accessToken) {
    throw new Error('Δεν υπάρχει αποθηκευμένη συνεδρία — συνδεθείτε με κωδικό');
  }
  const ok = await verifyStoredPin(normalizePin(pin), row.pinHash);
  if (!ok) throw new Error('Λάθος PIN');
  setActiveQuickLoginEmail(key);
  return {
    email: key,
    accessToken: row.sessionVault.accessToken,
    name: row.sessionVault.name || row.displayName || '',
    picture: row.sessionVault.picture || '',
    provider: row.sessionVault.provider || 'email',
    phone: row.sessionVault.phone || '',
    customerId: row.sessionVault.customerId || '',
    tenantId: row.sessionVault.tenantId || '',
  };
}
