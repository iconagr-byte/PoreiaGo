import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchAdminPushStatus,
  isAdminPushSupported,
  isThisBrowserAdminPushSubscribed,
  subscribeAdminFleetPush,
  unsubscribeAdminFleetPush,
} from '../../services/adminPushNotificationApi.js';

/** Ενεργοποίηση push ειδοποιήσεων όταν οδηγός πατάει Έναρξη/Τέλος βάρδιας. */
export default function AdminFleetPushPanel({ autoPrompt = true } = {}) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');

  const refresh = async () => {
    const ok = isAdminPushSupported();
    setSupported(ok);
    if (!ok) return;
    const [status, localSub] = await Promise.all([
      fetchAdminPushStatus().catch(() => ({ enabled: false, subscribed: false })),
      isThisBrowserAdminPushSubscribed().catch(() => false),
    ]);
    setEnabled(Boolean(status.enabled));
    // Prefer this browser's subscription — tenant-wide "subscribed" can lie.
    setSubscribed(Boolean(localSub));
    if (status.enabled && !localSub) {
      setHint('Πατήστε «Ενεργοποίηση push» σε αυτόν τον υπολογιστή για ειδοποιήσεις βάρδιας.');
    } else {
      setHint('');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!autoPrompt || !supported || !enabled || subscribed || busy) return undefined;
    const key = 'admin_fleet_push_prompted_v1';
    if (sessionStorage.getItem(key) === '1') return undefined;
    sessionStorage.setItem(key, '1');
    // Soft prompt once per session — required for OS push on Έναρξη βάρδιας.
    const t = window.setTimeout(() => {
      toast(
        (tId) => (
          <span className="text-sm">
            Ενεργοποιήστε push για έναρξη/τέλος βάρδιας.{' '}
            <button
              type="button"
              className="font-bold underline"
              onClick={async () => {
                toast.dismiss(tId);
                setBusy(true);
                try {
                  await subscribeAdminFleetPush();
                  setSubscribed(true);
                  setHint('');
                  toast.success('Push ενεργό — θα ειδοποιείστε στην Έναρξη βάρδιας');
                } catch (err) {
                  toast.error(err.message || 'Αποτυχία ενεργοποίησης');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Ενεργοποίηση
            </button>
          </span>
        ),
        { duration: 12000, id: 'admin-fleet-push-prompt' },
      );
    }, 1200);
    return () => window.clearTimeout(t);
  }, [autoPrompt, supported, enabled, subscribed, busy]);

  const onSubscribe = async () => {
    setBusy(true);
    try {
      await subscribeAdminFleetPush();
      setSubscribed(true);
      setHint('');
      toast.success('Ειδοποιήσεις στόλου ενεργές — Έναρξη/Τέλος βάρδιας');
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
      await refresh();
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
          Push όταν οδηγός πατάει Έναρξη ή Τέλος βάρδιας
        </p>
        {hint ? <p className="text-[11px] text-amber-700 mt-1">{hint}</p> : null}
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
