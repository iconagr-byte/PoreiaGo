import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useGoogleAuthConfig } from '../components/GoogleAuthRoot.jsx';
import { nativeGoogleReturnUrl } from '../lib/capacitor/nativeGoogleBridge.js';
import { isNativeApp } from '../lib/capacitor/isNativeApp.js';
import '../styles/wallet-pass.css';

/**
 * Runs Google GIS on an allowlisted office origin (e.g. achilliotravel.com),
 * then returns the ID token to the Capacitor WebView at https://localhost.
 */
export default function WalletNativeGoogleBridgePage() {
  const [params] = useSearchParams();
  const { loading, enabled, clientId } = useGoogleAuthConfig();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const mode = params.get('mode') === 'signup' ? 'signup' : 'signin';
  const returnPath = useMemo(() => {
    const raw = String(params.get('return') || '').trim();
    if (raw === '/register' || raw.startsWith('/register')) return '/register';
    if (raw === '/login' || raw.startsWith('/login')) return '/login';
    return mode === 'signup' ? '/register' : '/login';
  }, [params, mode]);

  const finish = useCallback(
    (credential) => {
      if (!credential) {
        setError('Δεν ελήφθη διαπιστευτήριο Google');
        setBusy(false);
        return;
      }
      setBusy(true);
      // Hand token back into the packaged Capacitor origin.
      window.location.replace(nativeGoogleReturnUrl(returnPath, credential));
    },
    [returnPath],
  );

  useEffect(() => {
    document.documentElement.dataset.poreiagoApp = 'wallet';
  }, []);

  // If someone opens this URL in a normal browser, still allow GIS — then send them home.
  const onWebFallback = useCallback(
    (credential) => {
      if (!credential) return;
      if (isNativeApp()) {
        finish(credential);
        return;
      }
      window.location.replace(`${returnPath}`);
    },
    [finish, returnPath],
  );

  return (
    <div className="wallet-auth-stage wallet-auth-stage--native min-h-dvh bg-white">
      <div className="wallet-auth-shell mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-8 text-center">
          <span
            className="material-symbols-outlined mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0071e3] text-[28px] text-white"
            aria-hidden
          >
            account_balance_wallet
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">My Wallet</h1>
          <p className="mt-2 text-sm text-[#6e6e73]">
            {mode === 'signup' ? 'Εγγραφή με Google' : 'Σύνδεση με Google'}
          </p>
        </div>

        {loading ? (
          <p className="text-center text-sm text-[#6e6e73]">Φόρτωση Google…</p>
        ) : null}

        {!loading && !enabled ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Το Google Sign-In δεν είναι ρυθμισμένο στον server. Δοκιμάστε σύνδεση με email.
          </p>
        ) : null}

        {error ? (
          <p className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        {enabled && clientId ? (
          <div className="flex flex-col items-center gap-4 py-2">
            <GoogleLogin
              onSuccess={(response) => {
                const cred = response?.credential;
                if (isNativeApp()) finish(cred);
                else onWebFallback(cred);
              }}
              onError={() => {
                setBusy(false);
                setError(
                  'Η σύνδεση με Google απέτυχε. Αν βλέπετε origin_mismatch, προσθέστε https://localhost στο Google Cloud Console (Authorized JavaScript origins).',
                );
              }}
              theme="outline"
              size="large"
              text={mode === 'signup' ? 'signup_with' : 'signin_with'}
              shape="pill"
              locale="el"
              width="320"
              useOneTap={false}
            />
            {busy ? (
              <p className="text-sm text-[#6e6e73]">Επιστροφή στο Wallet…</p>
            ) : null}
          </div>
        ) : null}

        <p className="mt-8 text-center text-sm text-[#6e6e73]">
          <Link to={returnPath} className="font-semibold text-[#0071e3]">
            Πίσω στη σύνδεση με email
          </Link>
        </p>
      </div>
    </div>
  );
}
