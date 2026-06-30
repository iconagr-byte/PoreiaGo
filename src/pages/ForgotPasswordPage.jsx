import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { forgotCustomerPassword } from '../services/customerAuthApi.js';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim().toLowerCase();
    setLoading(true);
    try {
      const result = await forgotCustomerPassword(email);
      setSent(true);
      toast.success(result.message || 'Στάλθηκαν οδηγίες στο email σας');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αιτήματος');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      <div className="bg-surface-container-lowest p-10 md:p-14 rounded-[32px] shadow-level-2 w-full max-w-md">
        <div className="text-center mb-8">
          <span className="material-symbols-outlined text-4xl text-primary mb-3">lock_reset</span>
          <h1 className="text-2xl font-bold text-on-surface">Ξέχασα τον κωδικό</h1>
          <p className="text-sm text-on-surface-variant mt-2">
            Θα σας στείλουμε σύνδεσμο επαναφοράς στο email σας
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Αν υπάρχει λογαριασμός με αυτό το email, θα λάβετε οδηγίες επαναφοράς (έλεγχος και spam).
            </p>
            <Link to="/login" className="inline-block text-primary font-bold hover:underline">
              Επιστροφή στη σύνδεση
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-bold" htmlFor="email">Email λογαριασμού</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl focus:ring-2 focus:ring-primary-container"
                placeholder="email@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-full bg-primary-container text-white font-bold disabled:opacity-60"
            >
              {loading ? 'Αποστολή…' : 'Αποστολή συνδέσμου'}
            </button>
          </form>
        )}

        <p className="text-sm text-center mt-6">
          <Link to="/login" className="text-primary font-bold hover:underline">
            Πίσω στη σύνδεση
          </Link>
        </p>
      </div>
    </div>
  );
}
