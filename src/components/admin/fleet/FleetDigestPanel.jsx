import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchTelemetrySettings,
  sendFleetDigest,
  updateTelemetrySettings,
} from '../../../services/telemetryApi.js';

const checkClass =
  'h-4 w-4 shrink-0 rounded-[5px] border-slate-300 text-primary accent-primary focus:ring-primary/30';
const pillInputClass =
  'mt-1.5 w-full rounded-full border border-slate-200/90 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15';

export default function FleetDigestPanel() {
  const [settings, setSettings] = useState(null);
  const [days, setDays] = useState(1);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchTelemetrySettings()
      .then(setSettings)
      .catch(() => setSettings({}));
  }, []);

  const patch = async (key, value) => {
    setSaving(true);
    try {
      const next = await updateTelemetrySettings({ [key]: value });
      setSettings(next);
      toast.success('Αποθηκεύτηκε');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onSend = async () => {
    setSending(true);
    try {
      const result = await sendFleetDigest({ days });
      toast.success(
        result?.email_sent || result?.sms_sent
          ? 'Το digest στάλθηκε'
          : 'Το digest συλλέχθηκε (έλεγχος ρυθμίσεων παραληπτών)',
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  if (!settings) {
    return <p className="text-sm text-slate-500">Φόρτωση…</p>;
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-8 max-w-2xl">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
          <span className="material-symbols-outlined text-[24px]">notifications_active</span>
        </span>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Ειδοποιήσεις στόλου</h2>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            Ημερήσιο digest με λήξεις, urgent service και alerts στο email/SMS του γραφείου.
          </p>
        </div>
      </div>

      <div className="rounded-[28px] border border-rose-200/70 bg-gradient-to-b from-rose-50/40 to-white p-5 md:p-6 space-y-3 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        {[
          { key: 'fleet_digest_enabled', label: 'Ενεργό digest', hint: 'Συλλογή ημερήσιου digest' },
          { key: 'fleet_digest_email_enabled', label: 'Αποστολή email', hint: 'Στέλνει digest στο email γραφείου' },
          { key: 'fleet_digest_sms_enabled', label: 'Αποστολή SMS', hint: 'Προαιρετικό SMS για κρίσιμα' },
        ].map((row) => (
          <label
            key={row.key}
            className="flex items-start gap-3 rounded-[20px] border border-slate-200/90 bg-white px-4 py-3.5 cursor-pointer transition hover:border-primary/25"
          >
            <input
              type="checkbox"
              disabled={saving}
              checked={Boolean(settings[row.key])}
              onChange={(e) => patch(row.key, e.target.checked)}
              className={`${checkClass} mt-0.5`}
            />
            <span className="min-w-0">
              <span className="block text-sm font-bold text-slate-800">{row.label}</span>
              <span className="block text-xs text-slate-500 mt-0.5">{row.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="bg-white rounded-[28px] border border-slate-200/70 p-5 md:p-6 flex flex-col sm:flex-row gap-4 items-end shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <label className="text-[13px] font-semibold text-slate-600 flex-1 w-full">
          Lookback (ημέρες)
          <input
            type="number"
            min={1}
            max={30}
            className={pillInputClass}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 1)}
          />
        </label>
        <button
          type="button"
          disabled={sending}
          onClick={onSend}
          className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2 shadow-sm hover:opacity-95"
        >
          <span className="material-symbols-outlined text-sm">send</span>
          {sending ? 'Αποστολή…' : 'Αποστολή digest'}
        </button>
      </div>
    </div>
  );
}
