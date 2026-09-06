/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { normalizePaymentSettings } from './paymentSettings.js';

describe('normalizePaymentSettings', () => {
  it('keeps deposit.enabled=false after save/load round-trip', () => {
    const next = normalizePaymentSettings({
      deposit: { enabled: false, percent: 30 },
      methods: {
        card: { enabled: true, label: 'Κάρτα' },
        cash_office: { enabled: false, label: 'Μετρητά' },
      },
      bank_accounts: [
        {
          id: 'b1',
          bank_name: 'Eurobank',
          beneficiary: 'Office',
          iban: 'GR1601101250000000012300695',
          enabled: true,
          is_default: true,
        },
      ],
    });
    expect(next.deposit.enabled).toBe(false);
    expect(next.deposit.percent).toBe(30);
    expect(next.methods.cash_office.enabled).toBe(false);
    expect(next.methods.card.enabled).toBe(true);
  });

  it('defaults deposit enabled when field omitted', () => {
    const next = normalizePaymentSettings({ deposit: { percent: 40 } });
    expect(next.deposit.enabled).toBe(true);
    expect(next.deposit.percent).toBe(40);
  });
});
