import { API_BASE } from '../config/api.js';

/**
 * Public newsletter subscribe (storefront / rent CTA).
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
    headers: { 'Content-Type': 'application/json' },
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
