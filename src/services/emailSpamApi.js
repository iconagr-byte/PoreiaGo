import { API_BASE } from '../config/api.js';
import { spamBlockMessage } from '../lib/payments/paymentSecurity.js';

export async function checkEmailSpamFilter(email) {
  const q = encodeURIComponent(String(email || '').trim());
  if (!q) return { allowed: false, reason: 'invalid_email_format' };
  try {
    const res = await fetch(`${API_BASE}/api/site/email-spam-check?email=${q}`);
    if (res.ok) return res.json();
  } catch {
    /* offline — allow checkout, server blocks send */
  }
  return { allowed: true, reason: '' };
}

export async function validateCheckoutEmail(email) {
  const result = await checkEmailSpamFilter(email);
  if (!result.allowed) {
    throw new Error(spamBlockMessage(result.reason));
  }
  return true;
}
