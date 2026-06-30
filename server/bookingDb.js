import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'bookings.json');

const titleToTripId = {
  'Ημερήσια στα Μετέωρα': 1,
  'Απόδραση στην Πρωτεύουσα': 2,
  'Μαγευτικά Ιωάννινα': 3,
  '3ήμερο Ναύπλιο': 1,
};

function seedFromMock() {
  return [
    {
      id: 'B-1029',
      customerId: 'CUST-001',
      customerName: 'John Doe',
      tripTitle: 'Ημερήσια στα Μετέωρα',
      tripId: 1,
      date: '2026-06-15',
      seat: '4A',
      seats: ['4A'],
      paymentStatus: 'PAID',
      status: 'Επιβεβαιωμένη',
      pnr: 'MET26JDOE8A',
      checkInStatus: 'NONE',
      checkedIn: false,
    },
    {
      id: 'B-1030',
      customerId: 'CUST-002',
      customerName: 'Maria Papadopoulou',
      tripTitle: 'Απόδραση στην Πρωτεύουσα',
      tripId: 2,
      date: '2026-06-16',
      seat: '2B, 2C',
      seats: ['2B', '2C'],
      paymentStatus: 'PAID',
      status: 'Επιβεβαιωμένη',
      pnr: 'ATH26MPAP2C',
      checkInStatus: 'NONE',
      checkedIn: false,
    },
    {
      id: 'B-1031',
      customerId: 'CUST-003',
      customerName: 'George K.',
      tripTitle: 'Μαγευτικά Ιωάννινα',
      tripId: 3,
      date: '2026-06-17',
      seat: '1A',
      seats: ['1A'],
      paymentStatus: 'PENDING',
      status: 'Εκκρεμής',
      pnr: 'IOA26GEO1A',
      checkInStatus: 'NONE',
      checkedIn: false,
    },
  ];
}

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(seedFromMock(), null, 2));
  }
}

export function loadBookings() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

export function saveBookings(bookings) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(bookings, null, 2));
}

export function getBookingById(id) {
  return loadBookings().find((b) => b.id === id) ?? null;
}

export function isBookingPaid(booking) {
  if (!booking) return false;
  const ps = String(booking.paymentStatus || '').toUpperCase();
  return ps.includes('PAID') || booking.status === 'Επιβεβαιωμένη';
}

export function markCheckedIn(bookingId) {
  const all = loadBookings();
  const idx = all.findIndex((b) => b.id === bookingId);
  if (idx === -1) return null;
  all[idx] = {
    ...all[idx],
    checkInStatus: 'CHECKED_IN',
    checkedIn: true,
    checkedInAt: new Date().toISOString(),
  };
  saveBookings(all);
  return all[idx];
}

export function enrichTripId(booking) {
  return {
    ...booking,
    tripId: booking.tripId ?? titleToTripId[booking.tripTitle] ?? 0,
  };
}
