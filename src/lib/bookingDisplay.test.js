import { describe, expect, test } from 'vitest';
import {
  hasDepositBalance,
  isDepositBooking,
  isPendingBankTransfer,
  parsePaymentMethod,
} from './bookingDisplay.js';

describe('deposit vs pending bank display', () => {
  test('full unpaid bank transfer is pending bank, not deposit', () => {
    const booking = {
      price: 32.3,
      amountPaid: 0,
      balanceDue: 32.3,
      paymentPlan: 'full',
      paymentStatus: 'PENDING (Bank Transfer)',
      paymentMethod: 'Τραπεζική μεταφορά',
      balanceDueMethod: 'bank_transfer',
    };
    expect(isDepositBooking(booking)).toBe(false);
    expect(hasDepositBalance(booking)).toBe(false);
    expect(isPendingBankTransfer(booking)).toBe(true);
    expect(parsePaymentMethod(booking).label).toBe('Εκκρεμής τραπεζική μεταφορά');
    expect(parsePaymentMethod(booking).icon).toBe('hourglass_empty');
  });

  test('real deposit with bus balance still counts as deposit', () => {
    const booking = {
      price: 100,
      amountPaid: 30,
      balanceDue: 70,
      paymentPlan: 'deposit',
      depositPercent: 30,
      paymentStatus: 'DEPOSIT 30% (Credit Card)',
      paymentMethod: 'Προκαταβολή 30% · Πιστωτική Κάρτα',
      balanceDueMethod: 'cash_on_bus',
    };
    expect(isDepositBooking(booking)).toBe(true);
    expect(hasDepositBalance(booking)).toBe(true);
    expect(isPendingBankTransfer(booking)).toBe(false);
  });

  test('cash on bus unpaid without deposit is not a deposit', () => {
    const booking = {
      price: 32.3,
      amountPaid: 0,
      balanceDue: 32.3,
      paymentPlan: 'full',
      paymentStatus: 'PENDING (Μετρητά στο λεωφορείο)',
      paymentMethod: 'Μετρητά στο λεωφορείο',
      balanceDueMethod: 'cash_on_bus',
    };
    expect(isDepositBooking(booking)).toBe(false);
    expect(hasDepositBalance(booking)).toBe(false);
    expect(isPendingBankTransfer(booking)).toBe(false);
  });
});
