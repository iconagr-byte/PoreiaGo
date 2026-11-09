import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import { useGoogleAuthConfig } from '../components/GoogleAuthRoot.jsx';
import PlatformBrand from '../components/marketing/PlatformBrand.jsx';
import { isTenantStorefrontHost } from '../lib/platform/tenantHost.js';
import { saasDevLogin, saasGoogleLogin, saasLogin } from '../services/saasApi.js';
import '../styles/platform-admin-login.css';

const DEV_DRIVER = 'driver@aerostride.com';

function postLoginNavigate(navigate, location, data) {
  const postLogin = location.state || {};
  const settingsSubTab = postLogin.settingsSubTab || postLogin.platformTab;
  const activeTab = postLogin.activeTab || (settingsSubTab ? 'settings' : 'dashboard');

  navigate(postLogin.from || '/admin', {
    replace: true,
    state: {
      activeTab: postLogin.officeSetup ? 'dashboard' : activeTab,
      ...(settingsSubTab ? { settingsSubTab } : {}),
      plan: postLogin.plan,
      interval: postLogin.interval,
      ...(postLogin.emailHubTab ? { emailHubTab: postLogin.emailHubTab } : {}),
      ...(postLogin.connectEmail ? { connectEmail: true } : {}),
      ...(postLogin.officeSetup ? { officeSetup: true } : {}),
      ...(postLogin.afterLogin || {}),
    },
  });
  return data;
}

/** Σύνδεση διαχειριστή — office host: minimal fields only · platform host: marketing portal. */
export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { enabled: googleEnabled } = useGoogleAuthConfig();
  const officeMinimal = isTenantStorefrontHost();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showAgency, setShowAgency] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tenantSlug, setTenantSlug] = useState('');

  const finishAdminSession = (data) => {
    localStorage.setItem('userRole', 'admin');
    localStorage.setItem('driverApiKey', 'dev-driver-key');
    return postLoginNavigate(navigate, location, data);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const email = e.target.email.value.trim().toLowerCase();
    const password = e.target.password.value;
    const slug = (e.target.tenant_slug?.value || tenantSlug || '').trim().toLowerCase();

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
          tenantSlug: slug || undefined,
        });
      } catch (primaryErr) {
        const isDemoAdmin =
          (email === 'admin@achillio.gr' || email === 'admin@aerostride.com') &&
          password === 'Admin123!';
        if (isDemoAdmin) {
          data = await saasDevLogin({
            email,
            password,
            tenantSlug: slug || undefined,
          });
        } else {
          throw primaryErr;
        }
      }
      finishAdminSession(data);
    } catch (apiErr) {
      const raw = String(apiErr?.message || '').trim();
      const msg =
        !raw || /failed to fetch|networkerror|load failed/i.test(raw)
          ? 'Δεν υπάρχει σύνδεση με τον server (πιθανό deploy). Περιμένετε ~1 λεπτό και δοκιμάστε ξανά.'
          : raw;
      if (msg.includes('πολλές εταιρείες')) {
        setShowAgency(true);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    setError('');
    setGoogleLoading(true);
    const slug = tenantSlug.trim().toLowerCase();
    try {
      const data = await saasGoogleLogin({
        idToken: credential,
        tenantSlug: slug || undefined,
      });
      finishAdminSession(data);
    } catch (apiErr) {
      const raw = String(apiErr?.message || '').trim();
      const msg =
        !raw || /failed to fetch|networkerror|load failed/i.test(raw)
          ? 'Δεν υπάρχει σύνδεση με τον server (πιθανό deploy). Περιμένετε ~1 λεπτό και δοκιμάστε ξανά.'
          : raw;
      if (msg.includes('πολλές εταιρείες')) {
        setShowAgency(true);
      }
      setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const busy = loading || googleLoading;

  return (
    <div className={`pg-login${officeMinimal ? ' pg-login--office-minimal' : ''}`}>
      <div className="pg-login-main">
        {officeMinimal ? (
          <div className="pg-login-top pg-login-top--minimal">
            <Link to="/" className="pg-login-back">
              <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 18 }}>
                arrow_back
              </span>
              Πίσω
            </Link>
          </div>
        ) : (
          <div className="pg-login-top">
            <PlatformBrand variant="light" />
            <Link to="/" className="pg-login-back">
              <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 18 }}>
                arrow_back
              </span>
              Αρχική
            </Link>
          </div>
        )}

        <div className="pg-login-center">
          <div className="pg-login-card">
            <h1>{officeMinimal ? 'Σύνδεση' : 'Σύνδεση στο γραφείο σας'}</h1>
            {officeMinimal ? null : (
              <p>Email και κωδικός — ή Google. Χωρίς τεχνικά IDs.</p>
            )}

            {error ? <p className="pg-login-error">{error}</p> : null}

            <form onSubmit={handleLogin} className="pg-login-form">
              <div className="pg-login-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  defaultValue=""
                  placeholder="email@γραφείο.gr"
                  required
                />
              </div>

              <div className="pg-login-field">
                <label htmlFor="password">Κωδικός</label>
                <div className="pg-login-pass">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    defaultValue=""
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    className="pg-login-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                    aria-pressed={showPassword}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {(showAgency || (!officeMinimal && import.meta.env.DEV)) && (
                <div className="pg-login-field">
                  <label htmlFor="tenant_slug">
                    Κωδικός εταιρείας{' '}
                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>(μόνο αν ζητηθεί)</span>
                  </label>
                  <input
                    id="tenant_slug"
                    name="tenant_slug"
                    type="text"
                    autoComplete="organization"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    placeholder="π.χ. admin-achillio-gr"
                  />
                  {!officeMinimal ? (
                    <p className="pg-login-hint">
                      Συνήθως δεν χρειάζεται — μόνο αν το email ανήκει σε πολλές εταιρείες.
                    </p>
                  ) : null}
                </div>
              )}

              {!officeMinimal && !showAgency ? (
                <button type="button" className="pg-login-agency-toggle" onClick={() => setShowAgency(true)}>
                  Έχω κωδικό εταιρείας (σπάνια)
                </button>
              ) : null}

              <button type="submit" className="pg-login-submit" disabled={busy}>
                {loading ? 'Σύνδεση…' : 'Είσοδος'}
              </button>
            </form>

            {googleEnabled ? (
              <>
                <div className="pg-login-divider">ή με Google</div>
                <GoogleSignInButton
                  disabled={busy}
                  onSuccess={handleGoogleCredential}
                  onDemoProfile={() =>
                    setError(
                      'Για demo Google χρειάζεται GOOGLE_CLIENT_ID στο server — χρησιμοποιήστε email/κωδικό.',
                    )
                  }
                  onError={(msg) => setError(msg || 'Η σύνδεση με Google απέτυχε')}
                />
                {googleLoading ? (
                  <p className="pg-login-hint" style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                    Επαλήθευση Google…
                  </p>
                ) : null}
              </>
            ) : null}

            {officeMinimal ? null : (
              <div className="pg-login-foot">
                Νέο γραφείο;{' '}
                <Link to="/grafeia">Δείτε συμβόλαια</Link>
                <br />
                Είστε πελάτης;{' '}
                <Link to="/login">My Wallet σύνδεση</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {officeMinimal ? null : (
        <aside className="pg-login-aside" aria-hidden>
          <div className="pg-login-wave" />
          <div className="pg-login-wave pg-login-wave--soft" />
          <div className="pg-login-orbit" />
          <div className="pg-login-orbit pg-login-orbit--slow" />

          <div className="pg-login-aside-copy">
            <p className="pg-login-aside-kicker">PoreiaGo</p>
            <strong>Ένα σύστημα. Δικό σας brand.</strong>
            <span>Κρατήσεις, στόλος, GPS και ενοικιάσεις — από τον πίνακα του γραφείου σας.</span>
          </div>
        </aside>
      )}
    </div>
  );
}
