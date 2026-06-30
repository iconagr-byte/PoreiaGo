import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createPartnerWebhook,
  deletePartnerWebhook,
  dispatchPartnerEvent,
  fetchPartnerWebhooks,
} from '../../services/growthApi.js';

const EVENT_OPTIONS = [
  { id: 'booking.confirmed', label: 'Κράτηση επιβεβαιώθηκε' },
  { id: 'booking.cancelled', label: 'Ακύρωση' },
  { id: 'passenger.boarded', label: 'Επιβίβαση' },
  { id: 'trip.departed', label: 'Αναχώρηση' },
  { id: 'trip.completed', label: 'Ολοκλήρωση' },
  { id: 'fiscal.receipt_issued', label: 'Φορολογική απόδειξη (MARK)' },
];

export default function PartnerWebhooksPanel() {
  const [subs, setSubs] = useState([]);
  const [form, setForm] = useState({
    partner_name: '',
    target_url: '',
    event_types: ['booking.confirmed'],
  });
  const [loading, setLoading] = useState(true);
  const [testEvent, setTestEvent] = useState('booking.confirmed');

  const reload = useCallback(async () => {
    setLoading(true);
    setSubs(await fetchPartnerWebhooks());
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const onCreate = async (e) => {
    e.preventDefault();
    try {
      await createPartnerWebhook(form);
      toast.success('Webhook εγγράφηκε');
      setForm({ partner_name: '', target_url: '', event_types: ['booking.confirmed'] });
      reload();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    }
  };

  const onTest = async () => {
    const payload =
      testEvent === 'fiscal.receipt_issued'
        ? {
            booking_id: 'B-TEST1',
            pnr: 'BK-TEST1',
            mark: 'MARK-TEST-999',
            amount_eur: 45.5,
            invoice_kind: 'full_payment',
            provider: 'native_aade',
            trip_title: 'Demo Trip',
          }
        : {
            booking_id: 'TEST-001',
            trip_title: 'Demo Trip',
            amount_eur: 45,
          };
    const result = await dispatchPartnerEvent(testEvent, payload);
    if (result) {
      toast.success(`Test dispatch (${testEvent}): ${result.delivered} παραλήπτες`);
    } else {
      toast.error('Αποτυχία test dispatch');
    }
  };

  return (
    <div className="bg-white rounded-[24px] border border-black/[0.06] p-6 shadow-sm space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">hub</span>
            Partner webhooks
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            Ξενοδοχεία, museums, ERP — HMAC header{' '}
            <code className="bg-gray-100 px-1 rounded">X-PoreiaGo-Signature</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={testEvent}
            onChange={(e) => setTestEvent(e.target.value)}
            className="rounded-full border px-3 py-2 text-xs font-bold"
          >
            {EVENT_OPTIONS.map((ev) => (
              <option key={ev.id} value={ev.id}>
                Test: {ev.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onTest}
            className="text-sm font-bold text-primary border border-primary/30 px-4 py-2 rounded-full hover:bg-primary/5"
          >
            Αποστολή test
          </button>
        </div>
      </div>

      <form onSubmit={onCreate} className="grid md:grid-cols-2 gap-3 border-t pt-4">
        <input
          required
          placeholder="Partner name"
          className="rounded-xl border px-3 py-2 text-sm"
          value={form.partner_name}
          onChange={(e) => setForm((p) => ({ ...p, partner_name: e.target.value }))}
        />
        <input
          required
          type="url"
          placeholder="https://partner.example/hooks"
          className="rounded-xl border px-3 py-2 text-sm font-mono"
          value={form.target_url}
          onChange={(e) => setForm((p) => ({ ...p, target_url: e.target.value }))}
        />
        <div className="md:col-span-2 flex flex-wrap gap-2">
          {EVENT_OPTIONS.map((ev) => (
            <label key={ev.id} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={form.event_types.includes(ev.id)}
                onChange={(e) => {
                  setForm((p) => ({
                    ...p,
                    event_types: e.target.checked
                      ? [...p.event_types, ev.id]
                      : p.event_types.filter((x) => x !== ev.id),
                  }));
                }}
              />
              {ev.label}
            </label>
          ))}
        </div>
        <button
          type="submit"
          className="md:col-span-2 px-4 py-2 rounded-full bg-primary text-white text-sm font-bold w-fit"
        >
          Προσθήκη webhook
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Φόρτωση…</p>
      ) : !subs.length ? (
        <p className="text-sm text-gray-500">Δεν υπάρχουν webhooks.</p>
      ) : (
        <ul className="divide-y border rounded-xl overflow-hidden">
          {subs.map((s) => (
            <li key={s.id} className="px-4 py-3 text-sm flex justify-between gap-3">
              <div>
                <p className="font-bold">{s.partner_name}</p>
                <p className="text-xs font-mono text-gray-500 truncate max-w-md">{s.target_url}</p>
                <p className="text-[10px] text-gray-400 mt-1">{s.event_types?.join(', ')}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await deletePartnerWebhook(s.id);
                  toast.success('Διαγράφηκε');
                  reload();
                }}
                className="text-red-600 text-xs font-bold shrink-0"
              >
                Διαγραφή
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
