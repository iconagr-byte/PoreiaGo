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

function accountQuery(accountId) {
  return accountId ? `email_settings_id=${encodeURIComponent(accountId)}` : '';
}

export const fetchMailboxFolders = (accountId) => {
  const q = accountQuery(accountId);
  return request(`/api/mailbox/folders${q ? `?${q}` : ''}`);
};
export const fetchMailboxMessages = (folder, { accountId, limit = 50, offset = 0, search } = {}) => {
  const q = new URLSearchParams({ folder, limit: String(limit), offset: String(offset) });
  if (accountId) q.set('email_settings_id', accountId);
  if (search) q.set('search', search);
  return request(`/api/mailbox/messages?${q}`);
};
export const fetchMailboxMessage = (id) => request(`/api/mailbox/messages/${id}`);
export const patchMailboxMessage = (id, body) =>
  request(`/api/mailbox/messages/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteMailboxMessage = (id) =>
  request(`/api/mailbox/messages/${id}`, { method: 'DELETE' });
export const replyMailboxMessage = (id, body) =>
  request(`/api/mailbox/messages/${id}/reply`, { method: 'POST', body: JSON.stringify(body) });
export const forwardMailboxMessage = (id, body) =>
  request(`/api/mailbox/messages/${id}/forward`, { method: 'POST', body: JSON.stringify(body) });
export const fetchMessageCustomer = (id) => request(`/api/mailbox/messages/${id}/customer`);
export const composeEmail = (body, accountId) => {
  const q = accountQuery(accountId);
  return request(`/api/mailbox/compose${q ? `?${q}` : ''}`, { method: 'POST', body: JSON.stringify(body) });
};
export const saveMailboxDraft = (body, accountId) => {
  const q = accountQuery(accountId);
  return request(`/api/mailbox/drafts${q ? `?${q}` : ''}`, { method: 'POST', body: JSON.stringify(body) });
};
export const syncMailbox = (accountId) => {
  const q = accountQuery(accountId);
  return request(`/api/mailbox/sync${q ? `?${q}` : ''}`, { method: 'POST' });
};
export const fetchSubscribers = (subscribedOnly = true) =>
  request(`/api/mailbox/subscribers?subscribed_only=${subscribedOnly}`);

export const sendCampaignTracked = (campaignId, opts = {}) =>
  request('/api/campaigns/send', {
    method: 'POST',
    body: JSON.stringify({
      campaign_id: campaignId,
      batch_size: opts.batchSize ?? 50,
      audience: opts.audience ?? null,
      subscriber_list: opts.subscriberList ?? 'subscribed_only',
      email_settings_id: opts.emailSettingsId ?? null,
    }),
  });
export const fetchCampaignMetrics = (id) => request(`/api/campaigns/${id}/metrics`);
