import { API_BASE } from '../config/api.js';
import { saasFetch } from './saasApi.js';

export async function fetchBillingSubscription() {
  return saasFetch('/api/v1/billing/subscription');
}

/** Public SaaS signup — no JWT; redirects to Stripe Checkout. */
export async function createSignupCheckout({
  legalName,
  adminEmail,
  subdomain,
  password,
  plan = 'starter',
  billingInterval = 'month',
}) {
  const res = await fetch(`${API_BASE}/api/v1/billing/signup-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      legal_name: legalName,
      admin_email: adminEmail,
      subdomain,
      password,
      plan,
      billing_interval: billingInterval,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    let detail = err.detail ?? res.statusText ?? 'Signup checkout failed';
    if (Array.isArray(detail)) {
      detail = detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
    } else if (typeof detail === 'object') {
      detail = JSON.stringify(detail);
    }
    throw new Error(String(detail));
  }
  return res.json();
}

export async function createBillingCheckout(plan, billingInterval = 'month') {
  return saasFetch('/api/v1/billing/checkout-session', {
    method: 'POST',
    body: JSON.stringify({
      plan: plan || undefined,
      billing_interval: billingInterval,
    }),
  });
}

export async function createBillingPortal() {
  return saasFetch('/api/v1/billing/portal-session', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
