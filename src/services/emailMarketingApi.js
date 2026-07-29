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
  if (status === 403) return 'Δεν έχετε δικαίωμα';
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parseError(data, res.status));
  return data;
}

export const fetchCampaigns = () => request('/api/campaigns');
export const fetchCampaign = (id) => request(`/api/campaigns/${id}`);
export const createCampaign = (body) =>
  request('/api/campaigns', { method: 'POST', body: JSON.stringify(body) });
export const updateCampaign = (id, body) =>
  request(`/api/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteCampaign = (id) =>
  request(`/api/campaigns/${id}`, { method: 'DELETE' });
export const sendCampaign = (id, batchSize = 50) =>
  request(`/api/campaigns/${id}/send?batch_size=${batchSize}`, { method: 'POST' });

export const fetchProductsForTemplate = () => request('/api/campaigns/products-for-template');
export const fetchProductSnippet = (productId) =>
  request(`/api/campaigns/products-for-template/${productId}/snippet`);

export const fetchAutoResponders = (activeOnly = false) =>
  request(`/api/email/auto-responders?active_only=${activeOnly}`);
export const createAutoResponder = (body) =>
  request('/api/email/auto-responders', { method: 'POST', body: JSON.stringify(body) });
export const updateAutoResponder = (id, body) =>
  request(`/api/email/auto-responders/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteAutoResponder = (id) =>
  request(`/api/email/auto-responders/${id}`, { method: 'DELETE' });
export const testAutoResponder = (id, subject, body) =>
  request(`/api/email/auto-responders/${id}/test?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, {
    method: 'POST',
  });
export const pollImapInbox = () => request('/api/email/imap/poll', { method: 'POST' });

export const fetchEmailTemplates = () => request('/api/email/templates');

export const fetchCampaignSegments = () => request('/api/campaigns/segments');
export const fetchCampaignInventory = () => request('/api/campaigns/inventory');
export const fetchInventoryEmailBlock = (productId) =>
  request(`/api/campaigns/inventory/${productId}/email-block`);
export const fetchTrackingPixelInfo = () => request('/api/campaigns/tracking-pixel');
export const generateCampaignSubjects = (body) =>
  request('/api/campaigns/generate-subject', { method: 'POST', body: JSON.stringify(body) });

export const sendCampaignTest = (body) =>
  request('/api/campaigns/test-send', { method: 'POST', body: JSON.stringify(body) });
