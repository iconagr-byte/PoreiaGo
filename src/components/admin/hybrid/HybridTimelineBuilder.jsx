import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import FlightManagementModal from './FlightManagementModal.jsx';
import {
  emptySegment,
  SEGMENT_TYPE_OPTIONS,
} from '../../../lib/hybrid/hybridDefaults.js';
import { newClientId } from '../../../lib/hybrid/costYieldCalculator.js';
import { formatMoney } from '../../../lib/currency/multiCurrency.js';
import { pollFlightStatus } from '../../../services/hybridTripApi.js';

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-slate-400';

export default function HybridTimelineBuilder({ formData, setFormData }) {
  const [flightModalOpen, setFlightModalOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState(null);
  const [pollingId, setPollingId] = useState(null);

  const flights = formData.flights || [];
  const segments = useMemo(
    () => [...(formData.segments || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)),
    [formData.segments],
  );

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
      }),
    ]);
  };

  const updateSegment = (id, partial) => {
    setSegments(segments.map((s) => (s.id === id ? { ...s, ...partial } : s)));
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
      patch({
        flights: flights.map((f) =>
          f.id === flight.id
            ? { ...f, status: result.status, delay_minutes: result.delay_minutes }
            : f,
        ),
      });
      toast.success(result.message || 'Ενημέρωση κατάστασης πτήσης');
      if (result.suggested_pickup_adjustment_minutes > 0) {
        toast(
          `Προτεινόμενη μετατόπιση pickup: +${result.suggested_pickup_adjustment_minutes} λεπτά`,
        );
      }
    } catch (err) {
      // Offline / demo: apply local stub delay so UI still works without SaaS token.
      const delay = (String(flight.flight_number || '').length % 4) * 15;
      patch({
        flights: flights.map((f) =>
          f.id === flight.id
            ? { ...f, status: delay ? 'delayed' : 'scheduled', delay_minutes: delay }
            : f,
        ),
      });
      toast(err.message || `Τοπική εκτίμηση καθυστέρησης: +${delay} λεπτά`);
    } finally {
      setPollingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
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
      </div>

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
              return (
                <li key={seg.id} className="relative pl-10">
                  <span className="absolute left-0 top-3 w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
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
                        type="number"
                        min="0"
                        step="0.01"
                        className={fieldClass}
                        value={seg.ground_cost ?? 0}
                        onChange={(e) => updateSegment(seg.id, { ground_cost: e.target.value })}
                        placeholder="Κόστος ground"
                      />
                    </div>
                    {seg.segment_type !== 'flight' && (
                      <input
                        className={fieldClass}
                        value={seg.vehicle_ref || ''}
                        onChange={(e) => updateSegment(seg.id, { vehicle_ref: e.target.value })}
                        placeholder="Όχημα / πινακίδα"
                      />
                    )}
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
