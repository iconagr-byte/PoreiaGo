import { API_BASE } from '../config/api.js';
import { adminFetch } from './adminApi.js';

const RESUME_TOKEN_KEY = 'aerostride_resume_token';
const LOCAL_CARTS_KEY = 'aerostride_abandoned_carts_local';

async function readJsonResponse(res) {
  const text = await res.text();
  if (text.trimStart().startsWith('<')) {
    throw new Error(
      'Ο server επέστρεψε HTML αντί για JSON — βεβαιωθείτε ότι τρέχει το backend (:8000) και το Vite proxy για /api/abandoned.',
    );
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Μη έγκυρη απάντηση από τον server.');
  }
}

function saveLocalCart(cart) {
  try {
    const raw = localStorage.getItem(LOCAL_CARTS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[cart.resume_token] = cart;
    localStorage.setItem(LOCAL_CARTS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function loadLocalCart(resumeToken) {
  try {
    const raw = localStorage.getItem(LOCAL_CARTS_KEY);
    const map = raw ? JSON.parse(raw) : {};
    return map[resumeToken] || null;
  } catch {
    return null;
  }
}

export function getStoredResumeToken() {
  return sessionStorage.getItem(RESUME_TOKEN_KEY) || localStorage.getItem(RESUME_TOKEN_KEY);
}

export function storeResumeToken(token) {
  if (!token) return;
  sessionStorage.setItem(RESUME_TOKEN_KEY, token);
  localStorage.setItem(RESUME_TOKEN_KEY, token);
}

export function clearResumeToken() {
  sessionStorage.removeItem(RESUME_TOKEN_KEY);
  localStorage.removeItem(RESUME_TOKEN_KEY);
}

export async function upsertAbandonedCart(payload) {
  try {
    const res = await fetch(`${API_BASE}/api/abandoned/carts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resume_token: payload.resumeToken || getStoredResumeToken(),
        trip_id: payload.tripId,
        trip_title: payload.tripTitle,
        seats: payload.seats || '',
        amount_eur: payload.amountEur,
        passenger_name: payload.passengerName || '',
        passenger_email: payload.passengerEmail || '',
        passenger_phone: payload.passengerPhone || '',
      }),
    });
    if (!res.ok) return null;
    const data = await readJsonResponse(res);
    if (data.resume_token) {
      storeResumeToken(data.resume_token);
      saveLocalCart(data);
    }
    return data;
  } catch {
    return null;
  }
}

export async function fetchResumeCart(resumeToken) {
  try {
    const res = await fetch(
      `${API_BASE}/api/abandoned/resume/${encodeURIComponent(resumeToken)}`,
    );
    if (!res.ok) {
      const err = await readJsonResponse(res).catch(() => ({}));
      throw new Error(err.detail || 'Η κράτηση δεν βρέθηκε.');
    }
    const data = await readJsonResponse(res);
    saveLocalCart(data);
    return data;
  } catch (e) {
    const local = loadLocalCart(resumeToken);
    if (local && !local.completed_at) {
      return local;
    }
    throw e;
  }
}

export async function completeAbandonedCart(resumeToken) {
  try {
    await fetch(`${API_BASE}/api/abandoned/resume/${encodeURIComponent(resumeToken)}/complete`, {
      method: 'POST',
    });
  } catch {
    /* ignore */
  }
  clearResumeToken();
}

export async function fetchAbandonedCarts(includeCompleted = false) {
  const q = includeCompleted ? '?include_completed=true' : '';
  const res = await adminFetch(`/api/admin/platform/abandoned/carts${q}`);
  if (!res.ok) return [];
  return res.json();
}

export async function runAbandonedRecoveryScan({ baseUrl, pendingMinutes } = {}) {
  const res = await adminFetch('/api/admin/platform/abandoned/scan', {
    method: 'POST',
    body: JSON.stringify({
      base_url: baseUrl || window.location.origin,
      pending_minutes: pendingMinutes ?? undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Scan failed');
  }
  return res.json();
}
