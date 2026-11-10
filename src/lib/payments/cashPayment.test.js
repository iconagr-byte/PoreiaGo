import { describe, expect, test } from 'vitest';
import { parseCashAmount } from '../../components/admin/RecordCashPaymentModal.jsx';
import { validateCashPayment, DEFAULT_PAYMENT_SECURITY } from '../payments/paymentSecurity.js';

describe('parseCashAmount', () => {
  test('parses Greek comma decimals', () => {
    expect(parseCashAmount('64,6')).toBeCloseTo(64.6);
    expect(parseCashAmount('64.60')).toBeCloseTo(64.6);
    expect(parseCashAmount(64.6)).toBeCloseTo(64.6);
  });
});

describe('validateCashPayment channels', () => {
  const booking = {
    id: 'B-1',
    pnr: 'BKHYDK37BA',
    price: 64.6,
    amountPaid: 0,
    balanceDue: 64.6,
    status: 'Επιβεβαιωμένη',
  };

  test('accepts office_counter and driver_on_bus', () => {
    expect(
      validateCashPayment(
        booking,
        { amount: 64.6, channel: 'office_counter', reference: 'BKHYDK37BA' },
        DEFAULT_PAYMENT_SECURITY,
      ),
    ).toEqual([]);
    expect(
      validateCashPayment(
        booking,
        { amount: 64.6, channel: 'driver_on_bus', reference: 'BKHYDK37BA' },
        DEFAULT_PAYMENT_SECURITY,
      ),
    ).toEqual([]);
  });
});
