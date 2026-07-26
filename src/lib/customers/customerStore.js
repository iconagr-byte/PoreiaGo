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
 * Δημιουργία/ενημέρωση καρτέλας πελάτη (registration, checkout, login, admin).
 * @param {object} input
 */
export function upsertCustomer(input) {
  const email = String(input.email || '').trim().toLowerCase();
  if (!email) return null;

  const stored = loadStoredCustomers();
  const useMocks = !isAuthenticatedOfficeSession();
  const mock = useMocks
    ? mockCustomers.find((c) => c.email.toLowerCase() === email)
    : null;
  const idx = stored.findIndex((c) => c.email.toLowerCase() === email);
  const existing = idx >= 0 ? stored[idx] : mock || null;
  const idPool = useMocks ? [...mockCustomers, ...stored] : stored;

  const pick = (key, fallback = '') => {
    if (input[key] !== undefined && input[key] !== null) {
      return typeof input[key] === 'string' ? input[key].trim() : input[key];
    }
    return existing?.[key] ?? fallback;
  };

  const tagsRaw = input.tags !== undefined ? input.tags : existing?.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.map((t) => String(t).trim()).filter(Boolean)
    : String(tagsRaw || '')
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean);

  const tierIn = pick('tier', existing?.tier || 'Silver');
  const tier = ['Silver', 'Gold', 'Platinum', 'VIP'].includes(tierIn) ? tierIn : 'Silver';

  const record = {
    id: input.id || existing?.id || nextCustomerId(idPool),
    name: pick('name') || existing?.name || email.split('@')[0],
    email,
    phone: pick('phone'),
    company: pick('company'),
    afm: pick('afm'),
    city: pick('city'),
    address: pick('address'),
    notes: pick('notes'),
    source: pick('source', 'manual'),
    marketingOptIn: Boolean(
      input.marketingOptIn !== undefined ? input.marketingOptIn : existing?.marketingOptIn,
    ),
    tags,
    points: existing?.points ?? 0,
    tier,
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

/** Δημιουργία/ενημέρωση φυσικού προσώπου από κράτηση ενοικίασης. */
export function ensureCustomerForRental({ name, email, phone, id } = {}) {
  if (!email) return null;
  return upsertCustomer({
    id,
    name,
    email,
    phone,
    source: 'rental',
  });
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

/**
 * Sync rental booking clients into the CRM πελατολόγιο (real people).
 * Returns { created, people } where people are CUST-* records linked to rentals.
 */
export function syncCustomersFromRentalBookings(rentalBookings = []) {
  let created = 0;
  const byId = new Map();
  for (const booking of rentalBookings || []) {
    const email = String(booking.client_email || booking.clientEmail || '').trim();
    if (!email || !email.includes('@')) continue;
    const existed = Boolean(getCustomerByEmail(email));
    const row = ensureCustomerForRental({
      id: booking.client_id || booking.clientId || undefined,
      name: booking.client_name || booking.clientName || '',
      email,
      phone: booking.client_phone || booking.clientPhone || '',
    });
    if (!row) continue;
    if (!existed) created += 1;
    const prev = byId.get(row.id) || {
      ...row,
      rental_booking_count: 0,
      rental_active_count: 0,
      rental_spent_eur: 0,
      rental_channels: new Set(),
      last_rental_at: null,
      last_rental_status: null,
      last_rental_vehicle: null,
    };
    prev.rental_booking_count += 1;
    if (['CONFIRMED', 'ACTIVE'].includes(booking.rental_status)) {
      prev.rental_active_count += 1;
    }
    if (booking.rental_status !== 'CANCELLED') {
      prev.rental_spent_eur += Number(booking.total_cost || 0);
    }
    const channel = String(booking.channel || (email ? 'WALLET' : 'DESK')).toUpperCase();
    prev.rental_channels.add(channel);
    const when = booking.created_at || booking.start_time;
    if (when && (!prev.last_rental_at || String(when) > String(prev.last_rental_at))) {
      prev.last_rental_at = when;
      prev.last_rental_status = booking.rental_status;
      prev.last_rental_vehicle = booking.vehicle_plate || booking.vehicle_model;
    }
    byId.set(row.id, prev);
  }
  const people = [...byId.values()]
    .map((p) => ({
      ...p,
      rental_channels: [...(p.rental_channels || [])],
      rental_spent_eur: Math.round((p.rental_spent_eur || 0) * 100) / 100,
    }))
    .sort((a, b) => String(b.last_rental_at || '').localeCompare(String(a.last_rental_at || '')));
  return { created, people };
}

