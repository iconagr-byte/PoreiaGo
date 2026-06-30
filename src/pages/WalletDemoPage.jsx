import { useLayoutEffect } from 'react';
import { loginAsCustomer } from '../lib/auth.js';
import DigitalWallet from './DigitalWallet.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

/** Demo wallet — auto-login ως john@example.com, χωρίς κωδικό. */
export default function WalletDemoPage() {
  useLayoutEffect(() => {
    loginAsCustomer('john@example.com');
  }, []);

  return (
    <ErrorBoundary>
      <DigitalWallet demoMode />
    </ErrorBoundary>
  );
}
