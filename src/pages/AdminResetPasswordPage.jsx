import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { confirmAdminPasswordReset } from '../services/platformApi.js';

/** Public page — set a new backoffice password from an emailed reset link. */
export default function AdminResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error('Μη έγκυρος σύνδεσμος επαναφοράς');
      return;
    }
    const password = e.target.password.value;
    const confirm = e.target.confirm.value;
    if (password !== confirm) {
      toast.error('Οι κωδικοί δεν ταιριάζουν');
      return;
    }
    setLoading(true);
    try {
      const result = await confirmAdminPasswordReset({ token, newPassword: password });
      toast.success(result.message || 'Ο κωδικός ενημερώθηκε');
      navigate('/admin/login', {
        replace: true,
        state: { emailHint: result.email || '' },
      });
    } catch (err) {
      toast.error(err.message || 'Αποτυχία επαναφοράς');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-3">
          <p className="text-slate-600">Ο σύνδεσμος επαναφοράς δεν είναι έγκυρος.</p>
          <Link to="/admin/login" className="text-slate-900 font-bold hover:underline">
            Σύνδεση γραφείου
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white p-10 md:p-12 rounded-[28px] shadow-lg border border-slate-100 w-full max-w-md">
        <div className="text-center mb-8">
          <span className="material-symbols-outlined text-4xl text-slate-800 mb-3">vpn_key</span>
          <h1 className="text-2xl font-bold text-slate-900">Νέος κωδικός γραφείου</h1>
          <p className="text-sm text-slate-500 mt-2">Ορίστε νέο κωδικό για την είσοδο στο backoffice.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-bold" htmlFor="password">
              Νέος κωδικός
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                minLength={6}
                required
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-slate-900/10 outline-none"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                onClick={() => setShowPassword((v) => !v)}
                aria-label="Εμφάνιση κωδικού"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold" htmlFor="confirm">
              Επιβεβαίωση
            </label>
            <input
              id="confirm"
              name="confirm"
              type={showPassword ? 'text' : 'password'}
              minLength={6}
              required
              className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-slate-900/10 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-full bg-slate-900 text-white font-bold disabled:opacity-60"
          >
            {loading ? 'Αποθήκευση…' : 'Αποθήκευση κωδικού'}
          </button>
        </form>

        <p className="text-sm text-center mt-6">
          <Link to="/admin/login" className="font-bold text-slate-700 hover:underline">
            Πίσω στη σύνδεση
          </Link>
        </p>
      </div>
    </div>
  );
}
