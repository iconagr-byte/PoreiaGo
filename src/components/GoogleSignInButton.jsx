import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useGoogleAuthConfig } from './GoogleAuthRoot.jsx';

function GoogleLogo({ className = '' }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.98 13.72 17.98 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.56 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.16 7.11-10.28 7.11-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24 24 0 0 0 0 21.55l7.98-6.18z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.02 0-11.1-4.06-12.91-9.52l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function googleButtonLabel(text) {
  if (text === 'signup_with') return 'Εγγραφή με Google';
  if (text === 'continue_with') return 'Συνέχεια με Google';
  return 'Σύνδεση με Google';
}

/** Shared Apple-style shell — matches wallet / rent login forms. */
function StyledGoogleShell({ label, disabled = false }) {
  return (
    <div
      className={`flex w-full items-center justify-center gap-3 rounded-2xl border border-black/[0.08] bg-white px-5 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all ${
        disabled
          ? 'opacity-60'
          : 'group-hover:border-black/[0.14] group-hover:bg-[#fbfbfd] group-hover:shadow-[0_4px_14px_rgba(0,0,0,0.06)]'
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7] ring-1 ring-black/[0.04]">
        <GoogleLogo />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-[#1d1d1f]">{label}</span>
    </div>
  );
}

function DemoGoogleSignIn({ onDemoProfile, onError, disabled, text = 'signin_with' }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('john@example.com');
  const label = googleButtonLabel(text);

  const submit = (e) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) {
      onError?.('Εισάγετε email Google');
      return;
    }
    if (value === 'admin@aerostride.com' || value === 'driver@aerostride.com') {
      onError?.('Για staff χρησιμοποιήστε Admin Login');
      return;
    }
    const namePart = value.split('@')[0].replace(/[._]/g, ' ');
    onDemoProfile({
      email: value,
      name: namePart.charAt(0).toUpperCase() + namePart.slice(1),
      provider: 'google',
    });
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="group w-full disabled:cursor-not-allowed"
      >
        <StyledGoogleShell label={label} disabled={disabled} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f5f7]">
                <GoogleLogo />
              </span>
              <div>
                <h2 className="font-bold text-[#1d1d1f]">Google Sign-In</h2>
                <p className="text-xs text-[#6e6e73]">Demo λειτουργία — τοπική δοκιμή</p>
              </div>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="google-demo-email" className="text-sm font-medium text-[#1d1d1f]">
                  Gmail / email πελάτη
                </label>
                <input
                  id="google-demo-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/[0.08] px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="name@gmail.com"
                  autoFocus
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-full border border-black/[0.08] py-3 text-sm font-bold text-[#6e6e73]"
                >
                  Ακύρωση
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-[#1d1d1f] py-3 text-sm font-bold text-white"
                >
                  Συνέχεια
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function GoogleUnavailable({ disabled, text = 'signin_with' }) {
  const label = googleButtonLabel(text);
  return (
    <div
      className="w-full cursor-not-allowed"
      title="Ορίστε GOOGLE_CLIENT_ID στο deploy/.env.prod — βλ. deploy/GOOGLE-SIGNIN.md"
      aria-disabled="true"
    >
      <StyledGoogleShell
        label={disabled ? `${label}…` : `${label} (μη διαθέσιμη)`}
        disabled
      />
    </div>
  );
}

/**
 * Custom shell + real click target.
 *
 * The previous opacity-0 GIS iframe overlay often swallowed / ignored taps on
 * iOS Safari and FedCM browsers. We keep the Apple-style shell, trigger GIS
 * One Tap / FedCM from a real button click, and fall back to a visible Google
 * button modal when the prompt is blocked.
 */
function LiveGoogleSignIn({ onSuccess, onError, disabled, text }) {
  const { clientId } = useGoogleAuthConfig();
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = googleButtonLabel(text);
  const callbackRef = useRef({ onSuccess, onError });
  callbackRef.current = { onSuccess, onError };

  const handleCredential = useCallback((credential) => {
    setBusy(false);
    setFallbackOpen(false);
    if (!credential) {
      callbackRef.current.onError?.('Δεν ελήφθη διαπιστευτήριο Google');
      return;
    }
    callbackRef.current.onSuccess?.(credential);
  }, []);

  useEffect(() => {
    const g = typeof window !== 'undefined' ? window.google?.accounts?.id : null;
    if (!g || !clientId) return undefined;
    try {
      g.initialize({
        client_id: clientId,
        callback: (response) => handleCredential(response?.credential),
        auto_select: false,
        cancel_on_tap_outside: true,
        context: text === 'signup_with' ? 'signup' : 'signin',
        ux_mode: 'popup',
        use_fedcm_for_prompt: true,
      });
    } catch {
      /* GIS not ready yet — click handler will retry */
    }
    return undefined;
  }, [clientId, handleCredential, text]);

  const openFallback = () => {
    setBusy(false);
    setFallbackOpen(true);
  };

  const onClick = () => {
    if (disabled || busy) return;
    const g = window.google?.accounts?.id;
    if (!g || !clientId) {
      onError?.('Google Sign-In δεν φόρτωσε. Ανανεώστε τη σελίδα.');
      return;
    }
    setBusy(true);
    try {
      g.initialize({
        client_id: clientId,
        callback: (response) => handleCredential(response?.credential),
        auto_select: false,
        cancel_on_tap_outside: true,
        context: text === 'signup_with' ? 'signup' : 'signin',
        ux_mode: 'popup',
        use_fedcm_for_prompt: true,
      });
      g.prompt((notification) => {
        // isDismissedMoment also fires after a successful credential — do not
        // treat that as failure (would open a duplicate fallback modal).
        const blocked =
          Boolean(notification?.isNotDisplayed?.()) ||
          Boolean(notification?.isSkippedMoment?.());
        if (blocked) openFallback();
        else setBusy(false);
      });
    } catch {
      openFallback();
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={onClick}
        className="group w-full disabled:cursor-not-allowed"
        aria-label={label}
      >
        <StyledGoogleShell label={busy ? `${label}…` : label} disabled={disabled || busy} />
      </button>

      {fallbackOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Σύνδεση με Google"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f5f7]">
                <GoogleLogo />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-[#1d1d1f]">Σύνδεση με Google</h2>
                <p className="text-xs text-[#6e6e73]">Επιλέξτε τον λογαριασμό σας για συνέχεια</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFallbackOpen(false);
                  setBusy(false);
                }}
                className="rounded-full p-2 text-[#6e6e73] hover:bg-black/[0.04]"
                aria-label="Κλείσιμο"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="flex justify-center py-2">
              <GoogleLogin
                onSuccess={(response) => {
                  if (!response.credential) {
                    onError?.('Δεν ελήφθη διαπιστευτήριο Google');
                    return;
                  }
                  handleCredential(response.credential);
                }}
                onError={() => {
                  setBusy(false);
                  onError?.('Η σύνδεση με Google απέτυχε');
                }}
                theme="outline"
                size="large"
                text={text}
                shape="pill"
                locale="el"
                width="320"
                useOneTap={false}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function GoogleSignInButton({
  onSuccess,
  onDemoProfile,
  onError,
  disabled = false,
  /** GIS button label: signin_with | signup_with | continue_with */
  text = 'signin_with',
}) {
  const { loading, enabled } = useGoogleAuthConfig();
  const buttonText =
    text === 'signup_with' || text === 'continue_with' || text === 'signin_with'
      ? text
      : 'signin_with';

  if (loading) {
    return <GoogleUnavailable disabled text={buttonText} />;
  }

  if (!enabled) {
    if (import.meta.env.DEV) {
      return (
        <DemoGoogleSignIn
          onDemoProfile={onDemoProfile}
          onError={onError}
          disabled={disabled}
          text={buttonText}
        />
      );
    }
    return <GoogleUnavailable text={buttonText} />;
  }

  return (
    <LiveGoogleSignIn
      onSuccess={onSuccess}
      onError={onError}
      disabled={disabled}
      text={buttonText}
    />
  );
}
