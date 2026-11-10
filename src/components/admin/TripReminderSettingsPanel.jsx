import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DEFAULT_TRIP_REMINDER,
  fetchTripReminderSettings,
  updateTripReminderSettings,
} from '../../services/platformApi.js';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400';

export default function TripReminderSettingsPanel() {
  const [form, setForm] = useState(DEFAULT_TRIP_REMINDER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setForm(await fetchTripReminderSettings());
      setDirty(false);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await updateTripReminderSettings(form);
      setForm(saved);
      setDirty(false);
      toast.success('Αποθηκεύτηκε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        Φόρτωση…
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Υπενθύμιση εκδρομής</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Αυτόματο email πριν την αναχώρηση · placeholders {'{trip}'} {'{days}'} {'{office}'}
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
          <input
            type="checkbox"
            checked={Boolean(form.enabled)}
            onChange={(e) => patch('enabled', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Ενεργό
        </label>
      </div>

      <form onSubmit={onSave} className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Μέρες πριν
            </span>
            <input
              type="number"
              min={1}
              max={30}
              value={form.days_before ?? 3}
              onChange={(e) => patch('days_before', Number(e.target.value) || 3)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Ώρα αποστολής (Αθήνα)
            </span>
            <input
              type="number"
              min={0}
              max={23}
              value={form.send_hour ?? 9}
              onChange={(e) => patch('send_hour', Number(e.target.value))}
              className={inputClass}
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Θέμα
          </span>
          <input
            type="text"
            value={form.subject || ''}
            onChange={(e) => patch('subject', e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Τίτλος
          </span>
          <input
            type="text"
            value={form.headline || ''}
            onChange={(e) => patch('headline', e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Κείμενο
          </span>
          <textarea
            rows={3}
            value={form.body || ''}
            onChange={(e) => patch('body', e.target.value)}
            className={`${inputClass} resize-y`}
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            {form.enabled
              ? `Στέλνει ${form.days_before || 3} μέρες πριν · ώρα ${form.send_hour ?? 9}:00`
              : 'Ανενεργό — δεν στέλνονται υπενθυμίσεις'}
          </p>
          <button
            type="submit"
            disabled={saving || !dirty}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
        </div>
      </form>
    </section>
  );
}
