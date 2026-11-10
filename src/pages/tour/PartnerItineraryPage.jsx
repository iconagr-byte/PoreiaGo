import { useMemo } from 'react';
import { decodePartnerView } from '../../lib/hybrid/shareTokens.js';
import { SEGMENT_TYPE_OPTIONS } from '../../lib/hybrid/hybridDefaults.js';
import { formatMoney } from '../../lib/currency/multiCurrency.js';

function when(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('el-GR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(v);
  }
}

/**
 * Read-only partner agency itinerary + manifest.
 */
export default function PartnerItineraryPage() {
  const token =
    typeof window !== 'undefined' ? String(window.location.hash || '').replace(/^#/, '') : '';
  const data = useMemo(() => decodePartnerView(token), [token]);

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <p className="font-semibold text-slate-700">Μη έγκυρος partner σύνδεσμος</p>
      </div>
    );
  }

  const segments = [...(data.segments || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const crew = data.crew || {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-200 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-5">
        <div className="max-w-2xl mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Partner agency view</p>
          <h1 className="text-2xl font-bold mt-1">{data.title}</h1>
          {data.departureTime ? <p className="text-sm text-slate-500 mt-1">{when(data.departureTime)}</p> : null}
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6 pb-16">
        {(crew.tourLeader || crew.driverName || crew.guideName) && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Πλήρωμα</h2>
            <ul className="text-sm space-y-1">
              {crew.tourLeader ? <li>Tour leader: <strong>{crew.tourLeader}</strong></li> : null}
              {crew.driverName ? <li>Οδηγός: <strong>{crew.driverName}</strong></li> : null}
              {crew.guideName ? <li>Ξεναγός: <strong>{crew.guideName}</strong></li> : null}
            </ul>
          </section>
        )}

        {(data.flights || []).length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Πτήσεις</h2>
            {(data.flights || []).map((f) => (
              <div key={f.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="font-bold">{f.airline ? `${f.airline} · ` : ''}{f.flight_number}</p>
                <p className="text-sm text-slate-600">{f.departure_airport} → {f.arrival_airport}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {when(f.departure_time)} – {when(f.arrival_time)}
                  {f.pnr_code ? ` · PNR ${f.pnr_code}` : ''}
                </p>
              </div>
            ))}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Χρονολόγιο</h2>
          <ol className="space-y-2">
            {segments.map((seg, idx) => {
              const meta = SEGMENT_TYPE_OPTIONS.find((o) => o.value === seg.segment_type);
              return (
                <li key={seg.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-bold">
                    {idx + 1}. {seg.title || meta?.label || seg.segment_type}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">
                    {[seg.origin_label, seg.destination_label].filter(Boolean).join(' → ') || '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {when(seg.starts_at)}
                    {seg.metadata?.address ? ` · ${seg.metadata.address}` : ''}
                    {seg.metadata?.lat && seg.metadata?.lng
                      ? ` · GPS ${Number(seg.metadata.lat).toFixed(4)},${Number(seg.metadata.lng).toFixed(4)}`
                      : ''}
                  </p>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Manifest ({(data.passengerFlightSeats || []).length})
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Επιβάτης</th>
                  <th className="px-3 py-2">Λεωφ.</th>
                  <th className="px-3 py-2">Αέρας</th>
                  <th className="px-3 py-2">PNR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data.passengerFlightSeats || []).map((s, i) => (
                  <tr key={`${s.passenger_name}-${i}`}>
                    <td className="px-3 py-2 font-medium">{s.passenger_name}</td>
                    <td className="px-3 py-2">{s.ground_seat || '—'}</td>
                    <td className="px-3 py-2">{s.flight_seat || '—'}</td>
                    <td className="px-3 py-2">{s.pnr_code || s.ticket_code || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">Νόμισμα εκδρομής: {formatMoney(0, data.currency).replace(/[\d.,\s]/g, '') || data.currency}</p>
        </section>
      </main>
    </div>
  );
}
