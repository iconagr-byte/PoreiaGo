import { useEffect, useMemo, useState } from 'react';
import { loadPlatformDemoTrips } from '../lib/trips/tripStore.js';
import { isPlatformSeatBookingDemo } from '../lib/marketing/platformBusDemoShowcase.js';
import { resolvePublicOfficeTrip } from '../lib/wallet/walletOfficeTrips.js';

/**
 * Resolve a published office trip for seat map / extras / checkout.
 * Prefers local tripStore, then Wallet session cache, then sealed-tenant API
 * so My Wallet → Κράτηση works on native (empty localStorage) and desktop.
 *
 * @param {string|number|undefined} tripId
 * @returns {{ trip: object|null, loading: boolean, isDemo: boolean }}
 */
export function usePublicOfficeTrip(tripId) {
  const id = Number(tripId);
  const validId = Number.isFinite(id) && id > 0;
  const isDemo = useMemo(() => isPlatformSeatBookingDemo(), []);
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(validId);

  useEffect(() => {
    if (!validId) {
      setTrip(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        let hit = await resolvePublicOfficeTrip(id);
        if (!hit && isDemo) {
          hit = loadPlatformDemoTrips().find((t) => Number(t.id) === id) || null;
        }
        if (!cancelled) setTrip(hit || null);
      } catch {
        if (!cancelled) setTrip(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, validId, isDemo]);

  return { trip, loading, isDemo };
}
