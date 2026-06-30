import { API_BASE } from '../config/api.js';
import { getCustomerToken, setCustomerToken } from '../lib/auth.js';

function parseError(data) {
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || d).join(', ');
  return data?.message || 'Αποτυχία αιτήματος';
}

export function customerAuthHeaders() {
  const token = getCustomerToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function postJson(path, body, auth = false) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: auth ? customerAuthHeaders() : { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      'Ο server δεν απαντά (port 8000). Ξεκινήστε το backend: cd backend && py -3 -m uvicorn main:app --reload --port 8000',
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 502 || res.status === 504) {
      throw new Error('Ο server δεν είναι διαθέσιμος. Ξεκινήστε το backend στο port 8000.');
    }
    throw new Error(parseError(data));
  }
  return data;
}

export function persistCustomerSession(profile) {
  if (profile.access_token) {
    setCustomerToken(profile.access_token);
  }
  return profile;
}

export async function registerCustomer({ email, password, name }) {
  const data = await postJson('/api/auth/register', { email, password, name });
  return persistCustomerSession(data);
}

export async function loginCustomer({ email, password }) {
  const data = await postJson('/api/auth/login', { email, password });
  return persistCustomerSession(data);
}

export async function fetchCustomerMe() {
  const res = await fetch(`${API_BASE}/api/auth/me`, { headers: customerAuthHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data));
  return data;
}

export async function changeCustomerPasswordApi({ currentPassword, newPassword }) {
  return postJson(
    '/api/auth/change-password',
    { current_password: currentPassword, new_password: newPassword },
    true,
  );
}

export async function forgotCustomerPassword(email) {
  return postJson('/api/auth/forgot-password', { email });
}

export async function resetCustomerPassword({ token, newPassword }) {
  const data = await postJson('/api/auth/reset-password', {
    token,
    new_password: newPassword,
  });
  return persistCustomerSession(data);
}

/**
 * @param {string} idToken — Google credential JWT
 */
export async function verifyGoogleLogin(idToken) {
  const data = await postJson('/api/auth/google', { id_token: idToken });
  return persistCustomerSession(data);
}

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export function isGoogleAuthConfigured() {
  return Boolean(GOOGLE_CLIENT_ID);
}

export async function isCustomerAuthBackendAvailable() {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}
