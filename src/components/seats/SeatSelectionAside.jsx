import { useEffect, useMemo, useState } from 'react';
import { fetchCheckoutSettings } from '../../services/checkoutSettingsApi.js';
import { getSeatMapHeaderClasses } from '../../lib/seats/seatMapThemes.js';
import {
  fillPanelTemplate,
  parseRouteStopLine,
  resolveAsidePanel,
} from '../../lib/seats/seatPricing.js';

function LegendSwatch({ className }) {
  return <span className={`w-4 h-[1.1rem] rounded-t-md rounded-b-sm shadow-sm shrink-0 ${className}`} />;
}

function AmenityList({ items, accent = 'amber' }) {
  if (!items?.length) return null;
  const iconClass = accent === 'sky' ? 'text-sky-500' : 'text-amber-500';
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-xs text-slate-600 leading-snug">
          <span className={`material-symbols-outlined text-[14px] shrink-0 mt-0.5 ${iconClass}`}>
            check_circle
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function VehiclePhoto({ url, alt }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return null;
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 mb-3 relative">
      <img
        src={url}
        alt={alt}
        className="w-full h-28 object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default function SeatSelectionAside({
  trip,
  layout,
  seatTheme,
  seatPricingConfig,
  seats = [],
  tripBasePrice = 0,
  selectedSeatRows = [],
  availableCount = 0,
  className = '',
  compact = false,
}) {
  const [checkoutSettings, setCheckoutSettings] = useState(null);
  const headerChrome = useMemo(() => getSeatMapHeaderClasses(seatTheme), [seatTheme]);
  const panel = useMemo(() => resolveAsidePanel(seatPricingConfig), [seatPricingConfig]);

  useEffect(() => {
    fetchCheckoutSettings().then(setCheckoutSettings);
  }, []);

  const availableSeats = useMemo(
    () => seats.filter((s) => s.status !== 'BOOKED'),
    [seats],
  );

  const priceStats = useMemo(() => {
    const prices = availableSeats.map((s) => s.priceEur).filter(Number.isFinite);
    const vipPrices = availableSeats.filter((s) => s.isVip).map((s) => s.priceEur).filter(Number.isFinite);
    const stdPrices = availableSeats.filter((s) => !s.isVip).map((s) => s.priceEur).filter(Number.isFinite);
    return {
      from: prices.length ? Math.min(...prices) : tripBasePrice,
      vipFrom: vipPrices.length ? Math.min(...vipPrices) : null,
      stdFrom: stdPrices.length ? Math.min(...stdPrices) : null,
    };
  }, [availableSeats, tripBasePrice]);

  const departureLabel = trip?.departureTime
    ? new Date(trip.departureTime).toLocaleString('el-GR', {
        weekday: compact ? 'short' : 'long',
        day: 'numeric',
        month: compact ? 'short' : 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const standardAmenities = seatPricingConfig?.standard_amenities || [];
  const vipAmenities = seatPricingConfig?.vip_amenities || [];
  const vipLabel = panel.vip_amenities_label || seatTheme?.vipLabel || 'VIP';
  const depositPct = checkoutSettings?.checkout_deposit_percent ?? 30;
  const depositEnabled = checkoutSettings?.checkout_deposit_enabled !== false;

  const availabilityText = panel.show_availability
    ? fillPanelTemplate(panel.availability_label || '{count} διαθέσιμες θέσεις', {
        count: availableCount,
      })
    : '';

  const depositText =
    panel.show_deposit_note && depositEnabled
      ? panel.deposit_note
        ? fillPanelTemplate(panel.deposit_note, { percent: depositPct })
        : `Δυνατότητα προκαταβολής ${depositPct}% online — υπόλοιπο στο λεωφορείο.`
      : '';

  const legendHint =
    panel.legend_hint ||
    `Κλικ σε θέση για τιμή & παροχές${seatPricingConfig?.show_popup === false ? ' (άμεση επιλογή)' : ''}.`;

  const routeStops = panel.route_stops.map(parseRouteStopLine).filter(Boolean);

  if (compact) {
    return (
      <div
        className={`rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-sm p-4 shadow-sm ${className}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700/80 mb-1">
              {seatTheme?.vipLabel} · {layout?.label}
            </p>
            <h2 className="font-bold text-slate-900 text-sm leading-snug truncate">{trip?.title}</h2>
            <p className="text-xs text-slate-500 mt-1">{departureLabel}</p>
            {panel.show_availability && availabilityText && (
              <p className="text-[11px] text-emerald-700 font-semibold mt-1.5">{availabilityText}</p>
            )}
          </div>
          {panel.show_pricing && (
            <div className="text-right shrink-0">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">από</p>
              <p className="text-lg font-bold text-primary">€{priceStats.from.toFixed(0)}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <aside className={`space-y-4 ${className}`}>
      {panel.show_vehicle_photo && panel.vehicle_image_url && (
        <div className="rounded-[1.25rem] overflow-hidden border border-black/[0.06] shadow-sm">
          <VehiclePhoto
            url={panel.vehicle_image_url}
            alt={trip?.vehicleType || layout?.label || 'Όχημα'}
          />
        </div>
      )}

      {panel.show_trip_card && (
        <div
          className={`rounded-[1.5rem] border p-5 text-white overflow-hidden relative ${headerChrome.wrapper}`}
        >
          <div
            className={`absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none ${headerChrome.glow}`}
          />
          <p className={`text-[10px] font-bold uppercase tracking-[0.22em] mb-2 ${headerChrome.badge}`}>
            {panel.trip_card_title}
          </p>
          <h2 className="font-bold text-base leading-snug mb-3 relative">{trip?.title}</h2>
          {trip?.destination && (
            <p className="text-xs text-white/60 mb-3 flex items-start gap-1.5 relative">
              <span className="material-symbols-outlined text-[16px] shrink-0 text-white/50">location_on</span>
              {trip.destination}
            </p>
          )}
          <div className="space-y-2 text-sm relative">
            <p className="flex items-center gap-2 text-white/80">
              <span className="material-symbols-outlined text-[18px] text-white/50">calendar_month</span>
              {departureLabel}
            </p>
            <p className="flex items-center gap-2 text-white/80">
              <span className="material-symbols-outlined text-[18px] text-white/50">directions_bus</span>
              {trip?.vehicleType || layout?.label}
              {trip?.vehiclePlate && (
                <span className={`text-[10px] font-mono ml-1 ${headerChrome.plate}`}>{trip.vehiclePlate}</span>
              )}
            </p>
          </div>
        </div>
      )}

      {panel.show_availability && availabilityText && (
        <div className="rounded-[1.25rem] border border-emerald-200/70 bg-emerald-50/80 px-4 py-3 flex items-center gap-2.5 shadow-sm">
          <span className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-emerald-700 text-[20px]">event_available</span>
          </span>
          <p className="text-sm font-bold text-emerald-900">{availabilityText}</p>
        </div>
      )}

      {panel.show_route_stops && routeStops.length > 0 && (
        <div className="rounded-[1.25rem] border border-black/[0.06] bg-white/90 backdrop-blur-sm p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Δρομολόγιο</h3>
          <ol className="space-y-2.5">
            {routeStops.map((stop, idx) => (
              <li key={`${stop.time}-${stop.label}-${idx}`} className="flex gap-3 text-sm">
                {stop.time ? (
                  <span className="font-mono text-[11px] font-bold text-primary shrink-0 w-11 pt-0.5">
                    {stop.time}
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-primary/40 shrink-0 mt-1.5" />
                )}
                <span className="text-slate-700 leading-snug">{stop.label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {panel.show_legend && (
        <div className="rounded-[1.25rem] border border-black/[0.06] bg-white/90 backdrop-blur-sm p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Οδηγός χάρτη</h3>
          <div className="grid grid-cols-2 gap-2.5 text-[11px] font-semibold text-slate-600">
            <span className="flex items-center gap-2">
              <LegendSwatch className={`border ${seatTheme?.available?.legend}`} />
              Ελεύθερη
            </span>
            <span className="flex items-center gap-2">
              <LegendSwatch className={`border ${seatTheme?.vip?.legend}`} />
              {seatTheme?.vipLabel}
            </span>
            <span className="flex items-center gap-2">
              <LegendSwatch className={`border ${seatTheme?.selected?.legend}`} />
              Επιλογή σας
            </span>
            <span className="flex items-center gap-2">
              <LegendSwatch className="bg-slate-600/80 border border-slate-500/40 opacity-60" />
              Κλειστή
            </span>
          </div>
          {legendHint && (
            <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">{legendHint}</p>
          )}
        </div>
      )}

      {panel.show_pricing && (
        <div className="rounded-[1.25rem] border border-amber-200/50 bg-gradient-to-b from-amber-50/80 to-white p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-amber-800/70 mb-3">Τιμές</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">{panel.standard_amenities_label || 'Κανονικές θέσεις'}</span>
              <span className="font-bold text-slate-900">
                {priceStats.stdFrom != null ? `από €${priceStats.stdFrom.toFixed(0)}` : `€${tripBasePrice.toFixed(0)}`}
              </span>
            </div>
            {priceStats.vipFrom != null && (
              <div className="flex justify-between">
                <span className="text-slate-600">{vipLabel}</span>
                <span className="font-bold text-amber-800">από €{priceStats.vipFrom.toFixed(0)}</span>
              </div>
            )}
          </div>
          {depositText && (
            <p className="mt-3 pt-3 border-t border-amber-200/60 text-[11px] text-amber-900/70 leading-relaxed flex gap-1.5">
              <span className="material-symbols-outlined text-[15px] shrink-0">savings</span>
              {depositText}
            </p>
          )}
        </div>
      )}

      {panel.show_amenities && (standardAmenities.length > 0 || vipAmenities.length > 0) && (
        <div className="rounded-[1.25rem] border border-black/[0.06] bg-white/90 backdrop-blur-sm p-4 shadow-sm space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{panel.amenities_title}</h3>
          {vipAmenities.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-amber-800 mb-2">{vipLabel}</p>
              <AmenityList items={vipAmenities} accent="amber" />
            </div>
          )}
          {standardAmenities.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-700 mb-2">{panel.standard_amenities_label}</p>
              <AmenityList items={standardAmenities} accent="sky" />
            </div>
          )}
        </div>
      )}

      {panel.show_tips && panel.tips.length > 0 && (
        <div className="rounded-[1.25rem] border border-violet-200/60 bg-violet-50/50 p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-widest text-violet-700/80 mb-2.5 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">lightbulb</span>
            Συμβουλές
          </h3>
          <ul className="space-y-2">
            {panel.tips.map((tip) => (
              <li key={tip} className="text-xs text-violet-900/80 leading-relaxed flex gap-2">
                <span className="text-violet-400 shrink-0">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {panel.show_selected_seats && selectedSeatRows.length > 0 && (
        <div className="rounded-[1.25rem] border border-primary/15 bg-primary/5 p-4 shadow-sm animate-in fade-in slide-in-from-left-2 duration-200">
          <h3 className="text-xs font-bold uppercase tracking-widest text-primary/80 mb-3">
            Επιλεγμένες θέσεις
          </h3>
          <ul className="space-y-3">
            {selectedSeatRows.map((seat) => (
              <li key={seat.id} className="text-sm">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>{seat.number}</span>
                  <span>€{Number(seat.priceEur || 0).toFixed(2)}</span>
                </div>
                {seat.amenities?.length > 0 && (
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{seat.amenities.join(' · ')}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
