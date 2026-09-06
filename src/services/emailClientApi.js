import { adminAuthHeaders, adminFetch } from './adminApi.js';
import { handleAuthFailure, isAuthFailureStatus } from '../lib/authSession.js';
import { isSaasTokenExpired } from '../lib/saasJwt.js';
import { getSaasToken } from './saasApi.js';

function parseError(data, status) {
  const d = data?.detail;
  if (typeof d === 'string' && d.trim()) {
    if (/invalid token|expired|έληξε|μη έγκυρη/i.test(d) || status === 401) {
      return 'Η σύνδεση έληξε — συνδεθείτε ξανά στο γραφείο';
    }
    return d;
  }
  if (Array.isArray(d)) {
    const joined = d.map((x) => x.msg || x).filter(Boolean).join(', ');
    if (joined) return joined;
  }
  if (d && typeof d === 'object') {
    const nested = d.msg || d.message || d.error;
    if (typeof nested === 'string' && nested.trim()) return nested;
  }
  if (status === 401) return 'Η σύνδεση έληξε — συνδεθείτε ξανά στο γραφείο';
  if (status === 403) return 'Δεν έχετε δικαίωμα σε αυτό το email';
  if (status === 404) return 'Δεν βρέθηκε';
  if (status === 502 || status === 503 || status === 504) {
    return 'Ο server είναι προσωρινά εκτός (deploy). Περιμένετε λίγο και δοκιμάστε ξανά';
  }
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  return status ? `Αποτυχία αιτήματος (${status})` : 'Αποτυχία αιτήματος';
}

async function request(path, options = {}) {
  if (!getSaasToken() || isSaasTokenExpired()) {
    handleAuthFailure('Η σύνδεση έληξε — συνδεθείτε ξανά στο γραφείο');
    throw new Error('Η σύνδεση έληξε — συνδεθείτε ξανά στο γραφείο');
  }
  let res;
  try {
    res = await adminFetch(path, {
      ...options,
      retries: options.retries ?? 3,
      headers: {
        'Content-Type': 'application/json',
        ...adminAuthHeaders(),
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    throw new Error(
      err?.message || 'Ο server δεν απαντά. Περιμένετε λίγο και δοκιμάστε ξανά.',
    );
  }
  const data = await res.json().catch(() => ({}));
  if (isAuthFailureStatus(res.status)) {
    handleAuthFailure(parseError(data, res.status));
    throw new Error(parseError(data, res.status));
  }
  if (!res.ok) throw new Error(parseError(data, res.status));
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
  return request(`/api/mailbox/compose${q ? `?${q}` : ''}`, {
    method: 'POST',
    body: JSON.stringify(body),
    retries: 2,
  });
};
export const saveMailboxDraft = (body, accountId) => {
  const q = accountQuery(accountId);
  return request(`/api/mailbox/drafts${q ? `?${q}` : ''}`, { method: 'POST', body: JSON.stringify(body) });
};
export const syncMailbox = (accountId) => {
  const q = accountQuery(accountId);
  return request(`/api/mailbox/sync${q ? `?${q}` : ''}`, {
    method: 'POST',
    // IMAP can be slow — fewer retries, longer wait handled by nginx timeout.
    retries: 2,
  });
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
