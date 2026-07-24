/**
 * Partner portal credentials (local office-issued), separate from SaaS admin.
 */
const PARTNERS_KEY = 'poreiago_partner_accounts_v1';
const SESSION_KEY = 'poreiago_partner_session_v1';

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

export function listPartnerAccounts() {
  return readPartners().map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    tripIds: p.tripIds || [],
    createdAt: p.createdAt,
  }));
}

export function upsertPartnerAccount({ id, name, email, password, tripIds = [] }) {
  const partners = readPartners();
  const pid = id || `partner_${Date.now()}`;
  const idx = partners.findIndex((p) => p.id === pid || p.email === email);
  const row = {
    id: pid,
    name: String(name || '').trim() || 'Partner',
    email: String(email || '').trim().toLowerCase(),
    password: String(password || 'partner'),
    tripIds: (tripIds || []).map(Number),
    createdAt: partners[idx]?.createdAt || new Date().toISOString(),
  };
  if (idx >= 0) partners[idx] = { ...partners[idx], ...row };
  else partners.push(row);
  writePartners(partners);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    tripIds: row.tripIds,
    createdAt: row.createdAt,
  };
}

export function partnerLogin(email, password) {
  const partners = readPartners();
  const found = partners.find(
    (p) => p.email === String(email || '').trim().toLowerCase() && p.password === String(password || ''),
  );
  if (!found) return null;
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
