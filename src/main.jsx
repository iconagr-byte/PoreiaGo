import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import GoogleAuthRoot from './components/GoogleAuthRoot.jsx';
import { isNativeApp } from './lib/capacitor/isNativeApp.js';
import {
  getNativeAppId,
  isNativeDriverApp,
  isNativeUnifiedApp,
  markNativeAppShell,
  NATIVE_APP_DRIVER,
  NATIVE_APP_UNIFIED,
  NATIVE_APP_WALLET,
} from './lib/capacitor/nativeAppId.js';
import {
  isUnifiedNativeAppPath,
  resolveNativeRoleHomePath,
} from './lib/capacitor/nativeRoleHome.js';

if (typeof document !== 'undefined' && isNativeApp()) {
  const flavor = getNativeAppId() || NATIVE_APP_UNIFIED;
  markNativeAppShell(
    flavor === NATIVE_APP_DRIVER ? NATIVE_APP_DRIVER : NATIVE_APP_UNIFIED,
  );

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
    } else if (isNativeUnifiedApp() || flavor === NATIVE_APP_WALLET || flavor === NATIVE_APP_UNIFIED) {
      if (!isUnifiedNativeAppPath(path)) {
        const home = resolveNativeRoleHomePath();
        window.history.replaceState(
          null,
          '',
          `${home}${window.location.search || ''}${window.location.hash || ''}`,
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
