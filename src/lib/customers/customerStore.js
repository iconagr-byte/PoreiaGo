import { mockCustomers } from '../../data/mockData.js';
import {
  isAuthenticatedOfficeSession,
  officeStorageKey,
} from '../admin/officeTenantStore.js';

const STORAGE_KEY_BASE = 'aerostride_customers_v1';

function storageKey() {
  return officeStorageKey(STORAGE_KEY_BASE);
}

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
    const raw = localStorage.getItem(storageKey());
    if (raw) return JSON.parse(raw);
  } catch {
    /* empty */
  }
  return [];
}

function saveStoredCustomers(list) {
  localStorage.setItem(storageKey(), JSON.stringify(list));
}

/** Authenticated office: only that tenant's stored customers (never mock seed). */
export function loadAllCustomers() {
  const stored = loadStoredCustomers();
  if (isAuthenticatedOfficeSession()) {
    return [...stored].sort((a, b) => a.name.localeCompare(b.name, 'el'));
  }

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
  const useMocks = !isAuthenticatedOfficeSession();
  const mock = useMocks
    ? mockCustomers.find((c) => c.email.toLowerCase() === email)
    : null;
  const idx = stored.findIndex((c) => c.email.toLowerCase() === email);
  const existing = idx >= 0 ? stored[idx] : mock || null;
  const idPool = useMocks ? [...mockCustomers, ...stored] : stored;

  const record = {
    id: input.id || existing?.id || nextCustomerId(idPool),
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

export function ensureCustomerForPassenger({ name, email, phone }) {
  if (!email) return null;
  return upsertCustomer({ name, email, phone });
}

/**
 * Pull unique passengers from bookings into the office πελατολόγιο.
 * Returns how many *new* records were created.
 */
export function syncCustomersFromBookings(bookings = []) {
  let created = 0;
  for (const booking of bookings || []) {
    const email = String(booking.email || booking.customerEmail || '').trim();
    if (!email || !email.includes('@')) continue;
    const existed = Boolean(getCustomerByEmail(email));
    const row = upsertCustomer({
      name: booking.customerName || booking.passenger_name || booking.passengerName || '',
      email,
      phone: booking.phone || booking.customerPhone || '',
    });
    if (row && !existed) created += 1;
  }
  return created;
}

