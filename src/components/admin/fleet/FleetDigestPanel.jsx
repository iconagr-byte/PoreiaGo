import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchTelemetrySettings,
  sendFleetDigest,
  updateTelemetrySettings,
} from '../../../services/telemetryApi.js';

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
    return <p className="text-sm text-gray-500">Φόρτωση…</p>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-8 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Ειδοποιήσεις στόλου</h2>
        <p className="text-sm text-gray-500 mt-1">
          Ημερήσιο digest με λήξεις, urgent service και alerts στο email/SMS του γραφείου.
        </p>
      </div>

      <div className="bg-white rounded-[28px] border p-6 space-y-4">
        {[
          { key: 'fleet_digest_enabled', label: 'Ενεργό digest' },
          { key: 'fleet_digest_email_enabled', label: 'Αποστολή email' },
          { key: 'fleet_digest_sms_enabled', label: 'Αποστολή SMS' },
        ].map((row) => (
          <label key={row.key} className="flex items-center justify-between gap-4 text-sm font-bold text-gray-800">
            {row.label}
            <input
              type="checkbox"
              disabled={saving}
              checked={Boolean(settings[row.key])}
              onChange={(e) => patch(row.key, e.target.checked)}
              className="w-5 h-5"
            />
          </label>
        ))}
      </div>

      <div className="bg-white rounded-[28px] border p-6 flex flex-col sm:flex-row gap-4 items-end">
        <label className="text-sm font-bold text-gray-700 flex-1">
          Lookback (ημέρες)
          <input
            type="number"
            min={1}
            max={30}
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 1)}
          />
        </label>
        <button
          type="button"
          disabled={sending}
          onClick={onSend}
          className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">send</span>
          {sending ? 'Αποστολή…' : 'Αποστολή τώρα'}
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Οι παραλήπτες ρυθμίζονται στις ειδοποιήσεις ασφαλείας πληρωμών (admin email / τηλέφωνο).
      </p>
    </div>
  );
}
