import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { isTenantStorefrontHost } from '../lib/platform/tenantHost.js';
import { requestAdminPasswordReset } from '../services/platformApi.js';
import '../styles/platform-admin-login.css';

/** Public — request backoffice password reset email (office /admin/login). */
export default function AdminForgotPasswordPage() {
  const officeMinimal = isTenantStorefrontHost();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim().toLowerCase();
    setLoading(true);
    try {
      const result = await requestAdminPasswordReset({ email });
      setSent(true);
      toast.success(result.message || 'Αν υπάρχει λογαριασμός, στάλθηκαν οδηγίες στο email');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αιτήματος');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`pg-login${officeMinimal ? ' pg-login--office-minimal' : ''}`}>
      <div className="pg-login-main">
        <div className="pg-login-top pg-login-top--minimal">
          <Link to="/admin/login" className="pg-login-back">
            <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 18 }}>
              arrow_back
            </span>
            Πίσω
          </Link>
        </div>

        <div className="pg-login-center">
          <div className="pg-login-card">
            <h1>Ξέχασα τον κωδικό</h1>
            {officeMinimal ? null : (
              <p>Θα στείλουμε σύνδεσμο επαναφοράς στο email του γραφείου.</p>
            )}

            {sent ? (
              <div className="pg-login-form">
                <p className="pg-login-hint" style={{ margin: 0, lineHeight: 1.5 }}>
                  Αν υπάρχει λογαριασμός με αυτό το email, θα λάβετε οδηγίες επαναφοράς (έλεγχος και
                  spam).
                </p>
                <Link to="/admin/login" className="pg-login-submit" style={{ textAlign: 'center' }}>
                  Επιστροφή στη σύνδεση
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="pg-login-form">
                <div className="pg-login-field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    placeholder="email@γραφείο.gr"
                  />
                </div>
                <button type="submit" className="pg-login-submit" disabled={loading}>
                  {loading ? 'Αποστολή…' : 'Αποστολή συνδέσμου'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
