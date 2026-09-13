import { createContext, useContext, useEffect, useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import {
  GOOGLE_CLIENT_ID as BUILD_GOOGLE_CLIENT_ID,
  fetchGoogleAuthConfig,
} from '../services/customerAuthApi.js';
import { isUsableGoogleClientId } from '../lib/googleClientId.js';

const GoogleAuthConfigContext = createContext({
  loading: true,
  enabled: false,
  clientId: '',
});

export function useGoogleAuthConfig() {
  return useContext(GoogleAuthConfigContext);
}

function resolveClientId(raw) {
  const clientId = String(raw || '').trim();
  return isUsableGoogleClientId(clientId) ? clientId : '';
}

/**
 * Loads Google OAuth Web Client ID from the API (runtime) with Vite build fallback.
 * Wraps children in GoogleOAuthProvider when a real (non-placeholder) client id is available.
 */
export default function GoogleAuthRoot({ children }) {
  const buildId = resolveClientId(BUILD_GOOGLE_CLIENT_ID);
  const [state, setState] = useState({
    loading: true,
    enabled: Boolean(buildId),
    clientId: buildId,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await fetchGoogleAuthConfig();
        if (cancelled) return;
        const clientId = resolveClientId(cfg.client_id || BUILD_GOOGLE_CLIENT_ID);
        setState({
          loading: false,
          enabled: Boolean(clientId),
          clientId,
        });
      } catch {
        if (cancelled) return;
        const clientId = resolveClientId(BUILD_GOOGLE_CLIENT_ID);
        setState({
          loading: false,
          enabled: Boolean(clientId),
          clientId,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tree = (
    <GoogleAuthConfigContext.Provider value={state}>
      {children}
    </GoogleAuthConfigContext.Provider>
  );

  if (state.clientId) {
    return <GoogleOAuthProvider clientId={state.clientId}>{tree}</GoogleOAuthProvider>;
  }
  return tree;
}
