import { useEffect, useState } from 'react';
import {
  clearRentalDeferredInstallPrompt,
  getRentalDeferredInstallPrompt,
} from '../../lib/rental/registerRentalPwa.js';

function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const excluded = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit && !excluded;
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  );
}

const DISMISS_KEY = 'rental_install_dismissed_v2';

/**
 * @param {{ force?: boolean, compact?: boolean }} props
 * force=true: always show install guidance until the app is installed
 */
export default function RentalInstallPrompt({ force = false, compact = false } = {}) {
  const [deferred, setDeferred] = useState(() => getRentalDeferredInstallPrompt());
  const [showIos, setShowIos] = useState(() => isIosSafari() && !isStandalone());
  const [hidden, setHidden] = useState(() => {
    if (typeof window === 'undefined') return true;
    if (isStandalone()) return true;
    if (force) return false;
    return localStorage.getItem(DISMISS_KEY) === '1';
  });

  useEffect(() => {
    if (isStandalone()) {
      setHidden(true);
      return undefined;
    }
    const sync = () => {
      if (isStandalone()) {
        setHidden(true);
        return;
      }
      const evt = getRentalDeferredInstallPrompt();
      if (evt) {
        setDeferred(evt);
        setShowIos(false);
        if (force) setHidden(false);
      } else if (isIosSafari()) {
        setShowIos(true);
      }
    };
    sync();
    window.addEventListener('rental-pwa-install-available', sync);
    window.addEventListener('rental-pwa-installed', sync);
    window.addEventListener('rental-pwa-sw-ready', sync);
    return () => {
      window.removeEventListener('rental-pwa-install-available', sync);
      window.removeEventListener('rental-pwa-installed', sync);
      window.removeEventListener('rental-pwa-sw-ready', sync);
    };
  }, [force]);

  if (hidden) return null;

  const dismiss = () => {
    if (!force) localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  };

  const install = async () => {
    const promptEvent = deferred || getRentalDeferredInstallPrompt();
    if (!promptEvent) return;
    promptEvent.prompt();
    try {
      await promptEvent.userChoice;
    } catch {
      /* ignore */
    }
    clearRentalDeferredInstallPrompt();
    setDeferred(null);
    dismiss();
  };

  const howto =
    showIos && !deferred
      ? 'iPhone/iPad: πατήστε Share (□↑) → «Προσθήκη στην οθόνη Αφετηρίας».'
      : deferred
        ? 'Εγκαταστήστε την εφαρμογή στην αρχική οθόνη — μία αφή για κράτηση.'
        : 'Android Chrome: μενού ⋮ → «Εγκατάσταση εφαρμογής» ή «Add to Home screen».';

  return (
    <div
      className={`rent-install${compact ? ' rent-install--compact' : ''}`}
      role="region"
      aria-label="Εγκατάσταση εφαρμογής ενοικίασης"
    >
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div className="rent-install-icon" aria-hidden>
          <span className="material-symbols-outlined">install_mobile</span>
        </div>
        <div>
          <p className="rent-install-title">Εγκατάσταση στο κινητό</p>
          <p className="rent-install-text">{howto}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {deferred ? (
          <button type="button" className="rent-btn rent-btn-primary" onClick={install}>
            Εγκατάσταση
          </button>
        ) : null}
        {!force ? (
          <button type="button" className="rent-btn rent-btn-ghost" onClick={dismiss}>
            Όχι τώρα
          </button>
        ) : null}
      </div>
    </div>
  );
}
