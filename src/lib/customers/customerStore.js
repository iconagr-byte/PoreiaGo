import { mockCustomers } from '../../data/mockData.js';

const STORAGE_KEY = 'aerostride_customers_v1';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function nextCustomerId(existing) {
  const nums = existing
    .map((c) => {
      const m = String(c.id || '').match(/^CUST-(\d+)$/);
      return m ? Number(m[1]) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length ? Math.max(...nums) : 0;
  return `CUST-${String(max + 1).padStart(3, '0')}`;
}

function loadStoredCustomers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* seed from mock */
  }
  return [];
}

function saveStoredCustomers(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** mock + registered (stored wins on same email) */
export function loadAllCustomers() {
  const stored = loadStoredCustomers();
  const byEmail = new Map();
  for (const c of mockCustomers) {
    byEmail.set(c.email.toLowerCase(), { ...c });
  }
  for (const c of stored) {
    byEmail.set(c.email.toLowerCase(), { ...byEmail.get(c.email.toLowerCase()), ...c });
  }
  return [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name, 'el'));
}

export function getCustomerByEmail(email) {
  if (!email) return null;
  const key = email.trim().toLowerCase();
  return loadAllCustomers().find((c) => c.email.toLowerCase() === key) || null;
}

export function getCustomerById(id) {
  return loadAllCustomers().find((c) => c.id === id) || null;
}

/**
 * Δημιουργία/ενημέρωση καρτέλας πελάτη (registration, checkout, login).
 * @param {{ email: string, name?: string, phone?: string, picture?: string, authProvider?: string }} input
 */
export function upsertCustomer(input) {
  const email = input.email.trim().toLowerCase();
  if (!email) return null;

  const stored = loadStoredCustomers();
  const mock = mockCustomers.find((c) => c.email.toLowerCase() === email);
  const idx = stored.findIndex((c) => c.email.toLowerCase() === email);
  const existing = idx >= 0 ? stored[idx] : mock || null;

  const record = {
    id: input.id || existing?.id || nextCustomerId([...mockCustomers, ...stored]),
    name: input.name?.trim() || existing?.name || email.split('@')[0],
    email,
    phone: input.phone?.trim() || existing?.phone || '',
    points: existing?.points ?? 0,
    tier: existing?.tier ?? 'Silver',
    joinDate: existing?.joinDate ?? todayIsoDate(),
    picture: input.picture || existing?.picture || '',
    authProvider: input.authProvider || existing?.authProvider || 'email',
  };

  if (idx >= 0) {
    stored[idx] = { ...stored[idx], ...record };
  } else if (!mock) {
    stored.push(record);
  } else {
    stored.push({ ...mock, ...record, id: mock.id });
  }

  saveStoredCustomers(stored);
  return record;
}

/** Για κράτηση checkout — σύνδεση booking.customerId με καρτέλα πελάτη */
export function ensureCustomerForPassenger(passenger) {
  return upsertCustomer({
    email: passenger.email,
    name: passenger.name,
    phone: passenger.phone,
    authProvider: 'checkout',
  });
}
