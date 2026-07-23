import { API_BASE } from '../config/api.js';
import { mockFleet } from '../data/mockData.js';
import { adminBearerHeaders, adminFetch } from './adminApi.js';
import { getSaasToken, issueSaasMasterQr, saasFetch } from './saasApi.js';
import { normalizeCheckoutSettings } from './checkoutSettingsApi.js';
import { normalizeBankTransferSettings } from '../lib/payments/bankTransfer.js';

const PLATFORM_SETTINGS_KEY = 'aerostride_platform_settings';
const MAINT_EVENTS_KEY = 'aerostride_maintenance_events_v1';

export const DEFAULT_PLATFORM_SETTINGS = {
  company_name: 'PoreiaGo Travel',
  support_email: 'support@poreiago.app',
  default_locale: 'el-GR',
  timezone: 'Europe/Athens',
  abandoned_pending_minutes: 60,
  abandoned_recovery_cooldown_hours: 24,
  pricing_high_occupancy_threshold: 0.8,
  pricing_high_occupancy_markup_pct: 10,
  pricing_low_occupancy_threshold: 0.3,
  pricing_low_occupancy_discount_pct: 5,
  master_qr_ttl_hours: 24,
  webhook_max_retries: 5,
  smtp_from_email: 'noreply@poreiago.app',
  sms_sender_id: 'AEROSTRIDE',
  maintenance_mode: false,
  checkout_base_url: 'http://localhost:5173',
  checkout_deposit_enabled: true,
  checkout_deposit_percent: 30,
  checkout_bank_transfer_enabled: true,
  checkout_bank_name: 'Eurobank',
  checkout_bank_beneficiary: 'PoreiaGo Travel AE',
  checkout_bank_iban: 'GR1601101250000000012300695',
  checkout_bank_bic: 'ERBKGRAA',
  checkout_bank_instructions:
    'Μετά την κατάθεση, στείλτε την απόδειξη στο email υποστήριξης. Η κράτηση επιβεβαιώνεται εντός 24 ωρών.',
  checkout_bank_reference_template: 'VOY-{pnr}',
};

async function parseError(res) {
  const err = await res.json().catch(() => ({}));
  let detail = err.detail ?? res.statusText ?? 'Request failed';
  if (Array.isArray(detail)) {
    detail = detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
  } else if (typeof detail === 'object') {
    detail = JSON.stringify(detail);
  }
  throw new Error(String(detail));
}

/** Κανονικοποίηση τιμών πριν το PATCH (αποφυγή NaN / κενών email). */
export function normalizePlatformSettings(form) {
  const out = { ...DEFAULT_PLATFORM_SETTINGS, ...form };
  const ints = [
    'abandoned_pending_minutes',
    'abandoned_recovery_cooldown_hours',
    'master_qr_ttl_hours',
    'webhook_max_retries',
    'checkout_deposit_percent',
  ];
  const floats = [
    'pricing_high_occupancy_threshold',
    'pricing_high_occupancy_markup_pct',
    'pricing_low_occupancy_threshold',
    'pricing_low_occupancy_discount_pct',
  ];
  for (const key of ints) {
    const n = parseInt(String(out[key]), 10);
    out[key] = Number.isFinite(n) ? n : DEFAULT_PLATFORM_SETTINGS[key];
  }
  for (const key of floats) {
    const n = parseFloat(String(out[key]));
    out[key] = Number.isFinite(n) ? n : DEFAULT_PLATFORM_SETTINGS[key];
  }
  out.maintenance_mode = Boolean(out.maintenance_mode);
  out.checkout_deposit_enabled =
    out.checkout_deposit_enabled !== undefined
      ? Boolean(out.checkout_deposit_enabled)
      : DEFAULT_PLATFORM_SETTINGS.checkout_deposit_enabled;
  out.checkout_deposit_percent = Math.max(
    5,
    Math.min(90, out.checkout_deposit_percent ?? DEFAULT_PLATFORM_SETTINGS.checkout_deposit_percent),
  );
  Object.assign(out, normalizeBankTransferSettings(out));
  out.company_name = String(out.company_name || '').trim() || DEFAULT_PLATFORM_SETTINGS.company_name;
  out.support_email = String(out.support_email || '').trim() || DEFAULT_PLATFORM_SETTINGS.support_email;
  out.smtp_from_email = String(out.smtp_from_email || '').trim() || DEFAULT_PLATFORM_SETTINGS.smtp_from_email;
  out.sms_sender_id = String(out.sms_sender_id || '').trim() || DEFAULT_PLATFORM_SETTINGS.sms_sender_id;
  return out;
}

function saveSettingsLocally(data) {
  localStorage.setItem(PLATFORM_SETTINGS_KEY, JSON.stringify(data));
}

export async function fetchPlatformSettings() {
  if (getSaasToken()) {
    try {
      const data = await saasFetch('/api/v1/settings/platform');
      saveSettingsLocally(data);
      return data;
    } catch {
      /* fall through to file store */
    }
  }
  try {
    const res = await adminFetch('/api/admin/platform/settings');
    if (res.ok) {
      const data = await res.json();
      saveSettingsLocally(data);
      return data;
    }
  } catch {
    /* offline */
  }
  try {
    const cached = localStorage.getItem(PLATFORM_SETTINGS_KEY);
    if (cached) return JSON.parse(cached);
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PLATFORM_SETTINGS };
}

export async function updatePlatformSettings(patch) {
  const body = normalizePlatformSettings(patch);

  if (getSaasToken()) {
    try {
      const data = await saasFetch('/api/v1/settings/platform', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      saveSettingsLocally(data);
      try {
        localStorage.setItem(
          'aerostride_checkout_settings_v1',
          JSON.stringify(normalizeCheckoutSettings(data)),
        );
      } catch {
        /* ignore */
      }
      return { data, source: data.storage_source === 'postgres' ? 'postgres' : 'server' };
    } catch (saasErr) {
      try {
        return await updatePlatformSettingsLegacy(body);
      } catch {
        throw saasErr;
      }
    }
  }

  return updatePlatformSettingsLegacy(body);
}

async function updatePlatformSettingsLegacy(body) {
  try {
    const res = await adminFetch('/api/admin/platform/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      saveSettingsLocally(data);
      try {
        localStorage.setItem(
          'aerostride_checkout_settings_v1',
          JSON.stringify(normalizeCheckoutSettings(data)),
        );
      } catch {
        /* ignore */
      }
      return { data, source: 'server' };
    }
    await parseError(res);
  } catch (err) {
    if (err instanceof TypeError || err.message?.includes('fetch')) {
      saveSettingsLocally(body);
      try {
        localStorage.setItem(
          'aerostride_checkout_settings_v1',
          JSON.stringify(normalizeCheckoutSettings(body)),
        );
      } catch {
        /* ignore */
      }
      return { data: body, source: 'local', offline: true };
    }
    throw err;
  }
  return { data: body, source: 'local' };
}

export async function fetchPlatformUsers() {
  try {
    const res = await adminFetch('/api/admin/platform/users');
    if (res.ok) return res.json();
  } catch {
    /* offline */
  }
  return getMockUsers();
}

export async function createPlatformUser(body) {
  const res = await adminFetch('/api/admin/platform/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function updatePlatformUser(userId, body) {
  const res = await adminFetch(`/api/admin/platform/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function deletePlatformUser(userId) {
  const res = await adminFetch(`/api/admin/platform/users/${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) await parseError(res);
}

export async function fetchBackups() {
  try {
    const res = await adminFetch('/api/admin/platform/backups');
    if (res.ok) return res.json();
  } catch {
    /* offline */
  }
  return [];
}

export async function createBackup() {
  const res = await adminFetch('/api/admin/platform/backups', { method: 'POST' });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function restoreBackup(backupId) {
  const res = await adminFetch(`/api/admin/platform/backups/${backupId}/restore`, {
    method: 'POST',
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function deleteBackup(backupId) {
  const res = await adminFetch(`/api/admin/platform/backups/${backupId}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) await parseError(res);
}

export async function downloadBackupFile(backupId, filename) {
  const res = await adminFetch(`/api/admin/platform/backups/${backupId}/download`);
  if (!res.ok) await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `backup-${backupId}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchFleetDrivers(status) {
  const q = status ? `?status=${status}` : '';
  try {
    const res = await adminFetch(`/api/admin/platform/drivers${q}`);
    if (res.ok) return res.json();
    // Authenticated failures must not swap in demo mocks (hides real drivers e.g. Achilleas).
    if (getSaasToken()) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Αποτυχία φόρτωσης οδηγών (${res.status})`);
    }
  } catch (err) {
    if (getSaasToken()) throw err;
  }
  return getMockDrivers();
}

export async function fetchFleetDriver(driverId) {
  try {
    const res = await adminFetch(`/api/admin/platform/drivers/${driverId}`);
    if (res.ok) return res.json();
    if (res.status === 404) return null;
    if (getSaasToken()) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Αποτυχία φόρτωσης οδηγού (${res.status})`);
    }
  } catch (err) {
    if (getSaasToken()) throw err;
  }
  return getMockDrivers().find((d) => d.id === driverId) || null;
}

export async function createFleetDriver(body) {
  const res = await adminFetch('/api/admin/platform/drivers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Η συνεδρία admin έληξε — συνδεθείτε ξανά');
  }
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function updateFleetDriver(driverId, body) {
  const res = await adminFetch(`/api/admin/platform/drivers/${driverId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Η συνεδρία admin έληξε — συνδεθείτε ξανά');
  }
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function deleteFleetDriver(driverId) {
  const res = await adminFetch(`/api/admin/platform/drivers/${driverId}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 204) await parseError(res);
}

/** Upload driver headshot — returns relative `/api/site/driver-photos/...` URL. */
export async function uploadDriverPhoto(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/admin/platform/drivers/photo-upload`, {
    method: 'POST',
    headers: adminBearerHeaders(),
    body: form,
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function fetchFleetPlateAvailability(plate) {
  if (!plate) return { available: true };
  try {
    const res = await adminFetch(
      `/api/admin/platform/fleet/availability?plate=${encodeURIComponent(plate)}`,
    );
    if (res.ok) return res.json();
  } catch {
    /* offline */
  }
  const vehicles = await fetchFleetVehicles();
  const p = String(plate).trim().toUpperCase().replace(/\s+/g, '');
  const vehicle = vehicles.find(
    (v) => String(v.plate_number || '').toUpperCase().replace(/\s+/g, '') === p,
  );
  if (!vehicle) return { available: true, unknown_plate: true };
  if (vehicle.service_status === 'Urgent') {
    return {
      available: false,
      reason: 'Το όχημα έχει επείγουσα ανάγκη συντήρησης.',
      service_status: vehicle.service_status,
    };
  }
  if (vehicle.days_to_legal_deadline != null && vehicle.days_to_legal_deadline < 0) {
    return { available: false, reason: 'Το ΚΤΕΟ έχει λήξει.' };
  }
  return {
    available: true,
    warning:
      vehicle.service_status === 'Warning'
        ? 'Προσοχή: πλησιάζει service.'
        : null,
    service_status: vehicle.service_status,
  };
}

export async function fetchFleetVehicles() {
  try {
    const res = await adminFetch('/api/admin/platform/fleet/vehicles');
    if (res.ok) return res.json();
  } catch {
    /* offline */
  }
  // Authenticated office: never inject platform demo fleet.
  try {
    if (localStorage.getItem('saas_access_token')) return [];
  } catch {
    /* ignore */
  }
  return getMockVehicles();
}

export async function createFleetVehicle(payload) {
  const res = await adminFetch('/api/admin/platform/fleet/vehicles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || 'Αποτυχία δημιουργίας οχήματος');
  }
  return data;
}

export async function fetchFleetVehicle(vehicleId) {
  const res = await adminFetch(
    `/api/admin/platform/fleet/vehicles/${encodeURIComponent(vehicleId)}`,
  );
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || 'Αποτυχία φόρτωσης οχήματος');
  }
  return data;
}

export async function updateFleetVehicle(vehicleId, payload) {
  const res = await adminFetch(
    `/api/admin/platform/fleet/vehicles/${encodeURIComponent(vehicleId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data.detail === 'string'
        ? data.detail
        : data.message || 'Αποτυχία ενημέρωσης οχήματος',
    );
  }
  return data;
}

export async function deleteFleetVehicle(vehicleId) {
  const res = await adminFetch(
    `/api/admin/platform/fleet/vehicles/${encodeURIComponent(vehicleId)}`,
    { method: 'DELETE' },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || 'Αποτυχία διαγραφής οχήματος');
  }
  return data;
}

export async function fetchFleetAvailabilityBoard() {
  const res = await adminFetch('/api/admin/platform/fleet/availability-board');
  if (!res.ok) return [];
  return res.json();
}

export async function fetchFleetCalendar(withinDays = 120) {
  const res = await adminFetch(
    `/api/admin/platform/fleet/calendar?within_days=${encodeURIComponent(withinDays)}`,
  );
  if (!res.ok) return [];
  return res.json();
}

export async function fetchFleetDocuments(vehicleId) {
  const q = vehicleId ? `?vehicle_id=${encodeURIComponent(vehicleId)}` : '';
  const res = await adminFetch(`/api/admin/platform/fleet/documents${q}`);
  if (!res.ok) return [];
  return res.json();
}

export async function uploadFleetDocument(vehicleId, file, { kind = 'registration', expiresAt } = {}) {
  const params = new URLSearchParams({ kind });
  if (expiresAt) params.set('expires_at', expiresAt);
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(
    `${API_BASE}/api/admin/platform/fleet/vehicles/${encodeURIComponent(vehicleId)}/documents?${params}`,
    { method: 'POST', headers: adminBearerHeaders(), body: form },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || 'Αποτυχία ανεβάσματος εγγράφου');
  }
  return data;
}

export async function deleteFleetDocument(vehicleId, documentId) {
  const res = await adminFetch(
    `/api/admin/platform/fleet/vehicles/${encodeURIComponent(vehicleId)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Αποτυχία διαγραφής εγγράφου');
  }
  return true;
}

export async function fetchFleetExpenses(vehicleId) {
  const q = vehicleId ? `?vehicle_id=${encodeURIComponent(vehicleId)}` : '';
  const res = await adminFetch(`/api/admin/platform/fleet/expenses${q}`);
  if (!res.ok) return [];
  return res.json();
}

export async function createFleetExpense(payload) {
  const res = await adminFetch('/api/admin/platform/fleet/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || 'Αποτυχία καταχώρισης εξόδου');
  }
  return data;
}

export async function deleteFleetExpense(expenseId) {
  const res = await adminFetch(
    `/api/admin/platform/fleet/expenses/${encodeURIComponent(expenseId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Αποτυχία διαγραφής');
  }
  return true;
}

export async function fetchFleetDashboard() {
  try {
    const res = await adminFetch('/api/admin/platform/fleet/dashboard');
    if (res.ok) return res.json();
  } catch {
    /* offline */
  }
  const vehicles = getMockVehicles();
  const urgent = vehicles.filter((v) => v.service_status === 'Urgent');
  const warning = vehicles.filter((v) => v.service_status === 'Warning');
  return {
    urgent_count: urgent.length,
    warning_count: warning.length,
    alerts_count: urgent.length + warning.length,
    monthly_cost_estimate: vehicles.reduce((sum, v) => sum + Number(v.insurance_cost_total || 0), 0) / 12,
    needs_attention: [...urgent, ...warning].slice(0, 5),
    alerts: [],
  };
}

export async function fetchFleetAlerts(unresolvedOnly = true) {
  try {
    const q = unresolvedOnly ? '?unresolved_only=true' : '';
    const res = await adminFetch(`/api/admin/platform/fleet/alerts${q}`);
    if (res.ok) {
      const data = await res.json();
      return unresolvedOnly ? filterUnresolvedLocal(data) : data;
    }
  } catch {
    /* offline */
  }
  return [];
}

const RESOLVED_ALERTS_KEY = 'aerostride_fleet_resolved_alerts';

function markAlertResolvedLocal(alertId) {
  try {
    const raw = localStorage.getItem(RESOLVED_ALERTS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    if (!ids.includes(alertId)) ids.push(alertId);
    localStorage.setItem(RESOLVED_ALERTS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function filterUnresolvedLocal(alerts) {
  try {
    const raw = localStorage.getItem(RESOLVED_ALERTS_KEY);
    const resolved = raw ? new Set(JSON.parse(raw)) : new Set();
    return alerts.filter((a) => !resolved.has(a.id));
  } catch {
    return alerts;
  }
}

export async function resolveFleetAlert(alertId) {
  try {
    const res = await adminFetch(
      `/api/admin/platform/fleet/alerts/${encodeURIComponent(alertId)}/resolve`,
      { method: 'POST' },
    );
    if (res.ok) {
      markAlertResolvedLocal(alertId);
      return res.json();
    }
    await parseError(res);
  } catch {
    markAlertResolvedLocal(alertId);
    return { id: alertId, resolved: true };
  }
}

export async function reportFleetDispatchBlocked({ plate, reason, tripTitle }) {
  try {
    const res = await adminFetch('/api/admin/platform/fleet/dispatch-blocked', {
      method: 'POST',
      body: JSON.stringify({
        plate,
        reason,
        trip_title: tripTitle || null,
      }),
    });
    if (res.ok) return res.json();
  } catch {
    /* offline */
  }
  return null;
}

export async function scanFleetAlerts() {
  try {
    const res = await adminFetch('/api/admin/platform/fleet/alerts/scan', { method: 'POST' });
    if (res.ok) return res.json();
    await parseError(res);
  } catch {
    /* offline fallback */
  }
  return [];
}

export async function fetchMaintenanceEvents(vehicleId) {
  const q = vehicleId ? `?vehicle_id=${encodeURIComponent(vehicleId)}` : '';
  try {
    const res = await adminFetch(`/api/admin/platform/fleet/maintenance-events${q}`);
    if (res.ok) return res.json();
  } catch {
    /* offline */
  }
  return getLocalMaintenanceEvents(vehicleId);
}

export async function createMaintenanceEvent(body) {
  try {
    const res = await adminFetch('/api/admin/platform/fleet/maintenance-events', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    await parseError(res);
  } catch {
    /* offline fallback */
  }
  return createLocalMaintenanceEvent(body);
}

export async function uploadMaintenanceAttachment(eventId, file) {
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch(`${API_BASE}/api/admin/platform/fleet/maintenance-events/${eventId}/attachments`, {
      method: 'POST',
      headers: adminBearerHeaders(),
      body: form,
    });
    if (res.ok) return res.json();
    await parseError(res);
  } catch {
    /* offline fallback */
  }
  return addLocalAttachment(eventId, file);
}

export async function fetchFleetCostReport(vehicleId, dateFrom, dateTo) {
  const q = new URLSearchParams({
    vehicle_id: vehicleId,
    date_from: dateFrom,
    date_to: dateTo,
  }).toString();
  try {
    const res = await adminFetch(`/api/admin/platform/fleet/reports/costs?${q}`);
    if (res.ok) return res.json();
  } catch {
    /* offline */
  }
  return {
    vehicle_id: vehicleId,
    date_from: dateFrom,
    date_to: dateTo,
    maintenance_total: 0,
    fuel_total: 0,
    insurance_total: 0,
    total: 0,
    event_count: 0,
  };
}

export async function issueMasterQr({ tripId, driverId } = {}) {
  if (getSaasToken()) {
    try {
      return await issueSaasMasterQr({ tripId, driverId });
    } catch {
      /* admin hybrid endpoint below */
    }
  }
  const body = { trip_id: Number(tripId) };
  if (driverId) body.driver_id = driverId;
  const res = await adminFetch('/api/admin/platform/operations/master-qr', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

/** URL για λήψη Master QR ως PNG από backend (qrcode library). */
export function getMasterQrPngUrl(tripId, { driverId } = {}) {
  const params = new URLSearchParams();
  if (driverId) params.set('driver_id', driverId);
  if (typeof window !== 'undefined' && window.location?.origin) {
    params.set('frontend_base', window.location.origin);
  }
  const qs = params.toString();
  return `${API_BASE}/api/admin/platform/operations/master-qr/${tripId}/png${qs ? `?${qs}` : ''}`;
}

export async function notifyDriverShiftPush({ tripId, driverId, message, tripTitle } = {}) {
  const body = { trip_id: Number(tripId) };
  if (driverId) body.driver_id = driverId;
  if (message) body.message = message;
  if (tripTitle) body.trip_title = tripTitle;
  const res = await adminFetch('/api/admin/platform/operations/notify-driver-push', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

/** Driver ↔ office chat (admin) */
export async function fetchDriverChatThreads() {
  const res = await adminFetch('/api/admin/platform/driver-chat/threads');
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function fetchDriverChatUnread() {
  const res = await adminFetch('/api/admin/platform/driver-chat/unread');
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function fetchAdminDriverChatMessages(driverId, { after } = {}) {
  const q = after ? `?after=${encodeURIComponent(after)}` : '';
  const res = await adminFetch(
    `/api/admin/platform/driver-chat/${encodeURIComponent(driverId)}/messages${q}`,
  );
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function sendAdminDriverChatMessage(driverId, body, { tripId, senderName } = {}) {
  const payload = { body };
  if (tripId != null) payload.trip_id = Number(tripId);
  if (senderName) payload.sender_name = senderName;
  const res = await adminFetch(
    `/api/admin/platform/driver-chat/${encodeURIComponent(driverId)}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function markAdminDriverChatRead(driverId) {
  const res = await adminFetch(
    `/api/admin/platform/driver-chat/${encodeURIComponent(driverId)}/read`,
    { method: 'POST' },
  );
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function fetchFleetDepreciation(vehicleId) {
  const q = new URLSearchParams({ vehicle_id: vehicleId }).toString();
  try {
    const res = await adminFetch(`/api/admin/platform/fleet/reports/depreciation?${q}`);
    if (res.ok) return res.json();
  } catch {
    /* offline */
  }
  const v = getMockVehicles().find((x) => x.id === vehicleId);
  return {
    vehicle_id: vehicleId,
    as_of: new Date().toISOString().slice(0, 10),
    purchase_price: v?.purchase_price || 120000,
    age_years: 4,
    current_odometer: v?.current_odometer || 0,
    estimated_book_value: Math.round((v?.purchase_price || 120000) * 0.65),
    mileage_factor: 0.92,
  };
}

function getMockVehicles() {
  return mockFleet.map((bus) => {
    const kmToService = Number(bus.nextServiceKm || 0) - Number(bus.kilometers || 0);
    return {
      id: bus.id,
      make: bus.name.split(' ')[0] || 'Coach',
      model: bus.type || 'Coach',
      plate_number: bus.licensePlate,
      year: 2022,
      vin: `VIN-${bus.id}`,
      current_odometer: Number(bus.kilometers || 0),
      last_service_date: bus.lastService,
      last_service_mileage: Number(bus.kilometers || 0) - 5000,
      service_interval_km: 15000,
      service_interval_days: 365,
      next_service_threshold: Number(bus.nextServiceKm || 0),
      legal_deadline: bus.insuranceExpiry,
      insurance_due_date: bus.insuranceExpiry,
      purchase_price: 120000,
      fuel_cost_total: Number(bus.financials?.expenses || 0) * 0.35,
      insurance_cost_total: Number(bus.financials?.expenses || 0) * 0.15,
      service_status: kmToService <= 0 ? 'Urgent' : kmToService < 5000 ? 'Warning' : 'OK',
      km_to_service: kmToService,
      days_to_legal_deadline: null,
    };
  });
}

function readLocalMaintenanceEvents() {
  try {
    const raw = localStorage.getItem(MAINT_EVENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalMaintenanceEvents(events) {
  localStorage.setItem(MAINT_EVENTS_KEY, JSON.stringify(events));
}

function getLocalMaintenanceEvents(vehicleId) {
  const events = readLocalMaintenanceEvents();
  if (!vehicleId) return events;
  return events.filter((e) => e.vehicle_id === vehicleId);
}

function createLocalMaintenanceEvent(body) {
  const events = readLocalMaintenanceEvents();
  const now = new Date();
  const event = {
    id: `ME-LOCAL-${Date.now()}`,
    vehicle_id: body.vehicle_id,
    event_date: now.toISOString().slice(0, 10),
    mileage: Number(body.mileage || 0),
    service_type: body.service_type || 'έλεγχος',
    description: body.description || '',
    cost: Number(body.cost || 0),
    shop_or_mechanic: body.shop_or_mechanic || '',
    driver_id: body.driver_id || null,
    driver_name: body.driver_name || null,
    parts_replaced: Array.isArray(body.parts_replaced) ? body.parts_replaced : [],
    next_service_date: body.next_service_date || null,
    next_service_threshold: body.next_service_threshold ?? null,
    attachments: [],
    created_at: now.toISOString(),
  };
  events.unshift(event);
  saveLocalMaintenanceEvents(events);
  return event;
}

function addLocalAttachment(eventId, file) {
  const events = readLocalMaintenanceEvents();
  const idx = events.findIndex((e) => e.id === eventId);
  if (idx === -1) {
    return {
      id: `AT-LOCAL-${Date.now()}`,
      file_name: file?.name || 'attachment',
      mime_type: file?.type || 'application/octet-stream',
      size_bytes: Number(file?.size || 0),
      storage_path: 'local://unlinked',
      uploaded_at: new Date().toISOString(),
    };
  }
  const row = {
    id: `AT-LOCAL-${Date.now()}`,
    file_name: file?.name || 'attachment',
    mime_type: file?.type || 'application/octet-stream',
    size_bytes: Number(file?.size || 0),
    storage_path: `local://${eventId}/${file?.name || 'attachment'}`,
    uploaded_at: new Date().toISOString(),
  };
  const prev = Array.isArray(events[idx].attachments) ? events[idx].attachments : [];
  events[idx] = { ...events[idx], attachments: [...prev, row] };
  saveLocalMaintenanceEvents(events);
  return row;
}

function getMockDrivers() {
  return [
    {
      id: 'mock-d1',
      name: 'Νίκος Παπαδόπουλος',
      license_no: 'AB123456',
      phone: '+30 694 111 0001',
      email: 'nikos.driver@aerostride.com',
      hiring_date: '2022-03-15',
      status: 'active',
      vehicle_code: 'XAH-4021',
      license_plate: 'XAH-4021',
      salary_per_km: 0.45,
      salary_per_trip: 25,
      current_balance: 2340,
      safety_score: 94,
      trips_completed: 312,
      total_km: 145000,
      license_expires_at: '2027-06-30',
      avg_rating: 4.6,
      days_until_license_expiry: 400,
    },
    {
      id: 'mock-d2',
      name: 'Γιώργος Γεωργίου',
      license_no: 'AB234567',
      phone: '+30 694 222 0002',
      email: 'giorgos.driver@aerostride.com',
      hiring_date: '2021-08-01',
      status: 'active',
      vehicle_code: 'YZA-9901',
      license_plate: 'YZA-9901',
      safety_score: 88,
      trips_completed: 428,
      total_km: 280500,
      days_until_license_expiry: 120,
    },
  ];
}

function getMockUsers() {
  return [
    {
      id: 'mock-admin',
      email: 'admin@aerostride.com',
      name: 'Admin User',
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'mock-driver',
      email: 'driver@aerostride.com',
      name: 'Driver User',
      role: 'driver',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];
}
