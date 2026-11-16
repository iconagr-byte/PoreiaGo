import { describe, expect, test } from 'vitest';
import {
  isRentBookingExpired,
  rentBookingExpiryMs,
  rentBookingStatusLabel,
  sortRentWalletBookings,
} from './rentBookingExpiry.js';

function booking(overrides = {}) {
  return {
    id: 'r1',
    rental_status: 'CONFIRMED',
    start_time: '2026-11-10T10:00:00.000Z',
    end_time: '2026-11-14T10:00:00.000Z',
    ...overrides,
  };
}

describe('rentBookingExpiry', () => {
  test('isRentBookingExpired uses end_time + grace hours', () => {
    const b = booking();
    const end = Date.parse(b.end_time);
    expect(isRentBookingExpired(b, new Date(end + 1 * 3600_000))).toBe(false);
    expect(isRentBookingExpired(b, new Date(end + 3 * 3600_000))).toBe(true);
  });

  test('COMPLETED counts as expired; CANCELLED does not', () => {
    const now = new Date('2026-11-12T12:00:00.000Z');
    expect(isRentBookingExpired(booking({ rental_status: 'COMPLETED' }), now)).toBe(true);
    expect(isRentBookingExpired(booking({ rental_status: 'CANCELLED' }), now)).toBe(false);
  });

  test('missing end_time stays active', () => {
    expect(isRentBookingExpired(booking({ end_time: null }), new Date())).toBe(false);
    expect(rentBookingExpiryMs(booking({ end_time: '' }))).toBeNull();
  });

  test('rentBookingStatusLabel shows Ληγμένη when past return', () => {
    const b = booking();
    const after = new Date(Date.parse(b.end_time) + 5 * 3600_000);
    expect(rentBookingStatusLabel(b, after)).toBe('Ληγμένη');
    expect(rentBookingStatusLabel(b, new Date(Date.parse(b.start_time)))).toBe('Επιβεβαιωμένη');
  });

  test('sortRentWalletBookings puts active ahead of expired', () => {
    const now = new Date('2026-11-16T12:00:00.000Z');
    const active = booking({
      id: 'a',
      start_time: '2026-11-20T10:00:00.000Z',
      end_time: '2026-11-22T10:00:00.000Z',
    });
    const expired = booking({
      id: 'e',
      start_time: '2026-11-01T10:00:00.000Z',
      end_time: '2026-11-03T10:00:00.000Z',
    });
    const cancelled = booking({
      id: 'c',
      rental_status: 'CANCELLED',
      start_time: '2026-11-18T10:00:00.000Z',
      end_time: '2026-11-19T10:00:00.000Z',
    });
    const sorted = sortRentWalletBookings([cancelled, expired, active], now);
    expect(sorted.map((b) => b.id)).toEqual(['a', 'e', 'c']);
  });
});
