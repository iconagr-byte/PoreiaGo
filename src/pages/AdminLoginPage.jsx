import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { saasDevLogin, saasLogin } from '../services/saasApi.js';

const DEV_DRIVER = 'driver@aerostride.com';
const SAAS_ADMIN = 'admin@achillio.gr';

/** Σύνδεση διαχειριστή — email + κωδικός (χωρίς UUID tenant). */
export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAgency, setShowAgency] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const email = e.target.email.value.trim().toLowerCase();
    const password = e.target.password.value;
    const tenantSlug = (e.target.tenant_slug?.value || '').trim().toLowerCase();

    if (email === DEV_DRIVER) {
      localStorage.setItem('userRole', 'driver');
      localStorage.setItem('driverApiKey', 'dev-driver-key');
      navigate('/driver');
      setLoading(false);
      return;
    }

    try {
      let data;
      try {
        data = await saasLogin({
          email,
          password,
          tenantSlug: tenantSlug || undefined,
        });
      } catch (primaryErr) {
        const isDemoAdmin =
          (email === 'admin@achillio.gr' || email === 'admin@aerostride.com') &&
          password === 'Admin123!';
        if (isDemoAdmin) {
          data = await saasDevLogin({
            email,
            password,
            tenantSlug: tenantSlug || undefined,
          });
        } else {
          throw primaryErr;
        }
      }
      localStorage.setItem('userRole', 'admin');
      localStorage.setItem('driverApiKey', 'dev-driver-key');
      const postLogin = location.state || {};
      const settingsSubTab = postLogin.settingsSubTab || postLogin.platformTab;
      const activeTab =
        postLogin.activeTab || (settingsSubTab ? 'settings' : 'dashboard');

      navigate(postLogin.from || '/admin', {
        replace: true,
        state: {
          activeTab,
          ...(settingsSubTab ? { settingsSubTab } : {}),
          plan: postLogin.plan,
          interval: postLogin.interval,
        },
      });
    } catch (apiErr) {
      const msg = apiErr.message || 'Αποτυχία σύνδεσης';
      if (msg.includes('πολλές εταιρείες')) {
        setShowAgency(true);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-gray-900/20 rounded-full blur-[120px]" />

      <div className="bg-surface-container-lowest p-10 md:p-14 rounded-[32px] shadow-level-2 card-inner-border w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <h1 className="font-headline-md text-headline-md font-bold text-on-surface tracking-tight mb-2">
            Σύνδεση Διαχείρισης
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Email και κωδικός — χωρίς τεχνικά IDs
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <label className="block font-label-md text-label-md text-on-surface" htmlFor="email">
              Email
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-lg">
                mail
              </span>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                defaultValue=""
                placeholder="email@γραφείο.gr"
                className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-0 rounded-2xl focus:ring-2 focus:ring-primary-container text-body-md font-body-md transition-shadow"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block font-label-md text-label-md text-on-surface" htmlFor="password">
              Κωδικός
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-lg">
                lock
              </span>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                defaultValue=""
                className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-0 rounded-2xl focus:ring-2 focus:ring-primary-container text-body-md font-body-md transition-shadow"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {(showAgency || import.meta.env.DEV) && (
            <div className="space-y-2">
              <label className="block font-label-md text-label-md text-on-surface" htmlFor="tenant_slug">
                Κωδικός εταιρείας <span className="text-gray-400 font-normal">(μόνο αν ζητηθεί)</span>
              </label>
              <input
                id="tenant_slug"
                name="tenant_slug"
                type="text"
                autoComplete="organization"
                className="w-full px-4 py-3 bg-surface-container-low border-0 rounded-2xl focus:ring-2 focus:ring-primary-container text-sm"
                placeholder="π.χ. achillio"
              />
              <p className="text-xs text-gray-500">
                Συνήθως δεν χρειάζεται — συμπληρώνεται μόνο αν το email ανήκει σε πολλές εταιρείες.
              </p>
            </div>
          )}

          {!showAgency && (
            <button
              type="button"
              onClick={() => setShowAgency(true)}
              className="text-xs text-primary font-semibold hover:underline"
            >
              Έχω κωδικό εταιρείας (σπάνια)
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-gray-900 text-white py-4 rounded-full font-label-md text-label-md hover:scale-[0.98] transition-transform duration-200 shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? 'Σύνδεση…' : 'Είσοδος'}
            <span className="material-symbols-outlined text-sm">dashboard</span>
          </button>
        </form>

      </div>

      <div className="mt-8 text-center relative z-10 space-y-2">
        <Link
          to="/"
          className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 justify-center"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Επιστροφή στην Αρχική
        </Link>
        <p className="text-xs text-on-surface-variant">
          Είστε πελάτης;{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            My Wallet σύνδεση
          </Link>
        </p>
      </div>
    </div>
  );
}
