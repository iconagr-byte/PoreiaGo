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
    <section className="wallet-panel">
      <div className="wallet-panel-head">
        <span className="wallet-panel-head-icon is-sunset" aria-hidden>
          <span className="material-symbols-outlined">notifications_active</span>
        </span>
        <div>
          <h3>Push ειδοποιήσεις (MARK)</h3>
          <p>
            Λάβετε browser ειδοποίηση όταν εκδοθεί φορολογική απόδειξη (myDATA MARK) για κράτηση με
            email <strong>{email}</strong>.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="wallet-empty-copy">Φόρτωση…</p>
      ) : !supported ? (
        <div className="wallet-notice wallet-notice-warn">
          <span className="material-symbols-outlined">warning</span>
          <p>
            Το browser σας δεν υποστηρίζει Web Push ή τρέχετε σε μη ασφαλές περιβάλλον (χρειάζεται
            HTTPS ή localhost).
          </p>
        </div>
      ) : !serverEnabled ? (
        <div className="wallet-notice wallet-notice-muted">
          <span className="material-symbols-outlined">settings</span>
          <p>
            Ο server δεν έχει ρυθμιστεί ακόμα (WEB_PUSH_VAPID_*). Ζητήστε από τον διαχειριστή να
            ενεργοποιήσει Web Push.
          </p>
        </div>
      ) : (
        <div className="wallet-form">
          <div className={`wallet-meta-tile ${subscribed ? 'is-active' : 'is-idle'}`}>
            <p className="wallet-pass-kicker">Κατάσταση</p>
            <p className="wallet-pass-meta-value">{subscribed ? 'Ενεργές' : 'Ανενεργές'}</p>
            {subscribed ? (
              <p className="wallet-field-hint" style={{ marginTop: '0.35rem' }}>
                Συνδεδεμένες συσκευές: <strong>{devices}</strong>
              </p>
            ) : (
              <p className="wallet-field-hint" style={{ marginTop: '0.35rem' }}>
                Ενεργοποιήστε για άμεση ειδοποίηση μετά την έκδοση MARK — χωρίς SMS κόστος.
              </p>
            )}
          </div>

          {subscribed ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleDisable}
              className="wallet-btn wallet-btn-danger"
            >
              Απενεργοποίηση push
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={handleEnable}
              className="wallet-btn wallet-btn-primary"
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
