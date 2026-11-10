import { useEffect, useMemo, useState } from 'react';
import { loadPlatformDemoTrips } from '../lib/trips/tripStore.js';
import {
  isPlatformSeatBookingDemo,
  isSealedWalletLiveBooking,
} from '../lib/marketing/platformBusDemoShowcase.js';
import { resolvePublicOfficeTrip } from '../lib/wallet/walletOfficeTrips.js';

function seedForTripId(seedTrip, id) {
  if (!seedTrip || seedTrip.id == null) return null;
  const sid = Number(seedTrip.id);
  if (!Number.isFinite(sid) || sid !== id) return null;
  return seedTrip;
}

/**
 * Resolve a published office trip for seat map / extras / checkout.
 * Prefers: seed (Wallet nav state) → local tripStore → session cache → API.
 * Never auto-navigates away — callers stay on the seat page with an error UI.
 *
 * @param {string|number|undefined} tripId
 * @param {{ seedTrip?: object|null, fromWallet?: boolean }} [options]
 * @returns {{ trip: object|null, loading: boolean, isDemo: boolean }}
 */
export function usePublicOfficeTrip(tripId, options = {}) {
  const id = Number(tripId);
  const validId = Number.isFinite(id) && id > 0;
  const seedTrip = options?.seedTrip || null;
  const fromWallet = Boolean(options?.fromWallet);
  const seedId =
    seedTrip && Number.isFinite(Number(seedTrip.id)) && Number(seedTrip.id) === id
      ? Number(seedTrip.id)
      : null;
  // Wallet Κράτηση / sealed office → live commit (not platform demo simulation).
  // Also honor pendingCheckout.fromWallet when Router state was dropped (Capacitor).
  const isDemo = useMemo(() => {
    if (fromWallet || isSealedWalletLiveBooking()) return false;
    try {
      const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('pendingCheckout') : null;
      if (raw) {
        const pending = JSON.parse(raw);
        if (pending?.fromWallet) return false;
        // Never trust a stale demo flag once Wallet sealed / fromWallet path ran.
        if (pending?.demo === false) return false;
      }
    } catch {
      /* ignore */
    }
    return isPlatformSeatBookingDemo();
  }, [fromWallet]);
  const [trip, setTrip] = useState(() => seedForTripId(seedTrip, id));
  const [loading, setLoading] = useState(validId && seedId == null);

  useEffect(() => {
    if (!validId) {
      setTrip(null);
      setLoading(false);
      return undefined;
    }
    const seeded = seedForTripId(seedTrip, id);
    let cancelled = false;
    // Seed from Wallet card so we never flash empty then bounce while API loads.
    if (seeded) {
      setTrip(seeded);
      setLoading(false);
    } else {
      setLoading(true);
    }
    (async () => {
      try {
        let hit = await resolvePublicOfficeTrip(id);
        if (!hit && isDemo) {
          hit = loadPlatformDemoTrips().find((t) => Number(t.id) === id) || null;
        }
        if (!hit && seeded) hit = seeded;
        if (!cancelled) setTrip(hit || null);
      } catch {
        if (!cancelled) setTrip(seeded || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // seedTrip identity is keyed by seedId (same published trip from Wallet).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seedTrip object from location.state
  }, [id, validId, isDemo, seedId]);

  return { trip, loading, isDemo };
}
