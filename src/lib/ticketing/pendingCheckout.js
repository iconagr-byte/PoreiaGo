const KEY = 'pendingCheckout';

export function savePendingCheckout(payload) {
  sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function loadPendingCheckout() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPendingCheckout() {
  sessionStorage.removeItem(KEY);
}
