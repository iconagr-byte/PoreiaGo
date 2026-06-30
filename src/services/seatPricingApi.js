import { API_BASE } from '../config/api.js';
import { adminFetch } from './adminApi.js';
import { DEFAULT_SEAT_PRICING } from '../lib/seats/seatPricing.js';

const STORAGE_KEY = 'aerostride_seat_pricing_v1';

function cache(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

function loadCached() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function parseError(res) {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.detail || res.statusText || 'Request failed');
}

export async function fetchPublicSeatPricing(layoutId) {
  try {
    const res = await fetch(
      `${API_BASE}/api/site/seat-pricing?layout_id=${encodeURIComponent(layoutId)}`,
    );
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    /* offline */
  }
  const cached = loadCached();
  return cached?.layouts?.[layoutId]
    ? { layout_id: layoutId, ...cached.layouts[layoutId] }
    : { layout_id: layoutId, ...DEFAULT_SEAT_PRICING.layouts[layoutId] };
}

export async function fetchAdminSeatPricing() {
  const res = await adminFetch('/api/admin/platform/seat-pricing');
  if (!res.ok) await parseError(res);
  const data = await res.json();
  cache(data);
  return { ...DEFAULT_SEAT_PRICING, ...data };
}

export async function updateSeatPricing(layoutsPatch) {
  const res = await adminFetch('/api/admin/platform/seat-pricing', {
    method: 'PATCH',
    body: JSON.stringify({ layouts: layoutsPatch }),
  });
  if (!res.ok) await parseError(res);
  const data = await res.json();
  cache(data);
  return data;
}
