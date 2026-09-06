import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchDriverPushConfig,
  fetchDriverPushStatus,
  isDriverPushSupported,
  isThisBrowserDriverPushSubscribed,
  subscribeDriverPush,
  unsubscribeDriverPush,
} from '../../services/driverPushNotificationApi.js';

/** Ενεργοποίηση push — «Άνοιξε βάρδια» από το γραφείο. */
export default function DriverPushPanel() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(null); // null = loading
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const ok = isDriverPushSupported();
    setSupported(ok);
    if (!ok) return;

    let cancelled = false;
    (async () => {
      try {
        // /config auto-provisions VAPID and does not require a session.
        const [config, localSub] = await Promise.all([
          fetchDriverPushConfig(),
          isThisBrowserDriverPushSubscribed().catch(() => false),
        ]);
        if (cancelled) return;
        setEnabled(Boolean(config.enabled && config.public_key));
        setSubscribed(Boolean(localSub));
        try {
          const status = await fetchDriverPushStatus();
          if (cancelled) return;
          if (status.enabled != null) {
            setEnabled(Boolean(status.enabled));
          }
          // Prefer this browser — tenant-wide "subscribed" can lie across devices.
          if (!localSub && status.subscribed) {
            setSubscribed(false);
          }
        } catch {
          // Session may be cold; still show enable if VAPID is ready.
        }
      } catch (err) {
        if (cancelled) return;
        setEnabled(false);
        setLoadError(err?.message || 'Αποτυχία ελέγχου push');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onSubscribe = async () => {
    setBusy(true);
    try {
      await subscribeDriverPush();
      setSubscribed(true);
      setEnabled(true);
      toast.success('Push ενεργό — θα λαμβάνετε κλήση βάρδιας από το γραφείο');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ενεργοποίησης');
    } finally {
      setBusy(false);
    }
  };

  const onUnsubscribe = async () => {
    setBusy(true);
    try {
      await unsubscribeDriverPush();
      setSubscribed(false);
      toast.success('Push απενεργοποιήθηκε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;

  return (
    <div className="driver-card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-base flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--driver-yellow)]">notifications</span>
            Ειδοποιήσεις βάρδιας
          </h3>
          <p className="text-xs text-[var(--driver-muted)] mt-1 leading-relaxed">
            Το γραφείο μπορεί να σας στείλει «Άνοιξε βάρδια» με ένα πάτημα.
          </p>
        </div>
      </div>
      {enabled === null ? (
        <p className="text-xs text-[var(--driver-muted)] px-1 py-2">Έλεγχος ειδοποιήσεων…</p>
      ) : !enabled ? (
        <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-600/30 rounded-xl px-3 py-2">
          {loadError || 'Οι ειδοποιήσεις δεν είναι διαθέσιμες ακόμα — δοκιμάστε ξανά σε λίγο.'}
        </p>
      ) : subscribed ? (
        <button
          type="button"
          disabled={busy}
          onClick={onUnsubscribe}
          className="w-full py-3 rounded-xl border border-white/15 text-sm font-bold text-[var(--driver-muted)]"
        >
          Απενεργοποίηση push
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onSubscribe}
          className="driver-btn-primary w-full py-3 text-sm"
        >
          {busy ? '…' : 'Ενεργοποίηση push'}
        </button>
      )}
    </div>
  );
}
