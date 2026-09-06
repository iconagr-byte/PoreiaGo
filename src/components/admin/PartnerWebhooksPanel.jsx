import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createPartnerWebhook,
  deletePartnerWebhook,
  dispatchPartnerEvent,
  fetchPartnerWebhooks,
} from '../../services/growthApi.js';

const EVENT_OPTIONS = [
  { id: 'booking.confirmed', label: 'Κράτηση επιβεβαιώθηκε', icon: 'event_available', hint: 'Νέα επιβεβαιωμένη κράτηση' },
  { id: 'booking.cancelled', label: 'Ακύρωση', icon: 'event_busy', hint: 'Ακύρωση κράτησης' },
  { id: 'passenger.boarded', label: 'Επιβίβαση', icon: 'airline_seat_recline_normal', hint: 'Επιβάτης επιβιβάστηκε' },
  { id: 'trip.departed', label: 'Αναχώρηση', icon: 'departure_board', hint: 'Το δρομολόγιο ξεκίνησε' },
  { id: 'trip.completed', label: 'Ολοκλήρωση', icon: 'flag', hint: 'Το δρομολόγιο ολοκληρώθηκε' },
  { id: 'fiscal.receipt_issued', label: 'Φορολογική απόδειξη', icon: 'receipt_long', hint: 'MARK / myDATA' },
];

const EVENT_LABEL = Object.fromEntries(EVENT_OPTIONS.map((e) => [e.id, e.label]));

function formatWhen(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function copyText(text, okMsg) {
  if (!navigator.clipboard?.writeText) {
    toast.error('Αντιγραφή μη διαθέσιμη');
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => toast.success(okMsg),
    () => toast.error('Αποτυχία αντιγραφής'),
  );
}

export default function PartnerWebhooksPanel() {
  const [subs, setSubs] = useState([]);
  const [form, setForm] = useState({
    partner_name: '',
    target_url: '',
    event_types: ['booking.confirmed'],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [testEvent, setTestEvent] = useState('booking.confirmed');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSubs(await fetchPartnerWebhooks());
    } catch {
      setSubs([]);
      toast.error('Αποτυχία φόρτωσης webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const matchingTestCount = useMemo(
    () =>
      subs.filter(
        (s) => s.active !== false && (s.event_types || []).includes(testEvent),
      ).length,
    [subs, testEvent],
  );

  const toggleEvent = (id) => {
    setForm((p) => {
      const has = p.event_types.includes(id);
      if (has && p.event_types.length === 1) {
        toast.error('Επιλέξτε τουλάχιστον ένα συμβάν');
        return p;
      }
      return {
        ...p,
        event_types: has ? p.event_types.filter((x) => x !== id) : [...p.event_types, id],
      };
    });
  };

  const selectAllEvents = () => {
    setForm((p) => ({ ...p, event_types: EVENT_OPTIONS.map((e) => e.id) }));
  };

  const selectCoreEvents = () => {
    setForm((p) => ({
      ...p,
      event_types: ['booking.confirmed', 'booking.cancelled'],
    }));
  };

  const onCreate = async (e) => {
    e.preventDefault();
    if (!form.event_types.length) {
      toast.error('Επιλέξτε τουλάχιστον ένα συμβάν');
      return;
    }
    setSaving(true);
    try {
      await createPartnerWebhook({
        partner_name: form.partner_name.trim(),
        target_url: form.target_url.trim(),
        event_types: form.event_types,
      });
      toast.success('Το webhook προστέθηκε');
      setForm({ partner_name: '', target_url: '', event_types: ['booking.confirmed'] });
      await reload();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id, name) => {
    if (!window.confirm(`Διαγραφή webhook για «${name}»;`)) return;
    setDeletingId(id);
    try {
      await deletePartnerWebhook(id);
      toast.success('Διαγράφηκε');
      await reload();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία διαγραφής');
    } finally {
      setDeletingId(null);
    }
  };

  const onTest = async () => {
    setTesting(true);
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
    try {
      const result = await dispatchPartnerEvent(testEvent, payload);
      if (result) {
        toast.success(
          `Test «${EVENT_LABEL[testEvent] || testEvent}»: ${result.delivered} παραλήπτες`,
        );
      } else {
        toast.error('Αποτυχία test dispatch');
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Intro */}
      <section className="overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-black/[0.04] bg-gradient-to-r from-slate-50 via-white to-sky-50/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-3 min-w-0">
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
              <span className="material-symbols-outlined text-[22px]">hub</span>
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-[17px] leading-tight">
                Partner webhooks
              </h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">
                Ειδοποιήσεις σε ξενοδοχεία, museums και ERP όταν αλλάζει μια κράτηση ή
                δρομολόγιο. Κάθε αίτημα υπογράφεται με HMAC.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600">
              <span className="material-symbols-outlined text-[14px] text-primary">link</span>
              {loading ? '…' : `${subs.length} ενεργά`}
            </span>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              Ανανέωση
            </button>
          </div>
        </div>
        <div className="px-5 py-3.5 sm:px-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-emerald-600">verified_user</span>
            Header{' '}
            <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
              X-PoreiaGo-Signature
            </code>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-sky-600">bolt</span>
            Event{' '}
            <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
              X-PoreiaGo-Event
            </code>
          </span>
        </div>
      </section>

      {/* List */}
      <section className="overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-black/[0.04] px-5 py-3.5 sm:px-6">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">playlist_add_check</span>
            Εγγεγραμμένα endpoints
          </h4>
          {!loading && subs.length > 0 ? (
            <span className="text-[11px] font-bold text-slate-400">{subs.length}</span>
          ) : null}
        </div>

        {loading ? (
          <div className="px-5 py-12 sm:px-6 text-center">
            <span className="material-symbols-outlined text-3xl text-slate-300 animate-pulse">
              progress_activity
            </span>
            <p className="mt-2 text-sm text-slate-500">Φόρτωση webhooks…</p>
          </div>
        ) : !subs.length ? (
          <div className="px-5 py-12 sm:px-6 text-center max-w-md mx-auto">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 text-slate-400">
              <span className="material-symbols-outlined text-[28px]">webhook</span>
            </span>
            <p className="mt-3 text-sm font-bold text-slate-800">Δεν υπάρχουν webhooks ακόμα</p>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
              Προσθέστε το URL του partner παρακάτω και επιλέξτε ποια συμβάντα θέλετε να
              λαμβάνει. Μετά μπορείτε να στείλετε test payload.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {subs.map((s) => {
              const when = formatWhen(s.created_at);
              return (
                <li
                  key={s.id}
                  className="px-5 py-4 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900 text-sm">{s.partner_name}</p>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          s.active === false
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {s.active === false ? 'Ανενεργό' : 'Ενεργό'}
                      </span>
                      {when ? (
                        <span className="text-[10px] text-slate-400 font-medium">{when}</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-xs font-mono text-slate-500 truncate" title={s.target_url}>
                        {s.target_url}
                      </p>
                      <button
                        type="button"
                        onClick={() => copyText(s.target_url, 'URL αντιγράφηκε')}
                        className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5"
                        title="Αντιγραφή URL"
                        aria-label="Αντιγραφή URL"
                      >
                        <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(s.event_types || []).map((ev) => (
                        <span
                          key={ev}
                          className="inline-flex items-center rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600"
                          title={ev}
                        >
                          {EVENT_LABEL[ev] || ev}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={deletingId === s.id}
                    onClick={() => onDelete(s.id, s.partner_name)}
                    className="inline-flex items-center gap-1 self-start shrink-0 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    {deletingId === s.id ? 'Διαγραφή…' : 'Διαγραφή'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Add form */}
      <section className="overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-sm">
        <div className="border-b border-black/[0.04] bg-gradient-to-r from-primary/[0.04] to-white px-5 py-3.5 sm:px-6">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">add_circle</span>
            Νέο webhook
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Όνομα partner, HTTPS endpoint και τα συμβάντα που θα λαμβάνει.
          </p>
        </div>

        <form onSubmit={onCreate} className="p-5 sm:p-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-bold text-slate-800">Όνομα partner</span>
              <p className="mt-0.5 text-xs text-slate-500">π.χ. Hotel Athena, Museum ERP</p>
              <input
                required
                minLength={2}
                placeholder="Hotel Athena"
                className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                value={form.partner_name}
                onChange={(e) => setForm((p) => ({ ...p, partner_name: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-800">Webhook URL</span>
              <p className="mt-0.5 text-xs text-slate-500">HTTPS endpoint που δέχεται POST</p>
              <input
                required
                type="url"
                placeholder="https://partner.example/hooks"
                className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                value={form.target_url}
                onChange={(e) => setForm((p) => ({ ...p, target_url: e.target.value }))}
              />
            </label>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div>
                <p className="text-sm font-bold text-slate-800">Συμβάντα</p>
                <p className="text-xs text-slate-500">
                  Επιλεγμένα: {form.event_types.length} / {EVENT_OPTIONS.length}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={selectCoreEvents}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
                >
                  Κράτηση + Ακύρωση
                </button>
                <button
                  type="button"
                  onClick={selectAllEvents}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
                >
                  Όλα
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {EVENT_OPTIONS.map((ev) => {
                const on = form.event_types.includes(ev.id);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => toggleEvent(ev.id)}
                    aria-pressed={on}
                    className={`flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                      on
                        ? 'border-primary/30 bg-primary/[0.06] shadow-sm'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-white'
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        on ? 'bg-primary text-white' : 'bg-white text-slate-400 border border-slate-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{ev.icon}</span>
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-xs font-bold ${on ? 'text-primary' : 'text-slate-800'}`}>
                        {ev.label}
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5 leading-snug">
                        {ev.hint}
                      </span>
                    </span>
                    <span
                      className={`ml-auto mt-1 shrink-0 material-symbols-outlined text-[18px] ${
                        on ? 'text-primary' : 'text-slate-300'
                      }`}
                    >
                      {on ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-60 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {saving ? 'Αποθήκευση…' : 'Προσθήκη webhook'}
            </button>
            <p className="text-[11px] text-slate-400">
              Το endpoint πρέπει να απαντά 2xx εντός ~10 δευτ.
            </p>
          </div>
        </form>
      </section>

      {/* Test */}
      <section className="overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-sm">
        <div className="border-b border-black/[0.04] px-5 py-3.5 sm:px-6">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-amber-600">science</span>
            Δοκιμαστική αποστολή
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Στέλνει demo payload σε όλα τα ενεργά endpoints που έχουν επιλέξει το συμβάν.
          </p>
        </div>
        <div className="p-5 sm:p-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 min-w-0">
            <span className="text-sm font-bold text-slate-800">Συμβάν test</span>
            <select
              value={testEvent}
              onChange={(e) => setTestEvent(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {EVENT_OPTIONS.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${
                matchingTestCount > 0
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : 'bg-amber-50 text-amber-800 border border-amber-100'
              }`}
            >
              {matchingTestCount > 0
                ? `${matchingTestCount} παραλήπτες`
                : 'Κανένας παραλήπτης'}
            </span>
            <button
              type="button"
              onClick={onTest}
              disabled={testing || matchingTestCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-primary/30 text-primary text-sm font-bold hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              {testing ? 'Αποστολή…' : 'Αποστολή test'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
