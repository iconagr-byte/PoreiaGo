import { mockCustomers } from '../../data/mockData.js';
import {
  isAuthenticatedOfficeSession,
  officeStorageKey,
} from '../admin/officeTenantStore.js';

const STORAGE_KEY_BASE = 'aerostride_customers_v1';
const DELETED_KEY_BASE = 'aerostride_customers_deleted_v1';

/** Bus / excursion CRM peλατολόγιο. */
export const CUSTOMER_SERVICE_BUSES = 'buses';
/** Rental CRM πελατολόγιο — separate from buses even for the same email. */
export const CUSTOMER_SERVICE_RENT = 'rent';

export function normalizeCustomerServiceScope(value, hints = {}) {
  if (value === CUSTOMER_SERVICE_RENT || value === CUSTOMER_SERVICE_BUSES) return value;
  if (hints.source === 'rental' || hints.serviceScope === CUSTOMER_SERVICE_RENT) {
    return CUSTOMER_SERVICE_RENT;
  }
  return CUSTOMER_SERVICE_BUSES;
}

function storageKey() {
  return officeStorageKey(STORAGE_KEY_BASE);
}

function deletedStorageKey() {
  return officeStorageKey(DELETED_KEY_BASE);
}

function deletedKey(email, serviceScope) {
  const scope = normalizeCustomerServiceScope(serviceScope);
  return `${String(email || '').trim().toLowerCase()}::${scope}`;
}

function loadDeletedEmails() {
  try {
    const raw = localStorage.getItem(deletedStorageKey());
    if (!raw) return new Set();
    const list = JSON.parse(raw);
    return new Set(
      (Array.isArray(list) ? list : [])
        .map((e) => String(e || '').trim().toLowerCase())
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

function saveDeletedEmails(emails) {
  localStorage.setItem(deletedStorageKey(), JSON.stringify([...emails]));
}

function isDeletedEmail(email, serviceScope) {
  const key = String(email || '').trim().toLowerCase();
  if (!key) return false;
  const deleted = loadDeletedEmails();
  const scoped = deletedKey(key, serviceScope);
  if (deleted.has(scoped)) return true;
  // Legacy tombstones (pre-scope) blocked the email for every service.
  if (deleted.has(key)) return true;
  return false;
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

function withServiceScope(customer) {
  if (!customer) return null;
  const serviceScope = normalizeCustomerServiceScope(customer.serviceScope, customer);
  return { ...customer, serviceScope };
}

function loadStoredCustomers() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) {
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      let changed = false;
      const next = list.map((c) => {
        const scoped = withServiceScope(c);
        if (scoped.serviceScope !== c.serviceScope) changed = true;
        return scoped;
      });
      if (changed) saveStoredCustomers(next);
      return next;
    }
  } catch {
    /* empty */
  }
  return [];
}

function saveStoredCustomers(list) {
  localStorage.setItem(storageKey(), JSON.stringify(list));
}

function customerMatchesEmailScope(customer, email, serviceScope) {
  if (!customer) return false;
  const key = String(email || '').trim().toLowerCase();
  if (!key) return false;
  if (String(customer.email || '').toLowerCase() !== key) return false;
  return normalizeCustomerServiceScope(customer.serviceScope, customer) === serviceScope;
}

/**
 * All customers for the office (both services). Prefer loadCustomersByService in UI.
 */
export function loadAllCustomers() {
  const stored = loadStoredCustomers().filter(
    (c) => !isDeletedEmail(c.email, normalizeCustomerServiceScope(c.serviceScope, c)),
  );
  if (isAuthenticatedOfficeSession()) {
    return [...stored]
      .map(withServiceScope)
      .sort((a, b) => a.name.localeCompare(b.name, 'el'));
  }

  const byKey = new Map();
  for (const c of mockCustomers) {
    const scoped = withServiceScope({ ...c, serviceScope: CUSTOMER_SERVICE_BUSES });
    if (isDeletedEmail(scoped.email, scoped.serviceScope)) continue;
    byKey.set(`${scoped.email.toLowerCase()}::${scoped.serviceScope}`, scoped);
  }
  for (const c of stored) {
    const scoped = withServiceScope(c);
    if (isDeletedEmail(scoped.email, scoped.serviceScope)) continue;
    const key = `${String(scoped.email || '').toLowerCase()}::${scoped.serviceScope}`;
    byKey.set(key, { ...byKey.get(key), ...scoped });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'el'));
}

/** CRM list for one service — buses and rent never mix. */
export function loadCustomersByService(serviceScope) {
  const scope = normalizeCustomerServiceScope(serviceScope);
  return loadAllCustomers().filter(
    (c) => normalizeCustomerServiceScope(c.serviceScope, c) === scope,
  );
}

export function getCustomerByEmail(email, serviceScope = CUSTOMER_SERVICE_BUSES) {
  if (!email) return null;
  const scope = normalizeCustomerServiceScope(serviceScope);
  const key = email.trim().toLowerCase();
  return (
    loadAllCustomers().find((c) => customerMatchesEmailScope(c, key, scope)) || null
  );
}

export function getCustomerById(id) {
  return loadAllCustomers().find((c) => c.id === id) || null;
}

/**
 * Soft-delete from one service πελατολόγιο.
 * Keeps a tombstone so trip/rental sync does not immediately recreate the row.
 */
export function deleteCustomer(idOrEmail, serviceScope) {
  const needle = String(idOrEmail || '').trim();
  if (!needle) return false;
  const needleLower = needle.toLowerCase();
  const all = loadAllCustomers();
  const preferredScope = serviceScope
    ? normalizeCustomerServiceScope(serviceScope)
    : null;
  const target =
    all.find((c) => c.id === needle) ||
    all.find((c) => {
      if (String(c.email || '').toLowerCase() !== needleLower) return false;
      if (!preferredScope) return true;
      return normalizeCustomerServiceScope(c.serviceScope, c) === preferredScope;
    });
  if (!target) return false;

  const email = String(target.email || '').trim().toLowerCase();
  const scope = normalizeCustomerServiceScope(target.serviceScope, target);
  const stored = loadStoredCustomers().filter((c) => c.id !== target.id);
  saveStoredCustomers(stored);

  if (email) {
    const deleted = loadDeletedEmails();
    deleted.add(deletedKey(email, scope));
    saveDeletedEmails(deleted);
  }
  return true;
}

export function upsertCustomer(input) {
  const email = String(input.email || '').trim().toLowerCase();
  if (!email) return null;

  const serviceScope = normalizeCustomerServiceScope(input.serviceScope, input);

  // Manual create/edit brings the customer back for this service only.
  const deleted = loadDeletedEmails();
  const tombstone = deletedKey(email, serviceScope);
  if (deleted.has(tombstone)) {
    deleted.delete(tombstone);
    saveDeletedEmails(deleted);
  }
  // Clearing a legacy unscoped tombstone so re-add works.
  if (deleted.has(email)) {
    deleted.delete(email);
    saveDeletedEmails(deleted);
  }

  const stored = loadStoredCustomers();
  const useMocks = !isAuthenticatedOfficeSession();
  const mock =
    useMocks && serviceScope === CUSTOMER_SERVICE_BUSES
      ? mockCustomers.find((c) => c.email.toLowerCase() === email)
      : null;
  const idx = stored.findIndex((c) => customerMatchesEmailScope(c, email, serviceScope));
  const existing = idx >= 0 ? stored[idx] : mock ? withServiceScope({ ...mock, serviceScope }) : null;
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
    source: pick('source', serviceScope === CUSTOMER_SERVICE_RENT ? 'rental' : 'manual'),
    serviceScope,
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
    stored.push({ ...mock, ...record, id: mock.id, serviceScope });
  }

  saveStoredCustomers(stored);
  return record;
}

export function ensureCustomerForPassenger({ name, email, phone }) {
  if (!email) return null;
  return upsertCustomer({
    name,
    email,
    phone,
    serviceScope: CUSTOMER_SERVICE_BUSES,
    source: 'booking',
  });
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
    serviceScope: CUSTOMER_SERVICE_RENT,
  });
}

/**
 * Pull unique passengers from bookings into the buses πελατολόγιο.
 */
export function syncCustomersFromBookings(bookings = []) {
  let created = 0;
  for (const booking of bookings || []) {
    const email = String(booking.email || booking.customerEmail || '').trim();
    if (!email || !email.includes('@')) continue;
    if (isDeletedEmail(email, CUSTOMER_SERVICE_BUSES)) continue;
    const existed = Boolean(getCustomerByEmail(email, CUSTOMER_SERVICE_BUSES));
    const row = upsertCustomer({
      name: booking.customerName || booking.passenger_name || booking.passengerName || '',
      email,
      phone: booking.phone || booking.customerPhone || '',
      serviceScope: CUSTOMER_SERVICE_BUSES,
      source: 'booking',
    });
    if (row && !existed) created += 1;
  }
  return created;
}

/**
 * Sync rental booking clients into the rent πελατολόγιο only.
 */
export function syncCustomersFromRentalBookings(rentalBookings = []) {
  let created = 0;
  const byId = new Map();
  for (const booking of rentalBookings || []) {
    const email = String(booking.client_email || booking.clientEmail || '').trim();
    if (!email || !email.includes('@')) continue;
    if (isDeletedEmail(email, CUSTOMER_SERVICE_RENT)) continue;
    const existed = Boolean(getCustomerByEmail(email, CUSTOMER_SERVICE_RENT));
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
