import { DEFAULT_PLATFORM_SETTINGS } from '../../services/platformApi.js';
import { loadBookings, isBookingPaid } from '../ticketing/bookingStore.js';
import { generateSeatMap } from '../seats/generateSeatMap.js';

/**
 * @param {import('../../data/mockData.js').mockTrips[0]} trip
 */
export function getTripSeatCapacity(trip) {
  if (!trip) return 45;
  const { seats } = generateSeatMap(trip);
  return seats.length || trip.availableSeats || 45;
}

/**
 * @param {import('../../data/mockData.js').mockTrips[0]} trip
 */
export function countSoldSeatsForTrip(trip) {
  if (!trip) return 0;
  const { seats } = generateSeatMap(trip);
  const fromMap = seats.filter((s) => s.status === 'BOOKED').length;

  const fromBookings = loadBookings()
    .filter(
      (b) =>
        isBookingPaid(b) &&
        (b.tripId === trip.id || b.tripTitle === trip.title),
    )
    .reduce((sum, b) => {
      if (Array.isArray(b.seats) && b.seats.length) return sum + b.seats.length;
      if (b.seat) return sum + b.seat.split(',').filter(Boolean).length;
      return sum + 1;
    }, 0);

  return Math.max(fromMap, fromBookings);
}

/**
 * @param {import('../../data/mockData.js').mockTrips[0]} trip
 * @param {typeof DEFAULT_PLATFORM_SETTINGS} settings
 */
export function computeDynamicPrice(trip, settings = DEFAULT_PLATFORM_SETTINGS) {
  const basePrice = Number(trip?.price) || 0;
  const totalSeats = getTripSeatCapacity(trip);
  const soldSeats = countSoldSeatsForTrip(trip);
  const capacity = Math.max(totalSeats, 1);
  const occupancyRatio = Math.min(1, soldSeats / capacity);

  const highThreshold = Number(settings.pricing_high_occupancy_threshold ?? 0.8);
  const highMarkup = Number(settings.pricing_high_occupancy_markup_pct ?? 10);
  const lowThreshold = Number(settings.pricing_low_occupancy_threshold ?? 0.3);
  const lowDiscount = Number(settings.pricing_low_occupancy_discount_pct ?? 5);

  let adjustmentPct = 0;
  let appliedRule = null;

  if (occupancyRatio >= highThreshold) {
    appliedRule = 'high_occupancy_surge';
    adjustmentPct = highMarkup;
  } else if (occupancyRatio <= lowThreshold) {
    appliedRule = 'low_occupancy_discount';
    adjustmentPct = -lowDiscount;
  }

  const finalPrice =
    Math.round(basePrice * (1 + adjustmentPct / 100) * 100) / 100;

  return {
    tripId: trip?.id,
    basePrice,
    finalPrice,
    occupancyRatio,
    adjustmentPct,
    appliedRule,
    soldSeats,
    totalSeats,
    hasAdjustment: adjustmentPct !== 0,
  };
}

export function pricingRuleLabel(appliedRule) {
  if (appliedRule === 'high_occupancy_surge') return 'Υψηλή ζήτηση';
  if (appliedRule === 'low_occupancy_discount') return 'Προσφορά';
  return null;
}
