/**
 * Device-local wallet lock (PIN + biometrics preference).
 * Persists per customer email on this device — no server round-trip.
 * Prefer Capacitor Preferences / LocalAuthentication when those plugins ship;
 * falls back to localStorage (works in web + Capacitor WebView).
 */

const STORAGE_KEY = 'poreiago_wallet_device_security_v1';
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
  return {
    hasPin: Boolean(row?.pinHash),
    biometricsEnabled: Boolean(row?.biometricsEnabled),
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

export async function setBiometricsEnabled(email, enabled) {
  putEntry(email, { biometricsEnabled: Boolean(enabled) });
  return getWalletDeviceSecurity(email);
}

export async function setWalletPin(email, { currentPin = '', newPin }) {
  const digits = validatePinFormat(newPin);
  const row = getEntry(email);
  if (row?.pinHash) {
    const ok = await verifyStoredPin(normalizePin(currentPin), row.pinHash);
    if (!ok) throw new Error('Το τρέχον PIN είναι λάθος');
  }
  putEntry(email, { pinHash: await hashPin(digits) });
  return getWalletDeviceSecurity(email);
}

export async function clearWalletPin(email, currentPin) {
  const row = getEntry(email);
  if (!row?.pinHash) return getWalletDeviceSecurity(email);
  const ok = await verifyStoredPin(normalizePin(currentPin), row.pinHash);
  if (!ok) throw new Error('Το τρέχον PIN είναι λάθος');
  putEntry(email, { pinHash: null });
  return getWalletDeviceSecurity(email);
}

export async function verifyWalletPin(email, pin) {
  const row = getEntry(email);
  if (!row?.pinHash) return false;
  return verifyStoredPin(normalizePin(pin), row.pinHash);
}
