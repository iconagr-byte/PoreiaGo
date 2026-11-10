import { API_BASE } from '../config/api.js';

async function publicFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}/api/site/rent-sign${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.detail;
    throw new Error(
      typeof detail === 'string' ? detail : data?.message || `Σφάλμα υπογραφής (${res.status})`,
    );
  }
  return data;
}

export async function fetchRentSignSession(token) {
  return publicFetch(`/${encodeURIComponent(token)}`);
}

export async function submitRentSign(token, body) {
  return publicFetch(`/${encodeURIComponent(token)}/submit`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
