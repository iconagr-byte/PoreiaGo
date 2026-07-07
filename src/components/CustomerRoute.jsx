import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isCustomer, isAdmin, isDriver } from '../lib/auth.js';

/**
 * Προστασία /wallet — πελάτες & admin (προεπισκόπηση wallet).
 * Driver → /driver · Επισκέπτης → /login
 */
export default function CustomerRoute({ children, allowGuest = false }) {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(
    () => allowGuest || isCustomer() || isAdmin(),
  );
  const [blockedAs, setBlockedAs] = useState(null);

  useEffect(() => {
    if (allowGuest || isCustomer() || isAdmin()) {
      setAllowed(true);
      setBlockedAs(null);
      return;
    }
    if (isDriver()) {
      setBlockedAs('driver');
      setAllowed(false);
      return;
    }
    setBlockedAs('guest');
    setAllowed(false);
    navigate('/login', { replace: true, state: { from: '/wallet' } });
  }, [navigate, allowGuest]);

  if (allowed) {
    return children;
  }

  if (blockedAs === 'driver') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="material-symbols-outlined text-4xl text-emerald-600">directions_bus</span>
        <p className="text-on-surface-variant max-w-sm">
          Είστε συνδεδεμένοι ως <strong>οδηγός</strong>. Το My Wallet είναι για πελάτες.
        </p>
        <Link
          to="/driver"
          className="px-6 py-3 rounded-full bg-emerald-600 text-white font-bold text-sm"
        >
          Driver Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="material-symbols-outlined text-4xl text-primary animate-pulse">
        account_balance_wallet
      </span>
      <p className="text-on-surface-variant max-w-sm">Μετάβαση στη σύνδεση πελάτη…</p>
      <Link
        to="/login"
        className="px-6 py-3 rounded-full bg-primary text-white font-bold text-sm hover:opacity-90"
      >
        Σύνδεση πελάτη
      </Link>
    </div>
  );
}
