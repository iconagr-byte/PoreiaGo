import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.jsx';
import { GOOGLE_CLIENT_ID } from './services/customerAuthApi.js';

const root = createRoot(document.getElementById('root'));

function RootApp() {
  if (GOOGLE_CLIENT_ID) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    );
  }
  return <App />;
}

root.render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
