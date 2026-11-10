import { useEffect, useState } from 'react';

function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const excluded = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit && !excluded;
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

const DISMISS_KEY = 'wallet_install_dismissed_v1';

export default function WalletInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [showIos, setShowIos] = useState(false);
  const [hidden, setHidden] = useState(() => {
    if (typeof window === 'undefined') return true;
    return isStandalone() || localStorage.getItem(DISMISS_KEY) === '1';
  });

  useEffect(() => {
    if (hidden) return undefined;

    const onBip = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShowIos(false);
    };
    window.addEventListener('beforeinstallprompt', onBip);

    if (!deferred && isIosSafari() && !isStandalone()) {
      setShowIos(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, [hidden, deferred]);

  if (hidden || (!deferred && !showIos)) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    dismiss();
  };

  return (
    <div className="wallet-install" role="region" aria-label="Εγκατάσταση My Wallet">
      <div className="wallet-install-copy">
        <p className="wallet-install-title">Στην αρχική οθόνη</p>
        <p className="wallet-install-text">
          {showIos && !deferred
            ? 'Share → Προσθήκη στην οθόνη Αφετηρίας για offline εισιτήριο.'
            : 'Προσθέστε το My Wallet για γρήγορη πρόσβαση και offline QR.'}
        </p>
      </div>
      <div className="wallet-install-actions">
        {deferred ? (
          <button type="button" className="wallet-btn wallet-btn-primary" onClick={install}>
            Εγκατάσταση
          </button>
        ) : null}
        <button type="button" className="wallet-btn wallet-btn-secondary" onClick={dismiss}>
          Όχι τώρα
        </button>
      </div>
    </div>
  );
}
