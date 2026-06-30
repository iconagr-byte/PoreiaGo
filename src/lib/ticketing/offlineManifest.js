import { issueSignedQrToken } from './qrToken.js';
import { isBookingPaid, loadBookings } from './bookingStore.js';
import { CHECK_IN } from './constants.js';

const MANIFEST_KEY = 'aerostride_offline_manifest_v1';
const USED_OFFLINE_KEY = 'aerostride_offline_used_v1';

/**
 * @typedef {{ bookingId: string, token: string, passengerName: string, seat: string, tripId: number, date: string }} ManifestEntry
 */

export async function buildManifestForTrip(tripId, date) {
  const bookings = loadBookings().filter(
    (b) =>
      isBookingPaid(b) &&
      b.tripId === tripId &&
      b.date === date &&
      b.checkInStatus === CHECK_IN.NONE,
  );

  /** @type {ManifestEntry[]} */
  const entries = [];
  for (const b of bookings) {
    entries.push({
      bookingId: b.id,
      token: await issueSignedQrToken(b),
      passengerName: b.customerName,
      seat: b.seat || b.seats?.join(', ') || '',
      tripId: b.tripId,
      date: b.date,
    });
  }
  return entries;
}

export function saveOfflineManifest(entries) {
  localStorage.setItem(
    MANIFEST_KEY,
    JSON.stringify({ savedAt: new Date().toISOString(), entries }),
  );
}

export function loadOfflineManifest() {
  try {
    const raw = localStorage.getItem(MANIFEST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadUsedOfflineSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(USED_OFFLINE_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveUsedOfflineSet(set) {
  localStorage.setItem(USED_OFFLINE_KEY, JSON.stringify([...set]));
}

/**
 * Offline path: signature valid + token in manifest + not yet used locally.
 * @param {string} token
 */
export function verifyAgainstOfflineManifest(token) {
  const manifest = loadOfflineManifest();
  if (!manifest?.entries?.length) {
    return { ok: false, reason: 'OFFLINE_NOT_IN_MANIFEST' };
  }

  const entry = manifest.entries.find((e) => e.token === token);
  if (!entry) {
    return { ok: false, reason: 'OFFLINE_NOT_IN_MANIFEST' };
  }

  const used = loadUsedOfflineSet();
  if (used.has(entry.bookingId)) {
    return { ok: false, reason: 'OFFLINE_ALREADY_USED' };
  }

  used.add(entry.bookingId);
  saveUsedOfflineSet(used);

  return {
    ok: true,
    entry,
    pendingSync: true,
  };
}

export function getOfflineSyncQueue() {
  try {
    return JSON.parse(localStorage.getItem('aerostride_offline_sync_queue') || '[]');
  } catch {
    return [];
  }
}

export function enqueueOfflineScan(bookingId, token, tripId = 1) {
  const queue = getOfflineSyncQueue();
  queue.push({
    bookingId,
    token,
    tripId,
    scannedAt: new Date().toISOString(),
  });
  localStorage.setItem('aerostride_offline_sync_queue', JSON.stringify(queue));
}

export function clearOfflineSyncQueue() {
  localStorage.removeItem('aerostride_offline_sync_queue');
}
