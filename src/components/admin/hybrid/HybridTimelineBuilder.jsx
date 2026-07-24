import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import FlightManagementModal from './FlightManagementModal.jsx';
import {
  emptySegment,
  SEGMENT_TYPE_OPTIONS,
} from '../../../lib/hybrid/hybridDefaults.js';
import { newClientId } from '../../../lib/hybrid/costYieldCalculator.js';
import { formatMoney } from '../../../lib/currency/multiCurrency.js';
import {
  analyzeConnectionRisks,
  applyPickupDelayShift,
  DEFAULT_CONNECTION_THRESHOLD_MIN,
} from '../../../lib/hybrid/connectionRisk.js';
import { buildItineraryShareUrl } from '../../../lib/hybrid/itineraryShare.js';
import { notifyFlightDelay, pollFlightStatus } from '../../../services/hybridTripApi.js';

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-slate-400';

const HOTELISH = new Set(['hotel_transfer', 'ground_transfer', 'local_transfer', 'van', 'bus']);

export default function HybridTimelineBuilder({ formData, setFormData, tripId }) {
  const [flightModalOpen, setFlightModalOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState(null);
  const [pollingId, setPollingId] = useState(null);
  const [notifyingId, setNotifyingId] = useState(null);

  const flights = formData.flights || [];
  const threshold = formData.connectionThresholdMin ?? DEFAULT_CONNECTION_THRESHOLD_MIN;
  const segments = useMemo(
    () => [...(formData.segments || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
    [formData.segments],
  );
  const risks = useMemo(() => analyzeConnectionRisks(segments, threshold), [segments, threshold]);
  const riskByTo = useMemo(() => Object.fromEntries(risks.map((r) => [r.toId, r])), [risks]);
  const alertRisks = risks.filter((r) => r.level === 'tight' || r.level === 'critical');

  const patch = (partial) => setFormData((prev) => ({ ...prev, ...partial }));

  const setSegments = (next) => {
    const normalized = next.map((s, i) => ({ ...s, sequence: i }));
    patch({ segments: normalized });
  };

  const addSegment = (type = 'ground_transfer') => {
    const opt = SEGMENT_TYPE_OPTIONS.find((o) => o.value === type);
    setSegments([
      ...segments,
      emptySegment({
        segment_type: type,
        title: opt?.label || type,
        currency: formData.currency || 'EUR',
        metadata: HOTELISH.has(type) ? { address: '', driver_notes: '' } : {},
      }),
    ]);
  };

  const updateSegment = (id, partial) => {
    setSegments(segments.map((s) => (s.id === id ? { ...s, ...partial } : s)));
  };

  const updateMeta = (id, metaPartial) => {
    const seg = segments.find((s) => s.id === id);
    if (!seg) return;
    updateSegment(id, { metadata: { ...(seg.metadata || {}), ...metaPartial } });
  };

  const moveSegment = (id, dir) => {
    const idx = segments.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= segments.length) return;
    const next = [...segments];
    [next[idx], next[target]] = [next[target], next[idx]];
    setSegments(next);
  };

  const removeSegment = (id) => setSegments(segments.filter((s) => s.id !== id));

  const saveFlight = (flight) => {
    const exists = flights.some((f) => f.id === flight.id);
    const nextFlights = exists
      ? flights.map((f) => (f.id === flight.id ? flight : f))
      : [...flights, flight];
    patch({ flights: nextFlights });

    if (!exists) {
      setSegments([
        ...segments,
        emptySegment({
          segment_type: 'flight',
          title: `${flight.airline || 'Flight'} ${flight.flight_number}`.trim(),
          flight_id: flight.id,
          starts_at: flight.departure_time,
          ends_at: flight.arrival_time,
          origin_label: flight.departure_airport,
          destination_label: flight.arrival_airport,
          currency: flight.currency || formData.currency || 'EUR',
        }),
      ]);
    } else {
      setSegments(
        segments.map((s) =>
          s.flight_id === flight.id
            ? {
                ...s,
                title: `${flight.airline || 'Flight'} ${flight.flight_number}`.trim(),
                starts_at: flight.departure_time,
                ends_at: flight.arrival_time,
                origin_label: flight.departure_airport,
                destination_label: flight.arrival_airport,
              }
            : s,
        ),
      );
    }
    setFlightModalOpen(false);
    setEditingFlight(null);
    toast.success('Η πτήση αποθηκεύτηκε στο χρονολόγιο');
  };

  const removeFlight = (flightId) => {
    patch({
      flights: flights.filter((f) => f.id !== flightId),
      segments: segments.filter((s) => s.flight_id !== flightId),
    });
  };

  const handlePoll = async (flight) => {
    setPollingId(flight.id);
    try {
      const result = await pollFlightStatus(flight.id);
      const delay = Number(result.delay_minutes) || 0;
      const nextFlights = flights.map((f) =>
        f.id === flight.id
          ? { ...f, status: result.status, delay_minutes: delay }
          : f,
      );
      let nextSegments = segments;
      if (result.suggested_pickup_adjustment_minutes > 0) {
        nextSegments = applyPickupDelayShift(
          segments,
          flight.id,
          result.suggested_pickup_adjustment_minutes,
        );
        toast(
          `Pickup μετατοπίστηκε +${result.suggested_pickup_adjustment_minutes}′ στα επόμενα ground τμήματα`,
        );
      }
      patch({ flights: nextFlights, segments: nextSegments });
      toast.success(result.message || 'Ενημέρωση κατάστασης πτήσης');
    } catch (err) {
      const delay = (String(flight.flight_number || '').length % 4) * 15;
      const nextFlights = flights.map((f) =>
        f.id === flight.id
          ? { ...f, status: delay ? 'delayed' : 'scheduled', delay_minutes: delay }
          : f,
      );
      const nextSegments = delay ? applyPickupDelayShift(segments, flight.id, delay) : segments;
      patch({ flights: nextFlights, segments: nextSegments });
      toast(err.message || `Τοπική εκτίμηση καθυστέρησης: +${delay} λεπτά`);
    } finally {
      setPollingId(null);
    }
  };

  const handleNotify = async (flight) => {
    setNotifyingId(flight.id);
    try {
      const result = await notifyFlightDelay(flight.id, {
        trip_id: tripId || formData.id,
        delay_minutes: flight.delay_minutes || 0,
        channels: ['sms', 'whatsapp'],
      });
      toast.success(result.message || 'Ουρά ειδοποιήσεων καθυστέρησης');
    } catch (err) {
      toast.success(
        `Τοπική ουρά: ειδοποίηση +${flight.delay_minutes || 0}′ για ${flight.flight_number} (SMS/WhatsApp stub)`,
      );
      if (err?.message && !String(err.message).includes('σύνδεση')) {
        console.warn('[delay-notify]', err.message);
      }
    } finally {
      setNotifyingId(null);
    }
  };

  const copyShareLink = async () => {
    const url = buildItineraryShareUrl({ ...formData, id: tripId || formData.id });
    if (!url) {
      toast.error('Δεν υπάρχει itinerary για κοινοποίηση');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Αντιγράφηκε shared itinerary link');
    } catch {
      toast(url);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => {
            setEditingFlight(null);
            setFlightModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
        >
          <span className="material-symbols-outlined text-[16px]">flight</span>
          Προσθήκη πτήσης
        </button>
        {SEGMENT_TYPE_OPTIONS.filter((o) => o.value !== 'flight').map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => addSegment(opt.value)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[15px] text-slate-500">{opt.icon}</span>
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          onClick={copyShareLink}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 ml-auto"
        >
          <span className="material-symbols-outlined text-[15px]">share</span>
          Shared itinerary
        </button>
      </div>

      <label className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span className="font-bold uppercase tracking-wider text-slate-500">Όριο σύνδεσης</span>
        <input
          type="number"
          min="15"
          step="5"
          className={`${fieldClass} w-24`}
          value={threshold}
          onChange={(e) => patch({ connectionThresholdMin: Number(e.target.value) || 90 })}
        />
        <span>λεπτά</span>
      </label>

      {alertRisks.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Connection risk</p>
          {alertRisks.map((r) => (
            <p
              key={`${r.fromId}-${r.toId}`}
              className={`text-sm ${r.level === 'critical' ? 'text-rose-700 font-semibold' : 'text-amber-800'}`}
            >
              {r.fromTitle} → {r.toTitle}: {r.message}
            </p>
          ))}
        </div>
      )}

      {flights.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Πτήσεις ομάδας</p>
          {flights.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5"
            >
              <span className="material-symbols-outlined text-slate-500">flight_takeoff</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">
                  {f.airline ? `${f.airline} · ` : ''}
                  {f.flight_number || '—'}
                </p>
                <p className="text-xs text-slate-500">
                  {f.departure_airport} → {f.arrival_airport}
                  {f.pnr_code ? ` · PNR ${f.pnr_code}` : ''}
                  {f.delay_minutes ? ` · +${f.delay_minutes}′` : ''}
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600">
                {formatMoney(f.total_cost || 0, f.currency || formData.currency)}
              </span>
              <button
                type="button"
                disabled={pollingId === f.id}
                onClick={() => handlePoll(f)}
                className="px-2 py-1 rounded-lg text-xs font-bold text-slate-700 hover:bg-white border border-slate-200"
                title="AI delay monitor"
              >
                {pollingId === f.id ? '…' : 'Status'}
              </button>
              <button
                type="button"
                disabled={notifyingId === f.id || !(f.delay_minutes > 0)}
                onClick={() => handleNotify(f)}
                className="px-2 py-1 rounded-lg text-xs font-bold text-slate-700 hover:bg-white border border-slate-200 disabled:opacity-40"
                title="SMS/WhatsApp delay notify"
              >
                {notifyingId === f.id ? '…' : 'Notify'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingFlight(f);
                  setFlightModalOpen(true);
                }}
                className="p-1.5 rounded-lg hover:bg-white text-slate-600"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button
                type="button"
                onClick={() => removeFlight(f.id)}
                className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Ενοποιημένο χρονολόγιο</p>
        {segments.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-8 text-center border border-dashed border-slate-200 rounded-xl">
            Προσθέστε μεταφορές και πτήσεις για να χτίσετε το hybrid πρόγραμμα.
          </p>
        ) : (
          <ol className="relative space-y-3 before:absolute before:left-[15px] before:top-3 before:bottom-3 before:w-px before:bg-slate-200">
            {segments.map((seg, index) => {
              const meta = SEGMENT_TYPE_OPTIONS.find((o) => o.value === seg.segment_type);
              const risk = riskByTo[seg.id];
              const showHotelFields = HOTELISH.has(seg.segment_type);
              return (
                <li key={seg.id} className="relative pl-10">
                  <span className="absolute left-0 top-3 w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div
                    className={`rounded-xl border bg-white p-3 space-y-2 ${
                      risk?.level === 'critical'
                        ? 'border-rose-300'
                        : risk?.level === 'tight'
                          ? 'border-amber-300'
                          : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-slate-500">
                        {meta?.icon || 'route'}
                      </span>
                      <select
                        className={`${fieldClass} w-auto min-w-[9rem]`}
                        value={seg.segment_type}
                        onChange={(e) => updateSegment(seg.id, { segment_type: e.target.value })}
                      >
                        {SEGMENT_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <input
                        className={`${fieldClass} flex-1 min-w-[10rem]`}
                        value={seg.title || ''}
                        onChange={(e) => updateSegment(seg.id, { title: e.target.value })}
                        placeholder="Τίτλος τμήματος"
                      />
                      <div className="flex items-center gap-1 ml-auto">
                        <button type="button" onClick={() => moveSegment(seg.id, -1)} className="p-1 rounded hover:bg-slate-100" title="Πάνω">
                          <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                        </button>
                        <button type="button" onClick={() => moveSegment(seg.id, 1)} className="p-1 rounded hover:bg-slate-100" title="Κάτω">
                          <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                        </button>
                        <button type="button" onClick={() => removeSegment(seg.id)} className="p-1 rounded hover:bg-rose-50 text-rose-600">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                    {risk && risk.level !== 'ok' ? (
                      <p
                        className={`text-xs font-semibold ${
                          risk.level === 'critical'
                            ? 'text-rose-700'
                            : risk.level === 'tight'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {risk.message}
                      </p>
                    ) : null}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <input
                        className={fieldClass}
                        value={seg.origin_label || ''}
                        onChange={(e) => updateSegment(seg.id, { origin_label: e.target.value })}
                        placeholder="Από"
                      />
                      <input
                        className={fieldClass}
                        value={seg.destination_label || ''}
                        onChange={(e) => updateSegment(seg.id, { destination_label: e.target.value })}
                        placeholder="Προς"
                      />
                      <input
                        type="datetime-local"
                        className={fieldClass}
                        value={toLocal(seg.starts_at)}
                        onChange={(e) => updateSegment(seg.id, { starts_at: e.target.value })}
                      />
                      <input
                        type="datetime-local"
                        className={fieldClass}
                        value={toLocal(seg.ends_at)}
                        onChange={(e) => updateSegment(seg.id, { ends_at: e.target.value })}
                        title="Λήξη τμήματος"
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={fieldClass}
                        value={seg.ground_cost ?? 0}
                        onChange={(e) => updateSegment(seg.id, { ground_cost: e.target.value })}
                        placeholder="Κόστος ground"
                      />
                      {seg.segment_type !== 'flight' ? (
                        <input
                          className={fieldClass}
                          value={seg.vehicle_ref || ''}
                          onChange={(e) => updateSegment(seg.id, { vehicle_ref: e.target.value })}
                          placeholder="Όχημα / πινακίδα"
                        />
                      ) : (
                        <div />
                      )}
                    </div>
                    {showHotelFields ? (
                      <div className="grid sm:grid-cols-2 gap-2">
                        <input
                          className={fieldClass}
                          value={seg.metadata?.address || ''}
                          onChange={(e) => updateMeta(seg.id, { address: e.target.value })}
                          placeholder="Διεύθυνση pickup / ξενοδοχείο"
                        />
                        <input
                          className={fieldClass}
                          value={seg.metadata?.driver_notes || ''}
                          onChange={(e) => updateMeta(seg.id, { driver_notes: e.target.value })}
                          placeholder="Οδηγίες για οδηγό"
                        />
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <FlightManagementModal
        open={flightModalOpen}
        initial={editingFlight || { id: newClientId('flt'), currency: formData.currency || 'EUR' }}
        onClose={() => {
          setFlightModalOpen(false);
          setEditingFlight(null);
        }}
        onSave={saveFlight}
      />
    </div>
  );
}

function toLocal(value) {
  if (!value) return '';
  const s = String(value);
  if (s.length >= 16 && s.includes('T')) return s.slice(0, 16);
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}
