import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchDriverPushStatus,
  isDriverPushSupported,
  subscribeDriverPush,
  unsubscribeDriverPush,
} from '../../services/driverPushNotificationApi.js';

/** Ενεργοποίηση push — «Άνοιξε βάρδια» από το γραφείο. */
export default function DriverPushPanel() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = isDriverPushSupported();
    setSupported(ok);
    if (!ok) return;
    fetchDriverPushStatus()
      .then((status) => {
        setEnabled(Boolean(status.enabled));
        setSubscribed(Boolean(status.subscribed));
      })
      .catch(() => {});
  }, []);

  const onSubscribe = async () => {
    setBusy(true);
    try {
      await subscribeDriverPush();
      setSubscribed(true);
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
      {!enabled ? (
        <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-600/30 rounded-xl px-3 py-2">
          Ο server δεν έχει VAPID keys — ζητήστε από τον διαχειριστή.
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
