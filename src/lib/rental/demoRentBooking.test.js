import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEMO_RENT_BOOKING_ID,
  buildDemoRentBooking,
  withDemoRentBookings,
  writeDemoRentCheckinReady,
} from './demoRentBooking.js';
import { isNativeRentDemo, isSoftNativeRentDemoToken } from './nativeRentDemo.js';

vi.mock('./nativeRentDemo.js', () => ({
  isSoftNativeRentDemoToken: vi.fn(() => true),
  isNativeRentDemo: vi.fn(() => false),
}));

describe('demoRentBooking', () => {
  beforeEach(() => {
    writeDemoRentCheckinReady(false);
    isSoftNativeRentDemoToken.mockReturnValue(true);
    isNativeRentDemo.mockReturnValue(false);
  });

  it('builds a confirmed booking with check-in available', () => {
    const row = buildDemoRentBooking({ brandLabel: 'IWONA RENT' });
    expect(row.id).toBe(DEMO_RENT_BOOKING_ID);
    expect(row.rental_status).toBe('CONFIRMED');
    expect(row.online_checkin_ready).toBe(false);
    expect(row.pickup_location).toBe('IWONA RENT');
  });

  it('injects demo booking when soft list is empty', () => {
    const rows = withDemoRentBookings([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(DEMO_RENT_BOOKING_ID);
  });

  it('injects demo booking when native rent demo session is on', () => {
    isSoftNativeRentDemoToken.mockReturnValue(false);
    isNativeRentDemo.mockReturnValue(true);
    const rows = withDemoRentBookings([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(DEMO_RENT_BOOKING_ID);
  });

  it('keeps real bookings untouched', () => {
    const real = [{ id: 'real-1', rental_status: 'ACTIVE' }];
    expect(withDemoRentBookings(real)).toEqual(real);
  });

  it('keeps confirmed check-in from localStorage across reloads', () => {
    const mem = new Map([['poreiago_demo_rent_checkin_v1', '1']]);
    const stub = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    };
    vi.stubGlobal('localStorage', stub);
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
    const rows = withDemoRentBookings([]);
    expect(rows[0].online_checkin_ready).toBe(true);
    expect(rows[0].rental_status).toBe('ACTIVE');
    vi.unstubAllGlobals();
  });
});
