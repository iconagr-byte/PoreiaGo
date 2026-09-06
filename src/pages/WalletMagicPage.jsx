/**
 * Phase B — consume email magic link → My Wallet session + focused pass.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loginAsCustomer } from '../lib/auth.js';
import { consumeWalletMagic } from '../services/customerAuthApi.js';
import { walletHomeNavState } from '../lib/wallet/walletClaim.js';
import '../styles/wallet-pass.css';

export default function WalletMagicPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = (params.get('token') || '').trim();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Λείπει ο σύνδεσμος εισόδου. Ανοίξτε το link από το email εισιτηρίου.');
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    consumeWalletMagic(token)
      .then((profile) => {
        if (cancelled) return;
        loginAsCustomer(
          profile.email,
          {
            name: profile.name,
            picture: profile.picture,
            provider: profile.provider || 'magic',
            phone: profile.phone,
            customerId: profile.customer_id,
          },
          profile.access_token,
        );
        navigate('/wallet', {
          replace: true,
          state: walletHomeNavState({
            highlightBooking: profile.highlight_booking,
            fromClaim: true,
          }),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Ο σύνδεσμος δεν είναι έγκυρος');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  return (
    <div className="wallet-app">
      <main className="wallet-main" style={{ paddingTop: '3rem' }}>
        <section className="wallet-pass-empty">
          <div className="wallet-pass-empty-inner">
            <span className="material-symbols-outlined wallet-pass-empty-icon" aria-hidden>
              {loading ? 'progress_activity' : error ? 'link_off' : 'mark_email_read'}
            </span>
            <h1 className="wallet-pass-empty-title">
              {loading ? 'Άνοιγμα My Wallet…' : 'Δεν ανοίγει ο σύνδεσμος'}
            </h1>
            <p className="wallet-pass-empty-copy">
              {loading
                ? 'Επαληθεύουμε τον σύνδεσμο από το email σας.'
                : error || 'Δοκιμάστε σύνδεση με email ή εύρεση κράτησης.'}
            </p>
            {!loading ? (
              <div className="wallet-ticket-actions">
                <Link to="/login" className="wallet-pass-cta" state={{ from: '/wallet' }}>
                  Σύνδεση My Wallet
                </Link>
                <Link to="/my-booking" className="wallet-pass-secondary wallet-ticket-email">
                  Εύρεση κράτησης
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
