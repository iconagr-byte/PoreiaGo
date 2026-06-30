import { upsertAbandonedCart, getStoredResumeToken } from '../../services/abandonedApi.js';

let debounceTimer;

/**
 * Debounced sync of checkout form → abandoned cart API.
 */
export function trackAbandonedCheckout(payload) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (!payload.tripId || !payload.amountEur) return;
    upsertAbandonedCart({
      resumeToken: getStoredResumeToken(),
      ...payload,
    });
  }, 800);
}
