import { API_BASE } from '../config/api.js';

function officeHostHeader() {
  if (typeof window === 'undefined') return {};
  const host = String(window.location.hostname || '')
    .toLowerCase()
    .split(':')[0]
    .trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') return {};
  return { 'X-Office-Host': host };
}

/**
 * Public newsletter subscribe (storefront / rent CTA).
 * Binds to the current office Host so IconaRent subscribers stay on that desk.
 * @param {{ email: string, preferredCity?: string, consent: boolean, source?: 'trips'|'rent' }} payload
 */
export async function subscribeNewsletter({
  email,
  preferredCity = '',
  consent = false,
  source = 'trips',
} = {}) {
  const res = await fetch(`${API_BASE}/api/newsletter/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...officeHostHeader() },
    body: JSON.stringify({
      email: String(email || '').trim(),
      preferred_city: String(preferredCity || '').trim(),
      consent: Boolean(consent),
      source: source === 'rent' ? 'rent' : 'trips',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.detail;
    const msg =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((x) => x.msg || x).filter(Boolean).join(', ')
          : data?.message || 'Αποτυχία εγγραφής';
    throw new Error(msg || 'Αποτυχία εγγραφής');
  }
  return data;
}
