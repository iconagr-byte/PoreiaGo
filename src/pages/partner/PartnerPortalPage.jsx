import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getPartnerSession, partnerLogout } from '../../lib/hybrid/partnerPortal.js';
import { loadTrips } from '../../lib/trips/tripStore.js';
import { buildPartnerViewUrl } from '../../lib/hybrid/shareTokens.js';
import { SEGMENT_TYPE_OPTIONS } from '../../lib/hybrid/hybridDefaults.js';

export default function PartnerPortalPage() {
  const navigate = useNavigate();
  const session = getPartnerSession();
  let trips = [];
  if (session) {
    const all = loadTrips();
    trips = session.tripIds?.length
      ? all.filter((t) => session.tripIds.includes(Number(t.id)))
      : all.slice(0, 20);
  }

  if (!session) return <Navigate to="/partner/login" replace />;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Partner portal</p>
            <h1 className="text-lg font-bold">{session.name}</h1>
          </div>
          <button
            type="button"
            className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200"
            onClick={() => {
              partnerLogout();
              navigate('/partner/login');
            }}
          >
            Έξοδος
          </button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto p-4 space-y-4 pb-16">
        {trips.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Δεν έχουν αντιστοιχιστεί εκδρομές σε αυτόν τον συνεργάτη.</p>
        ) : (
          trips.map((trip) => (
            <article key={trip.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold text-lg">{trip.title}</h2>
                  <p className="text-xs text-slate-500">
                    {(trip.flights || []).length} πτήσεις · {(trip.segments || []).length} τμήματα ·{' '}
                    {(trip.passengerFlightSeats || []).length} επιβάτες
                  </p>
                </div>
                <a
                  href={buildPartnerViewUrl(trip)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 text-white"
                >
                  Πλήρες view
                </a>
              </div>
              <ol className="text-sm space-y-1">
                {[...(trip.segments || [])]
                  .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
                  .slice(0, 5)
                  .map((s) => {
                    const meta = SEGMENT_TYPE_OPTIONS.find((o) => o.value === s.segment_type);
                    return (
                      <li key={s.id} className="text-slate-600">
                        {meta?.label || s.segment_type}: {s.title || '—'}
                        {s.metadata?.address ? ` · ${s.metadata.address}` : ''}
                      </li>
                    );
                  })}
              </ol>
              <Link to={`/itinerary/${trip.id}`} className="text-xs font-bold underline text-slate-700">
                Shared itinerary
              </Link>
            </article>
          ))
        )}
      </main>
    </div>
  );
}
