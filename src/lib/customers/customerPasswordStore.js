const STORAGE_KEY = 'aerostride_customer_passwords_v1';
const MIN_LENGTH = 6;
const PBKDF2_ITERATIONS = 120_000;

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

function toBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function deriveHash(password, saltBytes) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
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

async function hashPassword(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(password, saltBytes);
  return `${toBase64(saltBytes)}:${hash}`;
}

async function verifyStoredPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [saltB64, expectedHash] = stored.split(':');
  const hash = await deriveHash(password, fromBase64(saltB64));
  return hash === expectedHash;
}

export function hasCustomerPassword(email) {
  const key = String(email || '').trim().toLowerCase();
  if (!key) return false;
  return Boolean(loadAll()[key]);
}

/** Πρώτη σύνδεση: αποθηκεύει τον κωδικό. Επόμενες: επαλήθευση. */
export async function verifyOrInitCustomerPassword(email, password) {
  const key = String(email || '').trim().toLowerCase();
  if (!key || !password) return false;

  const map = loadAll();
  if (!map[key]) {
    map[key] = await hashPassword(password);
    saveAll(map);
    return true;
  }
  return verifyStoredPassword(password, map[key]);
}

export async function changeCustomerPassword(email, currentPassword, newPassword) {
  const key = String(email || '').trim().toLowerCase();
  if (!key) throw new Error('Μη έγκυρο email');

  if (String(newPassword || '').length < MIN_LENGTH) {
    throw new Error(`Ο νέος κωδικός πρέπει να έχει τουλάχιστον ${MIN_LENGTH} χαρακτήρες`);
  }
  if (newPassword === currentPassword) {
    throw new Error('Ο νέος κωδικός πρέπει να διαφέρει από τον τρέχοντα');
  }

  const map = loadAll();
  const stored = map[key];

  if (stored) {
    const ok = await verifyStoredPassword(currentPassword, stored);
    if (!ok) throw new Error('Ο τρέχων κωδικός είναι λάθος');
  }

  map[key] = await hashPassword(newPassword);
  saveAll(map);
  return true;
}
