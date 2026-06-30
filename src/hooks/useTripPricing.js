import { useEffect, useMemo, useState } from 'react';
import { computeDynamicPrice } from '../lib/revenue/dynamicPricing.js';
import {
  DEFAULT_PLATFORM_SETTINGS,
  fetchPlatformSettings,
} from '../services/platformApi.js';
import { API_BASE } from '../config/api.js';
import {
  countSoldSeatsForTrip,
  getTripSeatCapacity,
} from '../lib/revenue/dynamicPricing.js';

/**
 * Dynamic price for a trip (local rules + optional server quote).
 * @param {object | null} trip
 */
export function useTripPricing(trip, { fetchServer = true } = {}) {
  const [settings, setSettings] = useState(DEFAULT_PLATFORM_SETTINGS);
  const [serverQuote, setServerQuote] = useState(null);

  useEffect(() => {
    fetchPlatformSettings().then(setSettings);
  }, []);

  const localQuote = useMemo(
    () => (trip ? computeDynamicPrice(trip, settings) : null),
    [trip, settings],
  );

  useEffect(() => {
    if (!fetchServer || !trip?.id) {
      setServerQuote(null);
      return;
    }
    let cancelled = false;
    const sold = countSoldSeatsForTrip(trip);
    const capacity = getTripSeatCapacity(trip);
    const base = Number(trip.price) || 0;
    const url = `${API_BASE}/api/admin/platform/pricing/quote?trip_id=${trip.id}&base_price=${base}&total_seats=${capacity}&sold_seats=${sold}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setServerQuote(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [trip?.id, trip?.price, fetchServer]);

  const quote = useMemo(() => {
    if (!localQuote) return null;
    if (serverQuote) {
      return {
        ...localQuote,
        finalPrice: Number(serverQuote.final_price_eur) || localQuote.finalPrice,
        basePrice: Number(serverQuote.base_price_eur) || localQuote.basePrice,
        occupancyRatio: serverQuote.occupancy_ratio ?? localQuote.occupancyRatio,
        adjustmentPct: serverQuote.adjustment_pct ?? localQuote.adjustmentPct,
        appliedRule: serverQuote.applied_rule ?? localQuote.appliedRule,
        hasAdjustment: (serverQuote.adjustment_pct ?? 0) !== 0,
        fromServer: true,
      };
    }
    return localQuote;
  }, [localQuote, serverQuote]);

  return {
    quote,
    settings,
    pricePerSeat: quote?.finalPrice ?? trip?.price ?? 0,
  };
}
