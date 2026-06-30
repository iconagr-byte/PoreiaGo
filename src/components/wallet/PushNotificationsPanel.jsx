import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchPushConfig,
  fetchPushStatus,
  isPushSupported,
  subscribePushNotifications,
  unsubscribePushNotifications,
} from '../../services/pushNotificationApi.js';

export default function PushNotificationsPanel({ email }) {
  const [supported, setSupported] = useState(false);
  const [serverEnabled, setServerEnabled] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [devices, setDevices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const pushSupported = isPushSupported();
      setSupported(pushSupported);
      if (!pushSupported) {
        setLoading(false);
        return;
      }
      try {
        const [config, status] = await Promise.all([
          fetchPushConfig().catch(() => ({ enabled: false })),
          fetchPushStatus().catch(() => ({ subscribed: false, devices: 0 })),
        ]);
        if (cancelled) return;
        setServerEnabled(Boolean(config.enabled && config.public_key));
        setSubscribed(Boolean(status.subscribed));
        setDevices(Number(status.devices || 0));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [email]);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const result = await subscribePushNotifications();
      setSubscribed(true);
      setDevices(Number(result.devices || 1));
      toast.success('Ενεργοποιήθηκαν push ειδοποιήσεις για φορολογικές αποδείξεις');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ενεργοποίησης push');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await unsubscribePushNotifications();
      setSubscribed(false);
      setDevices(0);
      toast.success('Απενεργοποιήθηκαν οι push ειδοποιήσεις');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία απενεργοποίησης push');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-surface-container-lowest rounded-[28px] border border-black/[0.05] shadow-level-2 p-6 md:p-8">
      <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">notifications_active</span>
        Push ειδοποιήσεις (MARK)
      </h3>
      <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
        Λάβετε browser ειδοποίηση όταν εκδοθεί φορολογική απόδειξη (myDATA MARK) για κράτηση με email{' '}
        <strong>{email}</strong>.
      </p>

      {loading ? (
        <p className="text-sm text-on-surface-variant mt-4">Φόρτωση…</p>
      ) : !supported ? (
        <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-900">
          Το browser σας δεν υποστηρίζει Web Push ή τρέχετε σε μη ασφαλές περιβάλλον (χρειάζεται HTTPS ή localhost).
        </div>
      ) : !serverEnabled ? (
        <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
          Ο server δεν έχει ρυθμιστεί ακόμα (WEB_PUSH_VAPID_*). Ζητήστε από τον διαχειριστή να ενεργοποιήσει Web Push.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-surface-container-low px-4 py-3 text-sm">
            <p className="font-bold text-on-surface">
              Κατάσταση: {subscribed ? 'Ενεργές' : 'Ανενεργές'}
            </p>
            {subscribed ? (
              <p className="text-on-surface-variant mt-1">
                Συνδεδεμένες συσκευές: <strong>{devices}</strong>
              </p>
            ) : (
              <p className="text-on-surface-variant mt-1">
                Ενεργοποιήστε για άμεση ειδοποίηση μετά την έκδοση MARK — χωρίς SMS κόστος.
              </p>
            )}
          </div>

          {subscribed ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleDisable}
              className="px-6 py-3 rounded-full border border-rose-200 text-rose-700 font-bold text-sm hover:bg-rose-50 disabled:opacity-60"
            >
              Απενεργοποίηση push
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={handleEnable}
              className="px-6 py-3 rounded-full bg-primary-container text-white font-bold text-sm hover:scale-[0.98] transition-transform disabled:opacity-60 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">notifications</span>
              {busy ? 'Ενεργοποίηση…' : 'Ενεργοποίηση push'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
