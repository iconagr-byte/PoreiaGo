import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchAdminPushStatus,
  isAdminPushSupported,
  isThisBrowserAdminPushSubscribed,
  sendAdminPushTest,
  showAdminLocalTestNotification,
  subscribeAdminFleetPush,
  unsubscribeAdminFleetPush,
} from '../../services/adminPushNotificationApi.js';

function isAuthFailure(err) {
  const status = Number(err?.status || 0);
  if (status === 401 || status === 403) return true;
  return /έληξε|συνδεθείτε|unauthorized|missing bearer|invalid token|μη έγκυρη/i.test(
    String(err?.message || ''),
  );
}

/** Ενεργοποίηση / δοκιμή Web Push για το γραφείο. */
export default function AdminFleetPushPanel({ autoPrompt = true } = {}) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const [authExpired, setAuthExpired] = useState(false);
  const [loadError, setLoadError] = useState('');

  const refresh = async () => {
    const ok = isAdminPushSupported();
    setSupported(ok);
    if (!ok) return;
    try {
      const [status, localSub] = await Promise.all([
        fetchAdminPushStatus(),
        isThisBrowserAdminPushSubscribed().catch(() => false),
      ]);
      setAuthExpired(false);
      setLoadError('');
      setEnabled(Boolean(status.enabled));
      setSubscribed(Boolean(localSub));
      if (status.enabled && !localSub) {
        setHint(
          'Το push εμφανίζεται μόνο στη συσκευή όπου το ενεργοποιείτε. Ανοίξτε το γραφείο στο κινητό και πατήστε «Ενεργοποίηση push» εκεί.',
        );
      } else if (status.enabled && localSub) {
        setHint('Ενεργό σε αυτή τη συσκευή — η «Δοκιμή push» πρέπει να εμφανίσει ειδοποίηση εδώ.');
      } else {
        setHint('');
      }
    } catch (err) {
      setEnabled(false);
      setSubscribed(false);
      if (isAuthFailure(err)) {
        setAuthExpired(true);
        setLoadError('');
        setHint('Η σύνδεση έληξε — συνδεθείτε ξανά στο γραφείο.');
      } else {
        setAuthExpired(false);
        setLoadError(String(err?.message || 'Αποτυχία ελέγχου ειδοποιήσεων'));
        setHint('');
      }
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!autoPrompt || !supported || !enabled || subscribed || busy || authExpired) {
      return undefined;
    }
    const key = 'admin_fleet_push_prompted_v1';
    if (sessionStorage.getItem(key) === '1') return undefined;
    sessionStorage.setItem(key, '1');
    const t = window.setTimeout(() => {
      toast(
        (tId) => (
          <span className="text-sm">
            Ενεργοποιήστε τις ειδοποιήσεις.{' '}
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
                  toast.success('Οι ειδοποιήσεις ενεργοποιήθηκαν');
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
  }, [autoPrompt, supported, enabled, subscribed, busy, authExpired]);

  const onSubscribe = async () => {
    setBusy(true);
    try {
      await subscribeAdminFleetPush();
      setSubscribed(true);
      setHint('');
      toast.success('Οι ειδοποιήσεις ενεργοποιήθηκαν');
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
      toast.success('Οι ειδοποιήσεις απενεργοποιήθηκαν');
      await refresh();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία απενεργοποίησης');
    } finally {
      setBusy(false);
    }
  };

  const onTest = async () => {
    setBusy(true);
    try {
      await subscribeAdminFleetPush();
      setSubscribed(true);
      // Immediate banner on THIS device (phone/desktop where you clicked).
      try {
        await showAdminLocalTestNotification();
      } catch {
        /* OS may still show the remote push below */
      }
      const result = await sendAdminPushTest();
      if (result.this_device_sent === false && result.this_device_error) {
        toast.error(`Αυτή η συσκευή απέτυχε: ${String(result.this_device_error).slice(0, 100)}`);
      } else if (result.sent > 0 || result.this_device_sent) {
        toast.success('Δοκιμή OK — κοιτάξτε την ειδοποίηση σε ΑΥΤΗ τη συσκευή');
      } else {
        const detail =
          Array.isArray(result.errors) && result.errors[0]
            ? String(result.errors[0]).slice(0, 120)
            : 'ελέγξτε άδεια ειδοποιήσεων ή ξαναπατήστε Ενεργοποίηση σε αυτή τη συσκευή';
        toast.error(`Δοκιμή: καμία συσκευή δεν έλαβε — ${detail}`);
      }
    } catch (err) {
      toast.error(err.message || 'Αποτυχία δοκιμής push');
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;

  let badge = null;
  if (authExpired) {
    badge = (
      <span className="text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded-lg">
        Συνδεθείτε ξανά
      </span>
    );
  } else if (loadError) {
    badge = (
      <span className="text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded-lg" title={loadError}>
        Σφάλμα ελέγχου
      </span>
    );
  } else if (!enabled) {
    badge = (
      <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
        VAPID μη ρυθμισμένο
      </span>
    );
  } else {
    badge = (
      <div className="flex flex-wrap items-center gap-2">
        {subscribed ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onTest}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-primary text-white hover:opacity-90"
            >
              {busy ? '…' : 'Δοκιμή push'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onUnsubscribe}
              className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
            >
              Απενεργοποίηση
            </button>
          </>
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

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-900">Ειδοποιήσεις</p>
        {hint ? <p className="text-[11px] text-amber-700 mt-1">{hint}</p> : null}
        {loadError && !authExpired ? (
          <p className="text-[11px] text-amber-700 mt-1">{loadError}</p>
        ) : null}
      </div>
      {badge}
    </div>
  );
}
