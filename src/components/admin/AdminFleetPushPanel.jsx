import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchAdminPushStatus,
  isAdminPushSupported,
  subscribeAdminFleetPush,
  unsubscribeAdminFleetPush,
} from '../../services/adminPushNotificationApi.js';

/** Ενεργοποίηση push ειδοποιήσεων όταν οδηγός πάει online/offline. */
export default function AdminFleetPushPanel() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = isAdminPushSupported();
    setSupported(ok);
    if (!ok) return;
    fetchAdminPushStatus()
      .then((status) => {
        setEnabled(Boolean(status.enabled));
        setSubscribed(Boolean(status.subscribed));
      })
      .catch(() => {});
  }, []);

  const onSubscribe = async () => {
    setBusy(true);
    try {
      await subscribeAdminFleetPush();
      setSubscribed(true);
      toast.success('Ειδοποιήσεις στόλου ενεργές — online/offline οδηγών');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ενεργοποίησης');
    } finally {
      setBusy(false);
    }
  };

  const onUnsubscribe = async () => {
    setBusy(true);
    try {
      await unsubscribeAdminFleetPush();
      setSubscribed(false);
      toast.success('Οι ειδοποιήσεις στόλου απενεργοποιήθηκαν');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία απενεργοποίησης');
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-900">Ειδοποιήσεις οδηγών</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Push όταν οδηγός ξεκινά ή τελειώνει βάρδια (GPS PWA)
        </p>
      </div>
      {!enabled ? (
        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">VAPID μη ρυθμισμένο</span>
      ) : subscribed ? (
        <button
          type="button"
          disabled={busy}
          onClick={onUnsubscribe}
          className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
        >
          Απενεργοποίηση
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onSubscribe}
          className="text-xs font-bold px-3 py-2 rounded-xl bg-primary text-white hover:opacity-90"
        >
          {busy ? '…' : 'Ενεργοποίηση push'}
        </button>
      )}
    </div>
  );
}
