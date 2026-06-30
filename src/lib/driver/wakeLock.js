/**
 * Screen Wake Lock — keep display on during active driver shift.
 */

export function isWakeLockSupported() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export async function requestWakeLock() {
  if (!isWakeLockSupported()) {
    return null;
  }
  try {
    return await navigator.wakeLock.request('screen');
  } catch {
    return null;
  }
}

export async function releaseWakeLock(sentinel) {
  try {
    await sentinel?.release?.();
  } catch {
    // ignore
  }
}
