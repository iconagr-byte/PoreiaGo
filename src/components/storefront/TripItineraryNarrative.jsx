import { useMemo } from 'react';
import {
  itinerarySlotIcon,
  parseTripItinerary,
} from '../../lib/trips/parseTripItinerary.js';

/**
 * Readable trip description — structured day/time rows when office copy
 * uses "1η Ημέρα / Πρωί / Απόγευμα" markers; otherwise soft paragraphs.
 */
export default function TripItineraryNarrative({ description, title }) {
  const parsed = useMemo(
    () => parseTripItinerary(description, { title }),
    [description, title],
  );

  if (!parsed.intro && !parsed.days.length && !parsed.paragraphs.length) {
    return null;
  }

  if (!parsed.structured) {
    return (
      <div className="trip-itinerary mt-4 max-w-3xl space-y-3">
        {parsed.paragraphs.map((p, i) => (
          <p
            key={`p-${i}`}
            className="text-[0.98rem] sm:text-base text-[#3a3a3c] leading-[1.65] tracking-[-0.01em] break-words"
          >
            {p}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="trip-itinerary mt-5 max-w-3xl min-w-0">
      {parsed.intro ? (
        <p className="text-[0.98rem] sm:text-base text-[#3a3a3c] leading-[1.65] tracking-[-0.01em] break-words mb-5">
          {parsed.intro}
        </p>
      ) : null}

      <div className="flex items-center gap-2 mb-3">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#5ac8fa] to-[#0071e3] text-white shadow-sm"
          aria-hidden
        >
          <span className="material-symbols-outlined text-[18px]">map</span>
        </span>
        <h2 className="text-[11px] uppercase tracking-[0.14em] font-bold text-[#86868b]">
          Πρόγραμμα εκδρομής
        </h2>
      </div>

      <ol className="flex flex-col gap-3.5 sm:gap-4 list-none m-0 p-0">
        {parsed.days.map((day, dayIdx) => (
          <li
            key={day.label}
            className="rounded-[22px] bg-[#f5f5f7] overflow-hidden animate-[tripItinIn_320ms_ease-out_both]"
            style={{ animationDelay: `${Math.min(dayIdx, 6) * 45}ms` }}
          >
            <div className="flex items-center gap-3 px-3.5 sm:px-4 pt-3.5 pb-2.5 border-b border-black/[0.05]">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1d1d1f] text-white text-sm font-bold tracking-tight tabular-nums"
                aria-hidden
              >
                {day.day}
              </span>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#86868b]">
                  Ημέρα
                </div>
                <div className="text-[1.05rem] font-semibold text-[#1d1d1f] tracking-tight">
                  {day.label}
                </div>
              </div>
            </div>

            <ul className="flex flex-col gap-0 list-none m-0 p-0">
              {day.slots.map((slot, i) => (
                <li
                  key={`${day.label}-${slot.kind}-${i}`}
                  className={`flex items-start gap-3 px-3.5 sm:px-4 py-3 ${
                    i > 0 ? 'border-t border-black/[0.04]' : ''
                  }`}
                >
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#0071e3] shadow-[0_1px_0_rgba(0,0,0,0.04)]"
                    aria-hidden
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {itinerarySlotIcon(slot.kind)}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    {slot.label ? (
                      <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#0071e3] mb-0.5">
                        {slot.label}
                      </div>
                    ) : null}
                    <p className="text-[0.95rem] sm:text-[0.98rem] text-[#1d1d1f] leading-relaxed tracking-[-0.01em] break-words m-0">
                      {slot.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <style>{`
        @keyframes tripItinIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .trip-itinerary [style*='animationDelay'] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
