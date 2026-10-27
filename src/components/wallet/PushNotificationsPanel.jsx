import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { isNativeApp } from '../../lib/capacitor/isNativeApp.js';
import { readStoredFcmToken } from '../../lib/capacitor/nativePush.js';
import {
  fetchPushConfig,
  fetchPushStatus,
  isPushSupported,
  subscribePushNotifications,
  unsubscribePushNotifications,
} from '../../services/pushNotificationApi.js';

/**
 * Customer push panel — Web Push (VAPID) in browser, FCM in Capacitor native apps.
 */
export default function PushNotificationsPanel({ email }) {
  const native = typeof window !== 'undefined' && isNativeApp();
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
        const ok = native
          ? Boolean(config.enabled || config.fcm)
          : Boolean(config.enabled && config.public_key);
        setServerEnabled(ok);
        const localNative = native ? Boolean(readStoredFcmToken()) : false;
        setSubscribed(Boolean(status.subscribed) || localNative);
        setDevices(Number(status.devices || 0));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [email, native]);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const result = await subscribePushNotifications();
      setSubscribed(true);
      setDevices(Number(result.devices || 1));
      toast.success(
        native
          ? 'Ενεργοποιήθηκαν native ειδοποιήσεις'
          : 'Ενεργοποιήθηκαν push ειδοποιήσεις για φορολογικές αποδείξεις',
      );
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
      toast.error(err.message || 'Αποτυχία απενεργοποίησης');
    } finally {
      setBusy(false);
    }
  };

  if (!supported && native) {
    return (
      <section className="wallet-panel">
        <div className="wallet-panel-head">
          <span className="wallet-panel-head-icon is-sunset" aria-hidden>
            <span className="material-symbols-outlined">notifications_active</span>
          </span>
          <div>
            <h3>Push ειδοποιήσεις</h3>
            <p>Χρειάζεται rebuild του APK με το plugin Push Notifications.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="wallet-panel">
      <div className="wallet-panel-head">
        <span className="wallet-panel-head-icon is-sunset" aria-hidden>
          <span className="material-symbols-outlined">notifications_active</span>
        </span>
        <div>
          <h3>{native ? 'Push ειδοποιήσεις (FCM)' : 'Push ειδοποιήσεις (MARK)'}</h3>
          <p>
            {native
              ? 'Native ειδοποιήσεις στο κινητό για αποδείξεις και ενημερώσεις κράτησης.'
              : 'Web Push για φορολογικές αποδείξεις σε αυτό το browser.'}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="wallet-muted text-sm">Έλεγχος…</p>
      ) : !supported ? (
        <div className="wallet-notice wallet-notice-muted">
          <span className="material-symbols-outlined">info</span>
          <p>Το browser δεν υποστηρίζει Web Push.</p>
        </div>
      ) : !serverEnabled && !native ? (
        <div className="wallet-notice wallet-notice-muted">
          <span className="material-symbols-outlined">info</span>
          <p>Οι ειδοποιήσεις δεν είναι ρυθμισμένες ακόμα στον server.</p>
        </div>
      ) : subscribed ? (
        <div className="space-y-2">
          <p className="text-sm text-emerald-700 font-semibold">
            Ενεργές σε αυτή τη συσκευή{devices > 1 ? ` · ${devices} συσκευές` : ''}
          </p>
          <button type="button" className="wallet-btn-secondary" disabled={busy} onClick={handleDisable}>
            {busy ? '…' : 'Απενεργοποίηση'}
          </button>
        </div>
      ) : (
        <button type="button" className="wallet-btn-primary" disabled={busy} onClick={handleEnable}>
          {busy ? '…' : 'Ενεργοποίηση ειδοποιήσεων'}
        </button>
      )}
    </section>
  );
}
