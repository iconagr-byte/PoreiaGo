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

  if (compact) {
    return (
      <p className="text-xs text-on-surface-variant">
        {dateStr} · {timeStr} · {trip.availableSeats} θέσεις
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-sm">
        <span className="material-symbols-outlined text-[18px] text-blue-600">calendar_today</span>
        <span>
          {dateStr} · {timeStr}
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

export default function TripCard({
  trip,
  pricingSettings,
  templateId = 'premium',
  layoutId = 'grid_three',
  index = 0,
}) {
  const navigate = useNavigate();
  const priceQuote = computeDynamicPrice(trip, pricingSettings);
  const go = () => navigate(`/trip/${trip.id}`);
  const img = trip.image || '/images/hero-bus-achillio.png';
  const altLayout = layoutId === 'alternating_rows' && index % 2 === 1;

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
        className="relative h-[420px] rounded-[28px] overflow-hidden group cursor-pointer shadow-lg"
        onClick={go}
      >
        <img src={img} alt={trip.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
        <div className="absolute inset-0 p-8 flex flex-col justify-end text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-2">{trip.destination || 'Εκδρομή'}</p>
          <h3 className="text-2xl font-bold mb-3 leading-tight">{trip.title}</h3>
          <TripMeta trip={trip} compact />
          <div className="mt-4 flex items-end justify-between">
            <TripPriceDisplay trip={trip} quote={priceQuote} fetchServer={false} size="lg" />
            <BookButton onClick={go} className="px-5 py-2.5 rounded-full bg-white text-slate-900 text-sm" />
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

  // premium (default)
  return (
    <article className="relative group bg-gradient-to-b from-white to-[#f8f9fa] rounded-[32px] border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.12)] transition-all duration-300 flex flex-col overflow-hidden">
      <div className="relative h-48 w-full overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />
        <img
          src={img}
          alt={trip.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        {(trip.hook || trip.title) && (
          <div className="absolute bottom-4 left-6 right-6 z-20">
            <p className="text-white font-headline-sm font-bold leading-tight drop-shadow-md">
              {trip.hook || trip.title}
            </p>
          </div>
        )}
      </div>
      <div className="p-8 flex flex-col flex-1 relative">
        <h3 className="font-headline-md text-on-surface font-bold tracking-tight mb-4">{trip.title}</h3>
        <div className="mb-8 flex-1">
          <TripMeta trip={trip} />
        </div>
        <div className="flex items-end justify-between pt-6 border-t border-black/[0.04]">
          <TripPriceDisplay trip={trip} quote={priceQuote} fetchServer={false} size="lg" />
          <BookButton
            onClick={go}
            className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full text-sm hover:scale-[1.02] hover:shadow-lg"
          />
        </div>
      </div>
    </article>
  );
}
