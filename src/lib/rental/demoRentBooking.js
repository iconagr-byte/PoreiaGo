/**
 * Soft native-rent demo booking — so Check-in UI is visible without a real JWT.
 */

import { DEMO_RENT_FLEET } from './demoRentFleet.js';
import { isNativeRentDemo, isSoftNativeRentDemoToken } from './nativeRentDemo.js';

export const DEMO_RENT_BOOKING_ID = 'demo-rent-booking-checkin-1';
/** Session-only — cold start always shows Check-in again in demo. */
const CHECKIN_KEY = 'poreiago_demo_rent_checkin_v1';

function daysFromNow(days, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function demoStore() {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    /* ignore */
  }
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* ignore */
  }
  return null;
}

export function readDemoRentCheckinReady() {
  try {
    return demoStore()?.getItem(CHECKIN_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeDemoRentCheckinReady(ready) {
  try {
    const store = demoStore();
    if (!store) return;
    if (ready) store.setItem(CHECKIN_KEY, '1');
    else store.removeItem(CHECKIN_KEY);
    // Drop sticky localStorage from older builds so Check-in does not stay hidden.
    try {
      localStorage.removeItem(CHECKIN_KEY);
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

/** Clear sticky check-in flag (local + session) so the CTA returns. */
export function resetDemoRentCheckinReady() {
  writeDemoRentCheckinReady(false);
  try {
    localStorage.removeItem(CHECKIN_KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(CHECKIN_KEY);
  } catch {
    /* ignore */
  }
}

/** One confirmed IconaRent-style booking for soft demo wallets. */
export function buildDemoRentBooking({ brandLabel = 'Γραφείο' } = {}) {
  const car = DEMO_RENT_FLEET[1] || DEMO_RENT_FLEET[0];
  const ready = readDemoRentCheckinReady();
  return {
    id: DEMO_RENT_BOOKING_ID,
    reference_code: 'RN-DEMO01',
    vehicle_id: car?.id || 'demo-rent-car',
    vehicle_model: car?.model || 'Peugeot 208',
    vehicle_plate: 'ΙΨΝ-2026',
    vehicle_category: car?.category || 'COMPACT',
    start_time: daysFromNow(1, 10),
    end_time: daysFromNow(4, 10),
    pickup_location: brandLabel || 'Γραφείο',
    dropoff_location: brandLabel || 'Γραφείο',
    total_cost: Number(car?.daily_rate_eur || 38) * 3,
    rental_status: 'CONFIRMED',
    driver_mode: 'SELF_DRIVE',
    payment_status: 'PAID',
    payment_method: 'card',
    amount_paid: Number(car?.daily_rate_eur || 38) * 3,
    balance_due: 0,
    online_checkin_ready: ready,
    online_checkin_at: ready ? new Date().toISOString() : null,
    channel: 'native_demo',
  };
}

/**
 * When native rent demo (soft token or session flag) has no API bookings,
 * inject the local pass so Check-in stays visible on Ενοικιάσεις.
 */
export function withDemoRentBookings(list, { brandLabel } = {}) {
  const rows = Array.isArray(list) ? list : [];
  if (rows.length) return rows;
  if (!isSoftNativeRentDemoToken() && !isNativeRentDemo()) return rows;
  // Older builds stuck localStorage=1 → CTA vanished after first check-in.
  try {
    if (localStorage.getItem(CHECKIN_KEY) === '1' && !sessionStorage.getItem(CHECKIN_KEY)) {
      localStorage.removeItem(CHECKIN_KEY);
    }
  } catch {
    /* ignore */
  }
  return [buildDemoRentBooking({ brandLabel })];
}
