/**
 * Cross-surface booking/trip sync — same browser tab, other tabs, office ↔ wallet.
 * Desktop BackOffice listens and reloads without a hard refresh.
 */

export const BOOKINGS_CHANGED_EVENT = 'poreiago-bookings-changed';
export const TRIPS_CHANGED_EVENT = 'poreiago-trips-changed';
const STORAGE_PING_KEY = 'poreiago_bookings_sync_ping_v1';
const TRIPS_PING_KEY = 'poreiago_trips_sync_ping_v1';

function emit(name, detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    /* ignore */
  }
}

function pingStorage(key) {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Call after any permanent booking create/update/delete that other surfaces must see. */
export function notifyBookingsChanged(detail = {}) {
  emit(BOOKINGS_CHANGED_EVENT, { at: Date.now(), ...detail });
  pingStorage(STORAGE_PING_KEY);
}

/** Call after trip catalog create/delete so other office tabs drop stale rows. */
export function notifyTripsChanged(detail = {}) {
  emit(TRIPS_CHANGED_EVENT, { at: Date.now(), ...detail });
  pingStorage(TRIPS_PING_KEY);
}

/**
 * Subscribe to booking/trip changes (CustomEvent + storage ping from other tabs).
 * @param {{ onBookings?: () => void, onTrips?: () => void }} handlers
 * @returns {() => void} unsubscribe
 */
export function subscribeOfficeCatalogSync({ onBookings, onTrips } = {}) {
  const onBookingsEv = () => {
    try {
      onBookings?.();
    } catch {
      /* ignore */
    }
  };
  const onTripsEv = () => {
    try {
      onTrips?.();
    } catch {
      /* ignore */
    }
  };
  const onStorage = (ev) => {
    if (ev.key === STORAGE_PING_KEY) onBookingsEv();
    if (ev.key === TRIPS_PING_KEY) onTripsEv();
  };
  const onVis = () => {
    if (document.visibilityState === 'visible') {
      onBookingsEv();
      onTripsEv();
    }
  };

  if (onBookings) window.addEventListener(BOOKINGS_CHANGED_EVENT, onBookingsEv);
  if (onTrips) window.addEventListener(TRIPS_CHANGED_EVENT, onTripsEv);
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('focus', onBookingsEv);

  return () => {
    if (onBookings) window.removeEventListener(BOOKINGS_CHANGED_EVENT, onBookingsEv);
    if (onTrips) window.removeEventListener(TRIPS_CHANGED_EVENT, onTripsEv);
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('focus', onBookingsEv);
  };
}
