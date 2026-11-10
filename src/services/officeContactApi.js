import { API_BASE, getApiBase } from '../config/api.js';

function apiBase() {
  try {
    return getApiBase() || API_BASE || '';
  } catch {
    return API_BASE || '';
  }
}

/**
 * Submit guest contact form to the current office Host mailbox.
 * @param {{ name: string, email: string, phone?: string, subject?: string, message: string }} payload
 */
export async function submitOfficeContact(payload) {
  const host =
    typeof window !== 'undefined'
      ? window.location.host || window.location.hostname || ''
      : '';
  const params = new URLSearchParams();
  if (host) params.set('host', host);
  const qs = params.toString() ? `?${params}` : '';
  const res = await fetch(`${apiBase()}/api/site/contact${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      name: String(payload.name || '').trim(),
      email: String(payload.email || '').trim(),
      phone: String(payload.phone || '').trim(),
      subject: String(payload.subject || '').trim(),
      message: String(payload.message || '').trim(),
      host,
      website: String(payload.website || ''),
    }),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const detail =
      (data && (data.detail || data.message)) ||
      'Αποτυχία αποστολής. Δοκιμάστε ξανά.';
    throw new Error(typeof detail === 'string' ? detail : 'Αποτυχία αποστολής.');
  }
  return data || { ok: true };
}
