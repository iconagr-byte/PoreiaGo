/**
 * Clear stale OS / service-worker notifications for the driver PWA.
 * Old «Άνοιξε βάρδια» pushes otherwise linger and reappear on every open.
 */

export async function clearDriverNotifications({ onlyStale = false } = {}) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return 0;
  }

  try {
    const reg =
      (await navigator.serviceWorker.getRegistration('/driver-sw.js')) ||
      (await navigator.serviceWorker.getRegistration()) ||
      (await navigator.serviceWorker.ready.catch(() => null));

    if (!reg?.getNotifications) return 0;

    // Ask SW to clear too (covers browsers where getNotifications is SW-only).
    reg.active?.postMessage({ type: 'CLEAR_NOTIFICATIONS', onlyStale });

    const list = await reg.getNotifications();
    let closed = 0;
    const now = Date.now();
    for (const n of list) {
      const data = n.data || {};
      const created = Number(data.createdAt || data.created_at || 0);
      const isDriverTag =
        typeof n.tag === 'string' &&
        (n.tag.startsWith('driver-') || n.tag === 'driver-pwa' || n.tag.includes('invite'));
      const staleByAge = created > 0 && now - created > 2 * 60 * 60 * 1000; // >2h
      if (!onlyStale || isDriverTag || staleByAge || !created) {
        n.close();
        closed += 1;
      }
    }
    return closed;
  } catch {
    return 0;
  }
}

/** Dismiss in-app toasts + OS notifications when entering the driver shell. */
export async function resetDriverEntryAlerts() {
  try {
    const { default: toast } = await import('react-hot-toast');
    toast.dismiss();
  } catch {
    /* toast lib unavailable */
  }
  return clearDriverNotifications({ onlyStale: false });
}
