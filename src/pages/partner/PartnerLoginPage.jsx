import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getPartnerSession, partnerLogin } from '../../lib/hybrid/partnerPortal.js';

export default function PartnerLoginPage() {
  const navigate = useNavigate();
  const existing = getPartnerSession();
  const [email, setEmail] = useState(existing?.email || '');
  const [password, setPassword] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const session = await partnerLogin(email, password);
    if (!session) {
      toast.error('Λάθος στοιχεία συνεργάτη');
      return;
    }
    toast.success(`Καλωσήρθες, ${session.name}`);
    navigate('/partner/portal');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Partner portal</p>
          <h1 className="text-xl font-bold mt-1">Σύνδεση συνεργάτη</h1>
        </div>
        <label className="block text-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Email</span>
          <input required className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Κωδικός</span>
          <input required type="password" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="submit" className="w-full rounded-xl bg-slate-900 text-white font-bold py-3">
          Είσοδος
        </button>
        <p className="text-xs text-center text-slate-500">
          Ή άνοιξε <Link className="underline font-semibold" to="/partner/itinerary">share link</Link>
        </p>
      </form>
    </div>
  );
}
