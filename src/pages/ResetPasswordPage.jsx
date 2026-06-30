import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loginAsCustomer } from '../lib/auth.js';
import { resetCustomerPassword } from '../services/customerAuthApi.js';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [loading, setLoading] = useState(false);

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
      const result = await resetCustomerPassword({ token, newPassword: password });
      loginAsCustomer(
        result.email,
        { name: result.name, provider: result.provider || 'email' },
        result.access_token,
      );
      toast.success('Ο κωδικός ενημερώθηκε — συνδεθήκατε αυτόματα');
      navigate('/wallet', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Αποτυχία επαναφοράς');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-on-surface-variant mb-4">Ο σύνδεσμος επαναφοράς δεν είναι έγκυρος.</p>
          <Link to="/forgot-password" className="text-primary font-bold hover:underline">
            Νέα αίτηση επαναφοράς
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      <div className="bg-surface-container-lowest p-10 md:p-14 rounded-[32px] shadow-level-2 w-full max-w-md">
        <div className="text-center mb-8">
          <span className="material-symbols-outlined text-4xl text-primary mb-3">vpn_key</span>
          <h1 className="text-2xl font-bold text-on-surface">Νέος κωδικός</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-bold" htmlFor="password">Νέος κωδικός</label>
            <input
              id="password"
              name="password"
              type="password"
              minLength={6}
              required
              className="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl focus:ring-2 focus:ring-primary-container"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold" htmlFor="confirm">Επιβεβαίωση</label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              minLength={6}
              required
              className="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl focus:ring-2 focus:ring-primary-container"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-full bg-primary-container text-white font-bold disabled:opacity-60"
          >
            {loading ? 'Αποθήκευση…' : 'Ορισμός κωδικού'}
          </button>
        </form>
      </div>
    </div>
  );
}
