import { API_BASE } from '../config/api.js';
import { customerAuthHeaders } from './customerAuthApi.js';
import { saasAuthHeaders } from './saasApi.js';

function parseError(data, status) {
  const detail = data?.detail;
  if (status === 401 || status === 403) {
    return 'Η συνεδρία έληξε ή λείπει σύνδεση γραφείου — συνδεθείτε ξανά.';
  }
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg || d).join(', ');
  return data?.message || 'Αποτυχία αιτήματος';
}

export async function fetchAllLostItems() {
  const res = await fetch(`${API_BASE}/api/lost-items`, {
    headers: saasAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data, res.status));
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
  let res;
  try {
    res = await fetch(`${API_BASE}/api/customer/lost-items`, {
      method: 'POST',
      headers: customerAuthHeaders(),
      body: JSON.stringify({
        item_category: body.itemCategory,
        description: body.description,
        last_seen_location: body.lastSeenLocation,
      }),
    });
  } catch {
    throw new Error('Δεν υπάρχει σύνδεση με τον server — δοκιμάστε ξανά σε λίγο.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Η συνεδρία έληξε — συνδεθείτε ξανά στο Wallet');
    }
    if (res.status === 404) {
      throw new Error('Η υπηρεσία Απωλεσθέντων δεν είναι διαθέσιμη ακόμα — δοκιμάστε μετά το update.');
    }
    throw new Error(parseError(data));
  }
  return data;
}

export async function updateLostItemStatus(itemId, status) {
  const res = await fetch(`${API_BASE}/api/lost-items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: saasAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data, res.status));
  return data;
}
