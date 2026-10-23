import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import GoogleAuthRoot from './components/GoogleAuthRoot.jsx';
import { isNativeApp } from './lib/capacitor/isNativeApp.js';
import {
  getNativeAppId,
  isNativeDriverApp,
  markNativeAppShell,
  NATIVE_APP_DRIVER,
  NATIVE_APP_WALLET,
} from './lib/capacitor/nativeAppId.js';

if (typeof document !== 'undefined' && isNativeApp()) {
  const flavor = getNativeAppId() || NATIVE_APP_WALLET;
  markNativeAppShell(flavor);

  try {
    const path = window.location.pathname || '/';
    if (flavor === NATIVE_APP_DRIVER || isNativeDriverApp()) {
      const driverOk =
        path === '/driver' ||
        path.startsWith('/driver/') ||
        path === '/driver/auth' ||
        path.startsWith('/driver/auth') ||
        path.startsWith('/driver/reset-password') ||
        path.startsWith('/driver/scan');
      if (!driverOk) {
        window.history.replaceState(
          null,
          '',
          `/driver${window.location.search || ''}${window.location.hash || ''}`,
        );
      }
    } else {
      // Belt-and-suspenders: if index.html boot did not run, still open on /wallet.
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
        path.startsWith('/passenger-checkin') ||
        path.startsWith('/wallet/native-google');
      if (!walletOk) {
        window.history.replaceState(
          null,
          '',
          `/wallet${window.location.search || ''}${window.location.hash || ''}`,
        );
      }
      // Native-only theme — website never loads this stylesheet.
      void import('./styles/wallet-native-theme.css');
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
