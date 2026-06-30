import { API_BASE } from '../config/api.js';

function parseError(data) {
  const d = data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || x).join(', ');
  return data?.message || 'Αποτυχία αιτήματος';
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
  } catch {
    throw new Error('Ο server δεν απαντά. Τρέξτε: npm run dev:backend');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data));
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
