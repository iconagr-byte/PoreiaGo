import { API_BASE } from '../config/api.js';
import { customerAuthHeaders } from './customerAuthApi.js';

function parseError(data) {
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || d).join(', ');
  return data?.message || 'Αποτυχία αιτήματος';
}

export async function fetchAllLostItems() {
  const res = await fetch(`${API_BASE}/api/lost-items`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data));
  return data.items || [];
}

export async function fetchMyLostItems() {
  const res = await fetch(`${API_BASE}/api/customer/lost-items`, {
    headers: customerAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data));
  return data.items || [];
}

export async function reportLostItem(body) {
  const res = await fetch(`${API_BASE}/api/customer/lost-items`, {
    method: 'POST',
    headers: customerAuthHeaders(),
    body: JSON.stringify({
      item_category: body.itemCategory,
      description: body.description,
      last_seen_location: body.lastSeenLocation,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data));
  return data;
}

export async function updateLostItemStatus(itemId, status) {
  const res = await fetch(`${API_BASE}/api/lost-items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data));
  return data;
}
