import { describe, it, expect } from 'vitest';
import { bookingsToNotifItems } from './useWalletNotifications.js';

describe('wallet notifications from bookings', () => {
  it('creates a fiscal inbox row when MARK exists', () => {
    const items = bookingsToNotifItems([
      {
        id: 'b1',
        tripTitle: 'Σαντορίνη',
        date: '2099-06-01',
        time: '09:00',
        fiscal_mark: 'MARK123',
        status: 'confirmed',
      },
    ]);
    const fiscal = items.find((i) => i.id.startsWith('fiscal-b1-'));
    expect(fiscal).toBeTruthy();
    expect(fiscal.type).toBe('fiscal_receipt_issued');
    expect(fiscal.body).toContain('MARK123');
  });

  it('returns empty for no bookings', () => {
    expect(bookingsToNotifItems([])).toEqual([]);
  });
});
