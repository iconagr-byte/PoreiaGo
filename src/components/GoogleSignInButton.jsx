import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { isGoogleAuthConfigured } from '../services/customerAuthApi.js';

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
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

function DemoGoogleSignIn({ onDemoProfile, onError, disabled }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('john@example.com');

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
        className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-full border border-gray-300 bg-white hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-50"
      >
        <GoogleLogo />
        <span className="text-sm font-semibold text-gray-700">Σύνδεση με Google</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <GoogleLogo />
              <div>
                <h2 className="font-bold text-gray-900">Google Sign-In</h2>
                <p className="text-xs text-gray-500">Demo λειτουργία — τοπική δοκιμή</p>
              </div>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="google-demo-email" className="text-sm font-medium text-gray-700">
                  Gmail / email πελάτη
                </label>
                <input
                  id="google-demo-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/30 outline-none"
                  placeholder="name@gmail.com"
                  autoFocus
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-3 rounded-full border border-gray-200 text-gray-600 font-bold text-sm"
                >
                  Ακύρωση
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-full bg-primary-container text-white font-bold text-sm"
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

export default function GoogleSignInButton({
  onSuccess,
  onDemoProfile,
  onError,
  disabled = false,
}) {
  if (!isGoogleAuthConfigured()) {
    return (
      <DemoGoogleSignIn onDemoProfile={onDemoProfile} onError={onError} disabled={disabled} />
    );
  }

  return (
    <div className={`flex justify-center ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <GoogleLogin
        onSuccess={(response) => {
          if (!response.credential) {
            onError?.('Δεν ελήφθη διαπιστευτήριο Google');
            return;
          }
          onSuccess(response.credential);
        }}
        onError={() => onError?.('Η σύνδεση με Google απέτυχε')}
        theme="outline"
        size="large"
        text="signin_with"
        shape="pill"
        locale="el"
        useOneTap={false}
      />
    </div>
  );
}
