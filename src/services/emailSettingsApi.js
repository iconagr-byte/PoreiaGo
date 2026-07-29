import { API_BASE } from '../config/api.js';
import { adminAuthHeaders } from './adminApi.js';

function parseError(data, status) {
  const d = data?.detail;
  if (typeof d === 'string' && d.trim()) return d;
  if (Array.isArray(d)) {
    const joined = d.map((x) => x.msg || x).filter(Boolean).join(', ');
    if (joined) return joined;
  }
  if (status === 401) return 'Απαιτείται σύνδεση διαχείρισης — κάντε login ξανά';
  if (status === 403) return 'Δεν έχετε δικαίωμα στις ρυθμίσεις email';
  if (status === 502 || status === 503 || status === 504) {
    return 'Ο server είναι προσωρινά εκτός (deploy). Περιμένετε λίγο και δοκιμάστε ξανά';
  }
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  return status ? `Αποτυχία αιτήματος (${status})` : 'Αποτυχία αιτήματος';
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...adminAuthHeaders(),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error('Ο server δεν απαντά. Τρέξτε: npm run dev:backend');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data, res.status));
  return data;
}

export const fetchEmailSettings = () => request('/api/email/settings');
export const fetchEmailSetting = (id) => request(`/api/email/settings/${id}`);
export const createEmailSettings = (body) =>
  request('/api/email/settings', { method: 'POST', body: JSON.stringify(body) });
export const updateEmailSettings = (id, body) =>
  request(`/api/email/settings/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteEmailSettings = (id) =>
  request(`/api/email/settings/${id}`, { method: 'DELETE' });
export const testEmailConnection = (body) =>
  request('/api/email/settings/test-connection', { method: 'POST', body: JSON.stringify(body) });
export const testSavedEmailConnection = (id) =>
  request(`/api/email/settings/${id}/test-connection`, { method: 'POST' });
