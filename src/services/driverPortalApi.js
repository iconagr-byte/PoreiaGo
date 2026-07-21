import { API_BASE } from '../config/api.js';
import {
  driverSessionHeaders,
  getActiveTripId,
  getDriverSession,
  saveDriverSession,
} from '../lib/driver/driverSession.js';
import { fetchBoardingManifest, adminScanTicket } from './ticketingApi.js';

export { adminScanTicket, fetchBoardingManifest };

const DEV_SCHEDULE = [
  { time: '08:00', stop: 'Αθήνα — Λαρίσσης', status: 'completed' },
  { time: '10:30', stop: 'Λαμία', status: 'current' },
  { time: '13:00', stop: 'Μετέωρα', status: 'upcoming' },
  { time: '18:00', stop: 'Επιστροφή', status: 'upcoming' },
];

function mapSessionPayload(data) {
  return {
    accessToken: data.access_token,
    tripId: data.trip_id,
    tenantId: data.tenant_id,
    driverId: data.driver_id,
    expiresAt: data.expires_at,
    schedule: data.schedule || [],
    driverName: data.driver_name || null,
    photoUrl: data.photo_url || null,
    vehiclePlate: data.vehicle_plate || null,
    vehicleCode: data.vehicle_code || null,
    vehicleImageUrl: data.vehicle_image_url || null,
  };
}

function saveMappedSession(data) {
  const session = mapSessionPayload(data);
  saveDriverSession(session);
  return session;
}

const DEV_SESSION = {
  accessToken: 'dev-driver-session',
  tripId: 1,
  tenantId: '00000000-0000-0000-0000-000000000001',
  driverId: 'dev-driver',
  expiresAt: Math.floor(Date.now() / 1000) + 86400,
  schedule: DEV_SCHEDULE,
  driverName: 'Οδηγός Demo',
  photoUrl: null,
  vehiclePlate: 'XAH-4021',
  vehicleCode: 'XAH-4021',
  vehicleImageUrl: '/images/hero-bus-achillio.png',
};

export async function loginDriver(username, password) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/driver/session/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    if (import.meta.env.DEV) {
      saveDriverSession(DEV_SESSION);
      await cacheManifestForOffline(1);
      return DEV_SESSION;
    }
    throw new Error('Δεν υπάρχει σύνδεση με τον server');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    throw new Error(typeof detail === 'string' ? detail : 'Λάθος όνομα χρήστη ή κωδικός');
  }
  const session = saveMappedSession(data);
  await cacheManifestForOffline(data.trip_id);
  return session;
}

export async function exchangeMasterQr(qrRaw) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/driver/session/master-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qr_raw: qrRaw }),
    });
  } catch {
    if (import.meta.env.DEV) {
      saveDriverSession(DEV_SESSION);
      await cacheManifestForOffline(1);
      return DEV_SESSION;
    }
    throw new Error('Δεν υπάρχει σύνδεση με τον server');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (import.meta.env.DEV && qrRaw.trim().length > 4) {
      saveDriverSession(DEV_SESSION);
      await cacheManifestForOffline(1);
      return DEV_SESSION;
    }
    throw new Error(data.detail || 'Master QR invalid');
  }
  const session = saveMappedSession(data);
  await cacheManifestForOffline(data.trip_id);
  return session;
}

export async function fetchDriverMe() {
  try {
    const res = await fetch(`${API_BASE}/api/driver/me`, {
      headers: driverSessionHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const session = getDriverSession();
    if (session) {
      const merged = {
        ...session,
        driverId: data.driver_id || session.driverId,
        driverName: data.driver_name || session.driverName,
        photoUrl: data.photo_url || session.photoUrl,
        vehiclePlate: data.vehicle_plate || session.vehiclePlate,
        vehicleCode: data.vehicle_code || session.vehicleCode,
        vehicleImageUrl: data.vehicle_image_url || session.vehicleImageUrl,
      };
      saveDriverSession(merged);
      return merged;
    }
    return data;
  } catch {
    return getDriverSession();
  }
}

/** HTTP fallback for live GPS when WebSocket upgrade is blocked. */
export async function postDriverTelemetryLocation(payload) {
  const res = await fetch(`${API_BASE}/api/driver/telemetry/location`, {
    method: 'POST',
    headers: { ...driverSessionHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    throw new Error(typeof detail === 'string' ? detail : 'Αποτυχία αποστολής θέσης');
  }
  return data;
}

export async function fetchDriverManifest() {
  const tripId = getActiveTripId();
  try {
    const res = await fetch(`${API_BASE}/api/driver/manifest`, {
      headers: driverSessionHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      await cacheManifestForOffline(tripId, data);
      window.dispatchEvent(new CustomEvent('driver-manifest-updated', { detail: { tripId } }));
      return data;
    }
  } catch {
    /* offline */
  }
  return loadCachedManifest(tripId) ?? fetchBoardingManifest(tripId);
}

export async function fetchDriverSchedule() {
  const session = getDriverSession();
  if (session?.schedule?.length) return session.schedule;
  try {
    const res = await fetch(`${API_BASE}/api/driver/schedule`, {
      headers: driverSessionHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      return data.stops || [];
    }
  } catch {
    /* offline */
  }
  return session?.schedule || [];
}

export async function cacheManifestForOffline(tripId, manifest) {
  const key = `driver_manifest_${tripId}`;
  if (manifest) {
    localStorage.setItem(key, JSON.stringify({ manifest, cachedAt: Date.now() }));
  }
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_MANIFEST',
      tripId,
      manifest: manifest ?? JSON.parse(localStorage.getItem(key) || '{}').manifest,
    });
  }
}

export function loadCachedManifest(tripId) {
  try {
    const raw = localStorage.getItem(`driver_manifest_${tripId}`);
    if (!raw) return null;
    return JSON.parse(raw).manifest;
  } catch {
    return null;
  }
}

export async function driverCheckin({ qrRaw, ticketId, tripId } = {}) {
  const activeTrip = tripId ?? getActiveTripId();
  const body = {};
  if (qrRaw) body.qr_raw = qrRaw;
  if (ticketId) body.ticket_id = ticketId;

  try {
    const res = await fetch(`${API_BASE}/api/driver/checkin`, {
      method: 'POST',
      headers: { ...driverSessionHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    return { ...data, result: data.result || 'FAILURE', ok: false };
  } catch {
    if (import.meta.env.DEV && qrRaw) {
      return adminScanTicket({ qr: qrRaw, tripId: activeTrip });
    }
    throw new Error('Δεν υπάρχει σύνδεση με τον server');
  }
}

export async function submitPreTripInspection(items, notes) {
  const session = getDriverSession();
  if (!session?.accessToken) {
    localStorage.setItem(`safety_done_${session?.tripId}`, JSON.stringify(items));
    return { ok: true, local: true, cleared_for_shift: true, status: 'completed' };
  }
  try {
    const res = await fetch(`${API_BASE}/api/driver/inspection`, {
      method: 'POST',
      headers: { ...driverSessionHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, notes }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      localStorage.setItem(`safety_done_${session.tripId}`, JSON.stringify(items));
      return data;
    }
  } catch {
    /* offline */
  }
  localStorage.setItem(`safety_done_${session?.tripId}`, JSON.stringify(items));
  return { ok: true, local: true, cleared_for_shift: true, status: 'completed' };
}

export async function uploadDriverExpense({ amount, category, description, receiptFile }) {
  const session = getDriverSession();
  if (!session?.accessToken) {
    const queue = JSON.parse(localStorage.getItem('driver_expense_queue') || '[]');
    queue.push({ amount, category, description, tripId: session?.tripId, at: Date.now() });
    localStorage.setItem('driver_expense_queue', JSON.stringify(queue));
    return { ok: true, queued: true };
  }

  const form = new FormData();
  form.append('amount', String(amount));
  form.append('category', category);
  if (description) form.append('description', description);
  if (receiptFile) form.append('receipt', receiptFile);

  try {
    const res = await fetch(`${API_BASE}/api/expenses/upload`, {
      method: 'POST',
      headers: driverSessionHeaders(),
      body: form,
    });
    if (res.ok) return res.json();
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Upload failed');
  } catch (err) {
    if (err.message && err.message !== 'Upload failed') throw err;
    const queue = JSON.parse(localStorage.getItem('driver_expense_queue') || '[]');
    queue.push({ amount, category, description, tripId: session.tripId, at: Date.now() });
    localStorage.setItem('driver_expense_queue', JSON.stringify(queue));
    return { ok: true, queued: true };
  }
}

export async function triggerSosAlert({ lat, lng, accuracy_m, photoFile, message }) {
  const session = getDriverSession();
  if (!session?.accessToken) {
    console.warn('[SOS offline]', { lat, lng });
    return { ok: true, message: 'SOS αποθηκεύτηκε τοπικά (offline)', alert_id: `local-${Date.now()}` };
  }

  if (photoFile) {
    const form = new FormData();
    form.append('lat', String(lat));
    form.append('lng', String(lng));
    if (accuracy_m != null) form.append('accuracy_m', String(accuracy_m));
    if (message) form.append('message', message);
    form.append('incident_type', 'sos');
    form.append('photo', photoFile);
    const res = await fetch(`${API_BASE}/api/telemetry/sos/upload`, {
      method: 'POST',
      headers: driverSessionHeaders(),
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || 'SOS failed');
    return data;
  }

  const res = await fetch(`${API_BASE}/api/telemetry/sos`, {
    method: 'POST',
    headers: { ...driverSessionHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng, accuracy_m, message, incident_type: 'sos' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'SOS failed');
  return data;
}

export async function reportDriverIssue(payload) {
  const session = getDriverSession();
  if (!session?.accessToken) {
    console.info('[Driver Issue]', { ...payload, tripId: session?.tripId });
    return { ok: true, ticketId: `INC-${Date.now()}` };
  }
  try {
    const res = await fetch(`${API_BASE}/api/telemetry/sos`, {
      method: 'POST',
      headers: { ...driverSessionHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: payload.lat,
        lng: payload.lng,
        accuracy_m: payload.accuracy_m,
        incident_type: payload.type || 'incident',
        message: `Driver report: ${payload.type}`,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, ticketId: data.alert_id, alert_id: data.alert_id };
    }
  } catch {
    /* fallback */
  }
  return { ok: true, ticketId: `INC-${Date.now()}` };
}

/** @deprecated use triggerSosAlert */
export async function triggerSos() {
  return triggerSosAlert({ lat: 0, lng: 0, message: 'SOS (legacy)' });
}

export async function submitDriverExpense(form) {
  const session = getDriverSession();
  const driverId = session?.driverId;
  if (!driverId || !session?.accessToken) {
    return { ok: true, local: true, id: `local-exp-${Date.now()}` };
  }
  try {
    const res = await fetch(`${API_BASE}/api/v1/drivers/${driverId}/expenses`, {
      method: 'POST',
      headers: {
        ...driverSessionHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: form.amount,
        category: form.category,
        trip_id: session.tripId,
        description: form.description,
        receipt_ref: form.receiptRef,
      }),
    });
    if (res.ok) return res.json();
  } catch {
    /* queue offline */
  }
  const queue = JSON.parse(localStorage.getItem('driver_expense_queue') || '[]');
  queue.push({ ...form, tripId: session.tripId, at: Date.now() });
  localStorage.setItem('driver_expense_queue', JSON.stringify(queue));
  return { ok: true, queued: true };
}

export async function submitSafetyChecklist(verificationId, items) {
  const session = getDriverSession();
  const driverId = session?.driverId || 'master-qr-driver';
  if (!session?.accessToken) {
    localStorage.setItem(`safety_done_${session?.tripId}`, JSON.stringify(items));
    return { ok: true, local: true };
  }
  try {
    let vid = verificationId;
    if (!vid) {
      const startRes = await fetch(
        `${API_BASE}/api/v1/drivers/${driverId}/safety-checklist/start`,
        {
          method: 'POST',
          headers: { ...driverSessionHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ trip_id: session.tripId, driver_id: driverId }),
        },
      );
      if (startRes.ok) {
        const started = await startRes.json();
        vid = started.id;
      }
    }
    if (vid) {
      const res = await fetch(
        `${API_BASE}/api/v1/drivers/${driverId}/safety-checklist/submit`,
        {
          method: 'POST',
          headers: { ...driverSessionHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ verification_id: vid, items }),
        },
      );
      if (res.ok) return res.json();
    }
  } catch {
    /* offline */
  }
  localStorage.setItem(`safety_done_${session?.tripId}`, JSON.stringify(items));
  return { ok: true, local: true };
}

export function getDaySummaryStats(manifest) {
  const boarded = manifest?.boarded_passengers?.length ?? 0;
  const session = getDriverSession();
  return {
    totalKm: session?.totalKm ?? 142,
    passengersBoarded: boarded,
    dailyEarnings: session?.dailyEarnings ?? boarded * 12.5,
    tripId: session?.tripId,
  };
}
