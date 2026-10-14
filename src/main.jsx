import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import GoogleAuthRoot from './components/GoogleAuthRoot.jsx';
import { isNativeApp } from './lib/capacitor/isNativeApp.js';

if (typeof document !== 'undefined' && isNativeApp()) {
  document.documentElement.dataset.poreiagoApp = 'wallet';
  // Belt-and-suspenders: if index.html boot did not run, still open on /wallet.
  try {
    const path = window.location.pathname || '/';
    const walletOk =
      path === '/wallet' ||
      path.startsWith('/wallet/') ||
      path === '/my-booking' ||
      path.startsWith('/my-booking/') ||
      path === '/login' ||
      path === '/register' ||
      path.startsWith('/forgot-password') ||
      path.startsWith('/reset-password') ||
      path.startsWith('/ticket/') ||
      path.startsWith('/passenger-checkin');
    if (!walletOk) {
      window.history.replaceState(
        null,
        '',
        `/wallet${window.location.search || ''}${window.location.hash || ''}`,
      );
    }
  } catch {
    /* ignore */
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleAuthRoot>
      <App />
    </GoogleAuthRoot>
  </StrictMode>,
);
