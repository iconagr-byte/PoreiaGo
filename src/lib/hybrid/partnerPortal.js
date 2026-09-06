/**
 * Partner portal credentials (local office-issued), separate from SaaS admin.
 * Passwords are stored as PBKDF2 hashes (never plaintext).
 */
const PARTNERS_KEY = 'poreiago_partner_accounts_v1';
const SESSION_KEY = 'poreiago_partner_session_v1';
const PBKDF2_ITERATIONS = 120_000;

function readPartners() {
  try {
    const raw = JSON.parse(localStorage.getItem(PARTNERS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writePartners(list) {
  localStorage.setItem(PARTNERS_KEY, JSON.stringify(list));
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

async function verifyPassword(password, stored) {
  if (!stored) return false;
  // Legacy plaintext rows (pre-hardening) — verify then migrate on next upsert/login.
  if (!String(stored).includes(':')) {
    return String(stored) === String(password || '');
  }
  const [saltB64, expectedHash] = String(stored).split(':');
  if (!saltB64 || !expectedHash) return false;
  try {
    const hash = await deriveHash(password, fromBase64(saltB64));
    return hash === expectedHash;
  } catch {
    return false;
  }
}

function publicPartner(p) {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    tripIds: p.tripIds || [],
    createdAt: p.createdAt,
  };
}

export function listPartnerAccounts() {
  return readPartners().map(publicPartner);
}

export async function upsertPartnerAccount({ id, name, email, password, tripIds = [] }) {
  const partners = readPartners();
  const pid = id || `partner_${Date.now()}`;
  const idx = partners.findIndex((p) => p.id === pid || p.email === email);
  const existing = idx >= 0 ? partners[idx] : null;
  const passwordHash =
    password != null && String(password).length
      ? await hashPassword(String(password))
      : existing?.passwordHash || (existing?.password ? await hashPassword(String(existing.password)) : await hashPassword('partner'));

  const row = {
    id: pid,
    name: String(name || '').trim() || 'Partner',
    email: String(email || '').trim().toLowerCase(),
    passwordHash,
    tripIds: (tripIds || []).map(Number),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  // Drop legacy plaintext field if present.
  delete row.password;
  if (idx >= 0) partners[idx] = { ...existing, ...row, password: undefined };
  else partners.push(row);
  writePartners(partners.map((p) => {
    const next = { ...p };
    delete next.password;
    return next;
  }));
  return publicPartner(row);
}

export async function partnerLogin(email, password) {
  const partners = readPartners();
  const found = partners.find((p) => p.email === String(email || '').trim().toLowerCase());
  if (!found) return null;
  const stored = found.passwordHash || found.password;
  const ok = await verifyPassword(password, stored);
  if (!ok) return null;

  // Migrate legacy plaintext → hash on successful login.
  if (found.password && !found.passwordHash) {
    found.passwordHash = await hashPassword(String(password));
    delete found.password;
    writePartners(partners.map((p) => {
      const next = { ...p };
      delete next.password;
      return next;
    }));
  }

  const session = {
    partnerId: found.id,
    name: found.name,
    email: found.email,
    tripIds: found.tripIds || [],
    at: new Date().toISOString(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getPartnerSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function partnerLogout() {
  localStorage.removeItem(SESSION_KEY);
}

export function deletePartnerAccount(id) {
  writePartners(readPartners().filter((p) => p.id !== id));
}

/** Test helpers (node / unit). */
export const __partnerPortalTest = {
  hashPassword,
  verifyPassword,
  PBKDF2_ITERATIONS,
};
