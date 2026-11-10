import { pricingRuleLabel } from '../lib/revenue/dynamicPricing.js';
import { useTripPricing } from '../hooks/useTripPricing.js';

/**
 * Shows base vs dynamic price + occupancy badge.
 */
export default function TripPriceDisplay({
  trip,
  quote: quoteProp,
  size = 'md',
  showOccupancy = false,
  fetchServer = true,
  className = '',
}) {
  const { quote: hookQuote } = useTripPricing(trip, { fetchServer });
  const quote = quoteProp ?? hookQuote;
  if (!trip || !quote) return null;

  const label = pricingRuleLabel(quote.appliedRule);
  const priceClass = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl';

  return (
    <div className={`flex flex-col justify-end min-h-[3.75rem] ${className}`}>
      <span
        className={`text-sm text-gray-400 line-through block mb-0.5 min-h-[1.25rem] ${
          quote.hasAdjustment ? '' : 'invisible'
        }`}
        aria-hidden={!quote.hasAdjustment}
      >
        €{quote.basePrice.toFixed(2)}
      </span>
      <div className="flex flex-wrap items-center gap-2 min-h-[1.75rem]">
        <span className={`font-bold text-on-surface tracking-tight ${priceClass}`}>
          €{quote.finalPrice.toFixed(2)}
        </span>
        {label ? (
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              quote.adjustmentPct > 0
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            {label} {quote.adjustmentPct > 0 ? '+' : ''}
            {quote.adjustmentPct}%
          </span>
        ) : null}
      </div>
      {showOccupancy && (
        <p className="text-[10px] text-gray-500 mt-1">
          Πληρότητα {Math.round(quote.occupancyRatio * 100)}% ({quote.soldSeats}/{quote.totalSeats}{' '}
          θέσεις)
        </p>
      )}
    </div>
  );
}
