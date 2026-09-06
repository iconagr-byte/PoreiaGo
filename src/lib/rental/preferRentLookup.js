/**
 * Session flag: user is in the Rent product journey.
 * Bus `/my-booking` must redirect to Rent when this is set.
 */
export const PREFER_RENT_LOOKUP_KEY = 'poreiago_prefer_rent_lookup_v1';

export function markPreferRentLookup() {
  try {
    sessionStorage.setItem(PREFER_RENT_LOOKUP_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function hasPreferRentLookup() {
  try {
    return sessionStorage.getItem(PREFER_RENT_LOOKUP_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearPreferRentLookup() {
  try {
    sessionStorage.removeItem(PREFER_RENT_LOOKUP_KEY);
  } catch {
    /* ignore */
  }
}

/** True when the browser referrer is a /rent URL (same origin or absolute). */
export function referrerLooksLikeRent() {
  if (typeof document === 'undefined') return false;
  const ref = String(document.referrer || '');
  if (!ref) return false;
  try {
    const u = new URL(ref, typeof window !== 'undefined' ? window.location.origin : 'https://www.poreiago.com');
    return u.pathname === '/rent' || u.pathname.startsWith('/rent/');
  } catch {
    return /\/rent(\/|$|\?)/.test(ref);
  }
}
