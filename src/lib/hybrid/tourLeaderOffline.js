/**
 * Offline queue for tour-leader luggage / check-in actions.
 */
const QUEUE_KEY = 'poreiago_tour_leader_offline_v1';

function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function enqueueTourLeaderAction(action) {
  const q = readQueue();
  q.push({
    id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    queuedAt: new Date().toISOString(),
    ...action,
  });
  writeQueue(q);
  return q.length;
}

export function listTourLeaderOfflineQueue(tripId) {
  const q = readQueue();
  if (tripId == null) return q;
  return q.filter((a) => Number(a.tripId) === Number(tripId));
}

export function clearTourLeaderOfflineQueue(tripId) {
  if (tripId == null) {
    writeQueue([]);
    return;
  }
  writeQueue(readQueue().filter((a) => Number(a.tripId) !== Number(tripId)));
}

/**
 * Flush queued upserts via provided async upsertFn(item).
 * Returns { synced, failed }.
 */
export async function flushTourLeaderOfflineQueue(tripId, upsertFn) {
  const pending = listTourLeaderOfflineQueue(tripId);
  if (!pending.length) return { synced: 0, failed: 0 };
  let synced = 0;
  let failed = 0;
  const remaining = [];
  for (const action of pending) {
    try {
      await upsertFn(action.payload);
      synced += 1;
    } catch {
      failed += 1;
      remaining.push(action);
    }
  }
  const others = readQueue().filter((a) => Number(a.tripId) !== Number(tripId));
  writeQueue([...others, ...remaining]);
  return { synced, failed };
}

export function isBrowserOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}
