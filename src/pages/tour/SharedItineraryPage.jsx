import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { decodeItineraryShare } from '../../lib/hybrid/itineraryShare.js';
import { analyzeConnectionRisks } from '../../lib/hybrid/connectionRisk.js';
import { SEGMENT_TYPE_OPTIONS } from '../../lib/hybrid/hybridDefaults.js';
import { getTripById } from '../../lib/trips/tripStore.js';

function formatWhen(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('el-GR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

/**
 * Read-only shared hybrid itinerary (public hash token or local trip id).
 */
export default function SharedItineraryPage() {
  const { tripId } = useParams();
  const hashToken =
    typeof window !== 'undefined' ? String(window.location.hash || '').replace(/^#/, '') : '';

  const data = useMemo(() => {
    if (hashToken) return decodeItineraryShare(hashToken);
    if (tripId) {
      const trip = getTripById(tripId);
      if (!trip) return null;
      return {
        v: 1,
        id: trip.id,
        title: trip.title,
        currency: trip.currency || 'EUR',
        departureTime: trip.departureTime,
        flights: trip.flights || [],
        segments: trip.segments || [],
      };
    }
    return null;
  }, [hashToken, tripId]);

  const segments = useMemo(
    () => [...(data?.segments || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
    [data],
  );
  const risks = useMemo(() => analyzeConnectionRisks(segments), [segments]);
  const riskByTo = Object.fromEntries(risks.map((r) => [r.toId, r]));

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-semibold text-slate-800">Το itinerary δεν βρέθηκε</p>
          <Link to="/" className="text-sm font-bold underline text-slate-700">
            Αρχική
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-200 text-slate-900">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur px-4 py-5">
        <div className="max-w-xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Shared itinerary</p>
          <h1 className="text-2xl font-bold mt-1">{data.title}</h1>
          {data.departureTime ? (
            <p className="text-sm text-slate-500 mt-1">{formatWhen(data.departureTime)}</p>
          ) : null}
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-6 pb-16">
        {(data.flights || []).length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Πτήσεις</h2>
            <ul className="space-y-2">
              {(data.flights || []).map((f) => (
                <li key={f.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-bold">
                    {f.airline ? `${f.airline} · ` : ''}
                    {f.flight_number}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">
                    {f.departure_airport} → {f.arrival_airport}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatWhen(f.departure_time)} – {formatWhen(f.arrival_time)}
                    {f.pnr_code ? ` · PNR ${f.pnr_code}` : ''}
                    {f.delay_minutes ? ` · +${f.delay_minutes}′` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Χρονολόγιο</h2>
          {segments.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Δεν υπάρχουν τμήματα.</p>
          ) : (
            <ol className="space-y-3">
              {segments.map((seg, idx) => {
                const meta = SEGMENT_TYPE_OPTIONS.find((o) => o.value === seg.segment_type);
                const risk = riskByTo[seg.id];
                return (
                  <li key={seg.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-slate-500">
                            {meta?.icon || 'route'}
                          </span>
                          {seg.title || meta?.label || seg.segment_type}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                          {[seg.origin_label, seg.destination_label].filter(Boolean).join(' → ') || '—'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatWhen(seg.starts_at)}
                          {seg.vehicle_ref ? ` · ${seg.vehicle_ref}` : ''}
                          {seg.metadata?.address ? ` · ${seg.metadata.address}` : ''}
                        </p>
                        {risk && risk.level !== 'ok' && risk.level !== 'missing' ? (
                          <p
                            className={`mt-2 text-xs font-semibold ${
                              risk.level === 'critical' ? 'text-rose-700' : 'text-amber-700'
                            }`}
                          >
                            {risk.message}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <p className="text-center text-xs text-slate-400">PoreiaGo · μόνο για προβολή</p>
      </main>
    </div>
  );
}
