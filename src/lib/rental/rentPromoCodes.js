/**
 * Rent promo / coupon codes — client validation + discount on booking totals.
 * Platform demo codes work for marketing preview; tenant codes can be merged later.
 */

export const PLATFORM_DEMO_PROMO_CODES = [
  { code: 'RENT10', type: 'percent', value: 10, label: '10% έκπτωση' },
  { code: 'WELCOME20', type: 'fixed', value: 20, label: '20€ έκπτωση' },
  { code: 'POREIA15', type: 'percent', value: 15, label: '15% έκπτωση' },
  { code: 'SUMMER25', type: 'percent', value: 25, label: '25% καλοκαιρινή προσφορά' },
];

/**
 * @param {string} raw
 * @param {Array<{ code: string, type: string, value: number, label?: string }>} [tenantCodes]
 */
export function resolveRentPromoCode(raw, tenantCodes = []) {
  const key = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!key) return { ok: false, reason: 'empty', code: '' };

  const catalog = [...PLATFORM_DEMO_PROMO_CODES, ...(Array.isArray(tenantCodes) ? tenantCodes : [])];
  const hit = catalog.find((c) => String(c.code || '').trim().toUpperCase() === key);
  if (!hit) return { ok: false, reason: 'invalid', code: key };

  return {
    ok: true,
    code: key,
    promo: {
      code: key,
      type: hit.type === 'fixed' ? 'fixed' : 'percent',
      value: Number(hit.value) || 0,
      label: hit.label || key,
    },
  };
}

/**
 * Apply promo to estimateBookingTotals output.
 * @param {{ vehicle?: number, extras?: number, total?: number, days?: number }} totals
 * @param {{ type: string, value: number, code?: string, label?: string } | null | undefined} promo
 */
export function applyRentPromo(totals, promo) {
  const vehicle = Math.max(0, Number(totals?.vehicle) || 0);
  const extras = Math.max(0, Number(totals?.extras) || 0);
  const subtotal = Math.max(0, Number(totals?.total) || vehicle + extras);
  const base = {
    ...totals,
    vehicle,
    extras,
    subtotal,
    totalBefore: subtotal,
    discount: 0,
    discountLabel: '',
    promoCode: '',
    total: subtotal,
  };

  if (!promo || !(Number(promo.value) > 0)) return base;

  let discount = 0;
  if (promo.type === 'fixed') {
    discount = Math.min(subtotal, Number(promo.value) || 0);
  } else {
    discount = Math.min(subtotal, (subtotal * (Number(promo.value) || 0)) / 100);
  }
  discount = Math.round(discount * 100) / 100;
  const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

  return {
    ...base,
    discount,
    discountLabel: promo.label || (promo.code ? `Κουπόνι ${promo.code}` : 'Έκπτωση'),
    promoCode: promo.code || '',
    total,
  };
}

/** Resolve + apply in one step from a raw code string. */
export function priceRentTotalsWithPromo(totals, rawCode, tenantCodes = []) {
  const resolved = resolveRentPromoCode(rawCode, tenantCodes);
  if (!resolved.ok) {
    return {
      priced: applyRentPromo(totals, null),
      resolved,
    };
  }
  return {
    priced: applyRentPromo(totals, resolved.promo),
    resolved,
  };
}
