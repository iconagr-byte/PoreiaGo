import { useNavigate } from 'react-router-dom';
import TripPriceDisplay from '../TripPriceDisplay.jsx';
import { computeDynamicPrice } from '../../lib/revenue/dynamicPricing.js';

function TripMeta({ trip, compact = false }) {
  const dateStr = new Date(trip.departureTime).toLocaleDateString('el-GR', {
    day: 'numeric',
    month: 'short',
  });
  const timeStr = new Date(trip.departureTime).toLocaleTimeString('el-GR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const duration = trip.durationLabel ? ` · ${trip.durationLabel}` : '';

  if (compact) {
    return (
      <p className="text-xs text-on-surface-variant">
        {dateStr} · {timeStr}
        {duration} · {trip.availableSeats} θέσεις
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm">
        <span className="material-symbols-outlined text-[18px] text-blue-600">calendar_today</span>
        <span>
          {dateStr} · {timeStr}
          {duration}
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm text-emerald-700">
        <span className="material-symbols-outlined text-[18px]">event_seat</span>
        <span className="font-medium">{trip.availableSeats} διαθέσιμες θέσεις</span>
      </div>
    </div>
  );
}

function BookButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`inline-flex items-center gap-2 font-bold transition-all ${className}`}
    >
      Κράτηση
      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
    </button>
  );
}

/** Bus seat class label — never airline «Economy». */
function busSeatClassLabel(trip) {
  const raw = String(trip?.vehicleType || trip?.seat_class || '').toLowerCase();
  if (raw.includes('vip') || raw.includes('luxury')) return 'VIP';
  if (raw.includes('premium') || raw.includes('comfort') || raw.includes('express')) return 'Comfort';
  return 'Standard';
}

function formatBusDateRange(trip) {
  const start = trip?.departureTime ? new Date(trip.departureTime) : null;
  const end = trip?.arrivalTime ? new Date(trip.arrivalTime) : null;
  if (!start || Number.isNaN(start.getTime())) return '';
  const fmt = (d) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (!end || Number.isNaN(end.getTime()) || end.getTime() === start.getTime()) {
    return fmt(start);
  }
  // Same calendar day day-trip → show date once + times feel odd in this layout; keep range if multi-day.
  if (start.toDateString() === end.toDateString()) return fmt(start);
  return `${fmt(start)} - ${fmt(end)}`;
}

function destinationTitle(trip) {
  const dest = String(trip?.destination || '').trim();
  if (dest) return dest.split(',')[0].trim();
  const title = String(trip?.title || '').trim();
  // Prefer short destination-like titles for poster cards.
  if (title.includes('—')) return title.split('—')[0].trim();
  if (title.includes(' στα ')) return title.split(' στα ').pop().trim();
  if (title.includes(' στην ')) return title.split(' στην ').pop().trim();
  return title;
}

export default function TripCard({
  trip,
  pricingSettings,
  templateId = 'premium',
  layoutId = 'grid_three',
  index = 0,
  solo = false,
}) {
  const navigate = useNavigate();
  const priceQuote = computeDynamicPrice(trip, pricingSettings);
  const go = () => navigate(`/trip/${trip.id}`);
  const img = trip.image || '/images/hero-bus-achillio.png';
  const altLayout = layoutId === 'alternating_rows' && index % 2 === 1;
  const useDestinationPoster =
    templateId === 'destination_poster' || layoutId === 'destination_bento';

  if (useDestinationPoster) {
    const seatClass = busSeatClassLabel(trip);
    const dateRange = formatBusDateRange(trip);
    const place = destinationTitle(trip);
    const amount = Number(priceQuote?.finalPrice ?? trip.price ?? 0);
    const currency = String(trip.currency || 'EUR').toUpperCase();
    return (
      <article
        className="relative h-full min-h-[220px] rounded-[22px] overflow-hidden group cursor-pointer shadow-[0_8px_28px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.04]"
        onClick={go}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            go();
          }
        }}
      >
        <img
          src={img}
          alt={place}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 flex items-end justify-between gap-3 text-white">
          <div className="min-w-0">
            <h3 className="text-[1.15rem] sm:text-[1.35rem] font-semibold tracking-tight leading-tight truncate">
              {place}
            </h3>
            {dateRange ? (
              <p className="mt-1 text-[12px] sm:text-[13px] text-white/85 font-normal tracking-tight">
                {dateRange}
              </p>
            ) : null}
          </div>
          <p className="shrink-0 text-right text-[12px] sm:text-[13px] font-medium text-white/95 tracking-tight">
            {seatClass} {currency} {amount.toFixed(0)}
          </p>
        </div>
      </article>
    );
  }

  if (templateId === 'compact_horizontal' || layoutId === 'compact_list') {
    return (
      <article
        className="flex gap-4 p-3 rounded-2xl border border-black/[0.06] bg-white hover:shadow-md transition-shadow cursor-pointer"
        onClick={go}
      >
        <img src={img} alt="" className="w-24 h-24 rounded-xl object-cover shrink-0" />
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <h3 className="font-bold text-on-surface truncate">{trip.title}</h3>
          <TripMeta trip={trip} compact />
          <div className="mt-2 flex items-center justify-between gap-2">
            <TripPriceDisplay trip={trip} quote={priceQuote} fetchServer={false} size="sm" />
            <BookButton onClick={go} className="text-sm text-primary px-3 py-1.5 rounded-full bg-primary/10" />
          </div>
        </div>
      </article>
    );
  }

  if (templateId === 'image_overlay') {
    return (
      <article
        className={`relative ${
          solo ? 'h-[260px] sm:h-[300px]' : 'h-[360px] md:h-[420px]'
        } rounded-[28px] overflow-hidden group cursor-pointer shadow-lg`}
        onClick={go}
      >
        <img src={img} alt={trip.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />
        <div
          className={`absolute inset-0 flex flex-col justify-end text-white ${
            solo ? 'p-5 sm:p-6' : 'p-8'
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-widest text-white/80 mb-1.5">
            {trip.destination || 'Εκδρομή'}
          </p>
          <h3
            className={`font-bold leading-tight mb-2 ${
              solo ? 'text-xl sm:text-2xl' : 'text-2xl'
            }`}
          >
            {trip.title}
          </h3>
          <div className="text-white/85 [&_p]:text-white/85">
            <TripMeta trip={trip} compact />
          </div>
          <div className={`flex items-end justify-between gap-3 ${solo ? 'mt-3' : 'mt-4'}`}>
            <div className="text-white [&_*]:text-white">
              <TripPriceDisplay
                trip={trip}
                quote={priceQuote}
                fetchServer={false}
                size={solo ? 'md' : 'lg'}
              />
            </div>
            <BookButton
              onClick={go}
              className="px-5 py-2.5 rounded-full bg-white text-slate-900 text-sm shrink-0"
            />
          </div>
        </div>
      </article>
    );
  }

  if (templateId === 'minimal_clean') {
    return (
      <article className="bg-white rounded-2xl border border-black/[0.05] p-5 hover:shadow-lg transition-shadow">
        <img src={img} alt="" className="w-full h-36 rounded-xl object-cover mb-4" />
        <h3 className="font-bold text-lg text-on-surface mb-2">{trip.title}</h3>
        <TripMeta trip={trip} compact />
        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <TripPriceDisplay trip={trip} quote={priceQuote} fetchServer={false} size="md" />
          <BookButton onClick={go} className="text-sm text-white px-5 py-2 rounded-full bg-slate-900" />
        </div>
      </article>
    );
  }

  if (templateId === 'magazine') {
    return (
      <article className="group cursor-pointer" onClick={go}>
        <div className="overflow-hidden rounded-none mb-5">
          <img src={img} alt="" className="w-full h-56 object-cover group-hover:scale-[1.02] transition-transform duration-500" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-2">Featured trip</p>
        <h3 className="text-3xl font-display font-bold text-on-surface leading-tight mb-3">{trip.title}</h3>
        <p className="text-on-surface-variant mb-4 line-clamp-2">{trip.hook || trip.description || ''}</p>
        <div className="flex items-center justify-between border-t pt-4">
          <TripPriceDisplay trip={trip} quote={priceQuote} fetchServer={false} size="lg" />
          <BookButton onClick={go} className="text-sm underline underline-offset-4 text-on-surface" />
        </div>
      </article>
    );
  }

  if (templateId === 'bordered_sharp') {
    return (
      <article className="border-2 border-slate-900 bg-white overflow-hidden hover:-translate-y-0.5 transition-transform">
        <img src={img} alt="" className="w-full h-44 object-cover" />
        <div className="p-6 border-t-2 border-slate-900">
          <h3 className="text-xl font-black uppercase tracking-tight mb-3">{trip.title}</h3>
          <TripMeta trip={trip} />
          <div className="mt-6 flex items-center justify-between border-t-2 border-slate-200 pt-4">
            <TripPriceDisplay trip={trip} quote={priceQuote} fetchServer={false} size="md" />
            <BookButton onClick={go} className="text-sm px-4 py-2 border-2 border-slate-900 rounded-none" />
          </div>
        </div>
      </article>
    );
  }

  if (templateId === 'glass_card') {
    return (
      <article className="rounded-[28px] border border-white/40 bg-white/60 backdrop-blur-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.08)] hover:bg-white/80 transition-colors">
        <div className="rounded-2xl overflow-hidden mb-4">
          <img src={img} alt="" className="w-full h-44 object-cover" />
        </div>
        <h3 className="font-bold text-on-surface mb-2">{trip.title}</h3>
        <TripMeta trip={trip} compact />
        <div className="mt-4 flex items-center justify-between">
          <TripPriceDisplay trip={trip} quote={priceQuote} fetchServer={false} size="md" />
          <BookButton
            onClick={go}
            className="text-sm text-white px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg"
          />
        </div>
      </article>
    );
  }

  if (layoutId === 'alternating_rows') {
    return (
      <article
        className={`flex flex-col ${altLayout ? 'md:flex-row-reverse' : 'md:flex-row'} gap-8 items-center cursor-pointer group`}
        onClick={go}
      >
        <div className="w-full md:w-1/2 rounded-[32px] overflow-hidden shadow-xl">
          <img src={img} alt="" className="w-full h-64 md:h-80 object-cover group-hover:scale-105 transition-transform duration-700" />
        </div>
        <div className="w-full md:w-1/2 md:px-4">
          <h3 className="text-3xl font-bold text-on-surface mb-4">{trip.title}</h3>
          <TripMeta trip={trip} />
          <p className="text-on-surface-variant mt-4 mb-6">{trip.hook || ''}</p>
          <div className="flex items-center gap-6">
            <TripPriceDisplay trip={trip} quote={priceQuote} fetchServer={false} size="lg" />
            <BookButton
              onClick={go}
              className="text-sm text-white px-6 py-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
            />
          </div>
        </div>
      </article>
    );
  }

  if (templateId === 'soft_apple') {
    return (
      <article
        className="group h-full flex flex-col rounded-[22px] bg-[#f5f5f7] border border-black/[0.05] overflow-hidden hover:bg-white hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-all duration-300 cursor-pointer"
        onClick={go}
      >
        <div className="relative h-44 overflow-hidden shrink-0">
          <img src={img} alt={trip.title} className="w-full h-full object-cover" />
        </div>
        <div className="p-5 flex flex-col flex-1">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight mb-2">{trip.title}</h3>
          <TripMeta trip={trip} compact />
          <div className="mt-auto pt-4 flex items-end justify-between gap-3">
            <TripPriceDisplay trip={trip} quote={priceQuote} fetchServer={false} size="md" />
            <BookButton onClick={go} className="text-sm text-[#0071e3] font-semibold" />
          </div>
        </div>
      </article>
    );
  }

  if (templateId === 'luxe_noir') {
    return (
      <article
        className="group h-full flex flex-col rounded-[24px] bg-[#121214] border border-white/10 overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.35)] hover:border-amber-500/30 transition-colors cursor-pointer"
        onClick={go}
      >
        <div className="relative h-48 overflow-hidden shrink-0">
          <img src={img} alt={trip.title} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121214] via-transparent to-transparent" />
          <span className="absolute top-3 left-3 z-10 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300/90">
            Luxury
          </span>
        </div>
        <div className="p-5 flex flex-col flex-1 text-white">
          <h3 className="text-lg font-semibold tracking-tight mb-2">{trip.title}</h3>
          <div className="text-white/70 [&_span]:text-amber-200/80">
            <TripMeta trip={trip} compact />
          </div>
          <div className="mt-auto pt-4 flex items-end justify-between gap-3 border-t border-white/10">
            <div className="[&_*]:text-white">
              <TripPriceDisplay trip={trip} quote={priceQuote} fetchServer={false} size="md" />
            </div>
            <BookButton
              onClick={go}
              className="text-sm px-4 py-2.5 rounded-full bg-amber-500 text-slate-950 font-bold"
            />
          </div>
        </div>
      </article>
    );
  }

  if (templateId === 'spotlight') {
    return (
      <article
        className="group relative h-full min-h-[340px] rounded-[28px] overflow-hidden cursor-pointer shadow-lg"
        onClick={go}
      >
        <img
          src={img}
          alt={trip.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
        <div className="absolute top-4 right-4 z-10 rounded-2xl bg-white/95 px-3 py-2 shadow-md">
          <div className="[&_*]:text-slate-900">
            <TripPriceDisplay trip={trip} quote={priceQuote} fetchServer={false} size="sm" />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 p-5 md:p-6 text-white">
          <h3 className="text-xl font-bold tracking-tight mb-1">{trip.title}</h3>
          <div className="text-white/80 mb-4">
            <TripMeta trip={trip} compact />
          </div>
          <BookButton
            onClick={go}
            className="text-sm px-5 py-2.5 rounded-full bg-white text-slate-900 font-bold"
          />
        </div>
      </article>
    );
  }

  if (templateId === 'ticket_stub') {
    return (
      <article
        className="group h-full flex flex-col sm:flex-row rounded-2xl bg-white border border-dashed border-slate-300 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        onClick={go}
      >
        <div className="relative sm:w-[42%] h-40 sm:h-auto shrink-0 overflow-hidden">
          <img src={img} alt={trip.title} className="w-full h-full object-cover min-h-[160px]" />
          <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-wider bg-white/95 px-2 py-1 rounded">
            Ticket
          </span>
        </div>
        <div className="relative flex-1 p-5 flex flex-col border-t sm:border-t-0 sm:border-l border-dashed border-slate-300">
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 hidden sm:block w-4 h-4 rounded-full bg-surface border border-dashed border-slate-300" />
          <h3 className="font-bold text-on-surface mb-2">{trip.title}</h3>
          <TripMeta trip={trip} compact />
          <div className="mt-auto pt-4 flex items-end justify-between gap-2">
            <TripPriceDisplay trip={trip} quote={priceQuote} fetchServer={false} size="md" />
            <BookButton
              onClick={go}
              className="text-sm px-4 py-2 rounded-lg bg-slate-900 text-white font-bold"
            />
          </div>
        </div>
      </article>
    );
  }

  // premium (default) — solo = narrower card for new offices with one trip
  return (
    <article
      className={`relative group h-full bg-gradient-to-b from-white to-[#f8f9fa] border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.12)] transition-all duration-300 flex flex-col overflow-hidden ${
        solo ? 'rounded-[22px]' : 'rounded-[32px]'
      }`}
    >
      <div className={`relative w-full overflow-hidden shrink-0 ${solo ? 'h-32 sm:h-36' : 'h-48'}`}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
        <img
          src={img}
          alt={trip.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        {trip.badge ? (
          <span
            className={`absolute z-20 rounded-full bg-white/95 text-slate-900 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 shadow-sm ${
              solo ? 'top-3 left-3' : 'top-4 left-4'
            }`}
          >
            {trip.badge}
          </span>
        ) : null}
        {(trip.hook || trip.title) && (
          <div className={`absolute z-20 ${solo ? 'bottom-3 left-4 right-4' : 'bottom-4 left-6 right-6'}`}>
            <p
              className={`text-white font-bold leading-tight drop-shadow-md ${
                solo ? 'text-base sm:text-lg' : 'font-headline-sm'
              }`}
            >
              {trip.hook || trip.title}
            </p>
          </div>
        )}
      </div>
      <div className={`flex flex-col flex-1 relative min-h-0 ${solo ? 'p-4 sm:p-5' : 'p-8'}`}>
        <h3
          className={`text-on-surface font-bold tracking-tight ${
            solo ? 'text-lg mb-2.5' : 'font-headline-md mb-4'
          }`}
        >
          {trip.title}
        </h3>
        <div className={solo ? 'mb-4 flex-1' : 'mb-8 flex-1'}>
          <TripMeta trip={trip} compact={solo} />
        </div>
        <div
          className={`mt-auto flex items-end justify-between gap-3 border-t border-black/[0.04] ${
            solo ? 'pt-3.5' : 'pt-6'
          }`}
        >
          <TripPriceDisplay
            trip={trip}
            quote={priceQuote}
            fetchServer={false}
            size={solo ? 'md' : 'lg'}
          />
          <BookButton
            onClick={go}
            className={`bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full text-sm hover:scale-[1.02] hover:shadow-lg shrink-0 ${
              solo ? 'px-4 py-2.5' : 'px-6 py-3.5'
            }`}
          />
        </div>
      </div>
    </article>
  );
}
