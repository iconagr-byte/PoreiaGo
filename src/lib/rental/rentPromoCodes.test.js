/**
 * Smoke tests for rent promo / coupon helpers.
 */
import assert from 'node:assert/strict';
import {
  PLATFORM_DEMO_PROMO_CODES,
  applyRentPromo,
  priceRentTotalsWithPromo,
  resolveRentPromoCode,
} from './rentPromoCodes.js';

assert.ok(PLATFORM_DEMO_PROMO_CODES.length >= 3);

assert.equal(resolveRentPromoCode('').ok, false);
assert.equal(resolveRentPromoCode('NOPE').ok, false);
assert.equal(resolveRentPromoCode('rent10').ok, true);
assert.equal(resolveRentPromoCode(' rent10 ').promo.value, 10);

const base = { vehicle: 100, extras: 20, total: 120, days: 3 };
const pct = applyRentPromo(base, { type: 'percent', value: 10, code: 'RENT10', label: '10%' });
assert.equal(pct.discount, 12);
assert.equal(pct.total, 108);
assert.equal(pct.totalBefore, 120);

const fixed = applyRentPromo(base, { type: 'fixed', value: 20, code: 'WELCOME20' });
assert.equal(fixed.discount, 20);
assert.equal(fixed.total, 100);

const capped = applyRentPromo({ total: 15 }, { type: 'fixed', value: 50 });
assert.equal(capped.discount, 15);
assert.equal(capped.total, 0);

const priced = priceRentTotalsWithPromo(base, 'POREIA15');
assert.equal(priced.resolved.ok, true);
assert.equal(priced.priced.discount, 18);
assert.equal(priced.priced.total, 102);

console.log('rentPromoCodes: OK');
