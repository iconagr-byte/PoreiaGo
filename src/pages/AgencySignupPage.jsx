import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import PlatformBrand from '../components/marketing/PlatformBrand.jsx';
import {
  AGENCY_PLANS,
  BILLING_INTERVALS,
  displayPrice,
  getPlanById,
} from '../lib/billing/planCatalog.js';
import { createSignupCheckout, fetchBillingConfig } from '../services/billingApi.js';
import { getPlatformBaseDomain } from '../lib/platform/domain.js';
import PasswordField from '../components/PasswordField.jsx';

const BASE_DOMAIN = getPlatformBaseDomain();
const SUBDOMAIN_PATTERN = /^[a-z0-9-]+$/;

function normalizeSubdomain(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export default function AgencySignupPage() {
  const [searchParams] = useSearchParams();
  const initialPlan = searchParams.get('plan') || 'professional';
  const initialInterval = searchParams.get('interval') || 'month';

  const [planId, setPlanId] = useState(initialPlan);
  const [interval, setInterval] = useState(
    initialInterval === 'year' ? 'year' : 'month',
  );
  const [legalName, setLegalName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [billingConfig, setBillingConfig] = useState(null);

  const plan = useMemo(() => getPlanById(planId), [planId]);
  const price = useMemo(() => displayPrice(plan, interval), [plan, interval]);
  const subdomainPreview = normalizeSubdomain(subdomain) || 'your-agency';
  const demoMode = billingConfig?.demo_mode === true;
  const trialDays = billingConfig?.trial_days || 14;

  useEffect(() => {
    let cancelled = false;
    fetchBillingConfig()
      .then((cfg) => {
        if (!cancelled) setBillingConfig(cfg);
      })
      .catch(() => {
        if (!cancelled) setBillingConfig({ demo_mode: true, trial_days: 14 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (searchParams.get('billing') === 'cancel') {
      toast('Η πληρωμία ακυρώθηκε — μπορείτε να δοκιμάσετε ξανά', { icon: 'ℹ️' });
    }
  }, [searchParams]);

  useEffect(() => {
    if (plan.contactSales) {
      setPlanId('professional');
    }
  }, [plan.contactSales]);

  const handleSubdomainChange = (e) => {
    setSubdomain(normalizeSubdomain(e.target.value));
  };

  const validate = () => {
    if (!legalName.trim()) return 'Συμπληρώστε την επωνυμία του γραφείου';
    if (!adminEmail.trim()) return 'Συμπληρώστε email διαχειριστή';
    if (!subdomain || subdomain.length < 2) return 'Ο subdomain πρέπει να έχει τουλάχιστον 2 χαρακτήρες';
    if (!SUBDOMAIN_PATTERN.test(subdomain)) {
      return 'Μόνο πεζά λατινικά, αριθμοί και παύλες (a-z, 0-9, -)';
    }
    if (password.length < 8) return 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες';
    if (password !== confirmPassword) return 'Οι κωδικοί δεν ταιριάζουν';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setWorking(true);
    try {
      const result = await createSignupCheckout({
        legalName: legalName.trim(),
        adminEmail: adminEmail.trim().toLowerCase(),
        subdomain,
        password,
        plan: planId,
        billingInterval: interval,
      });
      if (result?.checkout_url) {
        if (result.demo) {
          toast.success(`Demo γραφείο έτοιμο — δοκιμή ${trialDays} ημερών`);
        }
        window.location.href = result.checkout_url;
        return;
      }
      setError('Δεν επιστράφηκε checkout URL από τον server');
    } catch (err) {
      setError(err.message || 'Αποτυχία έναρξης εγγραφής');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <PlatformBrand variant="light" />
          <nav className="flex items-center gap-3">
            <Link to="/grafeia" className="text-sm font-semibold text-gray-600 hover:text-primary">
              Συμβόλαια
            </Link>
            <Link
              to="/admin/login"
              className="text-sm font-bold px-4 py-2 rounded-full border border-gray-200 hover:bg-gray-50"
            >
              Έχω ήδη λογαριασμό
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 md:py-14">
        <div className="grid lg:grid-cols-5 gap-10 items-start">
          <section className="lg:col-span-2 space-y-6">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
                Νέο γραφείο
              </span>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-4">
                {demoMode
                  ? `Demo πληρωμή — ${trialDays} ημέρες δωρεάν`
                  : 'Ξεκινήστε με Stripe Checkout'}
              </h1>
              <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
                {demoMode
                  ? 'Χωρίς πραγματική χρέωση: δημιουργείται αμέσως ο tenant, ο admin λογαριασμός και trial συνδρομή για δοκιμή.'
                  : 'Μετά την πληρωμή δημιουργείται αυτόματα ο tenant, ο admin λογαριασμός και η συνδρομή σας.'}
              </p>
              {demoMode ? (
                <p className="mt-3 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2">
                  Demo mode ενεργό — ιδανικό για δοκιμή νέου γραφείου.
                </p>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-black/[0.06] bg-surface-container-low p-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Συμβόλαιο</p>
              <div className="inline-flex p-1 rounded-full bg-white border border-black/[0.06] w-full">
                {Object.values(BILLING_INTERVALS).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setInterval(opt.id)}
                    className={`flex-1 px-3 py-2 rounded-full text-xs font-bold transition-all ${
                      interval === opt.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-2">
                {AGENCY_PLANS.filter((p) => !p.contactSales).map((p) => {
                  const pPrice = displayPrice(p, interval);
                  const selected = planId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlanId(p.id)}
                      className={`w-full text-left rounded-2xl border px-4 py-3 transition-all ${
                        selected
                          ? 'border-primary/40 bg-white ring-2 ring-primary/15'
                          : 'border-black/[0.06] bg-white/60 hover:bg-white'
                      }`}
                    >
                      <div className="flex justify-between gap-3 items-center">
                        <div>
                          <p className="font-bold text-sm">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.tagline}</p>
                        </div>
                        <p className="font-bold text-sm shrink-0">
                          {pPrice.label}
                          <span className="text-xs font-medium text-gray-500">{pPrice.suffix}</span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-5 text-sm text-emerald-900 space-y-2">
              <p className="font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                Τι θα λάβετε
              </p>
              <ul className="space-y-1 text-emerald-800/90">
                <li>• Control Panel για το γραφείο σας</li>
                <li>• Subdomain: {subdomainPreview}.{BASE_DOMAIN}</li>
                <li>• 14 ημέρες δοκιμή (Professional)</li>
                <li>• Ασφαλής πληρωμή μέσω Stripe</li>
              </ul>
            </div>
          </section>

          <section className="lg:col-span-3">
            <form
              onSubmit={handleSubmit}
              className="rounded-[28px] border border-black/[0.06] bg-white shadow-lg p-6 md:p-8 space-y-5"
            >
              <div className="flex items-center justify-between gap-4 pb-2 border-b border-black/[0.06]">
                <h2 className="text-lg font-bold">Στοιχεία εγγραφής</h2>
                <p className="text-sm font-bold text-primary">
                  {price.label}
                  {price.suffix && (
                    <span className="text-gray-500 font-medium">{price.suffix}</span>
                  )}
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-bold" htmlFor="legal_name">
                  Επωνυμία γραφείου
                </label>
                <input
                  id="legal_name"
                  type="text"
                  required
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl focus:ring-2 focus:ring-primary-container"
                  placeholder="PoreiaGo Travel AE"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold" htmlFor="admin_email">
                  Email διαχειριστή
                </label>
                <input
                  id="admin_email"
                  type="email"
                  required
                  autoComplete="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-4 py-3.5 bg-surface-container-low rounded-2xl focus:ring-2 focus:ring-primary-container"
                  placeholder="admin@achillio.gr"
                />
                <p className="text-xs text-gray-500">Θα χρησιμοποιηθεί για σύνδεση στο Control Panel</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold" htmlFor="subdomain">
                  Subdomain (κωδικός γραφείου)
                </label>
                <div className="flex rounded-2xl overflow-hidden border border-black/[0.08] bg-surface-container-low focus-within:ring-2 focus-within:ring-primary-container">
                  <input
                    id="subdomain"
                    type="text"
                    required
                    value={subdomain}
                    onChange={handleSubdomainChange}
                    className="flex-1 min-w-0 px-4 py-3.5 bg-transparent outline-none font-mono text-sm"
                    placeholder="achillio"
                  />
                  <span className="px-3 py-3.5 text-xs text-gray-500 bg-white/80 border-l border-black/[0.06] shrink-0">
                    .{BASE_DOMAIN}
                  </span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <PasswordField
                  id="password"
                  label="Κωδικός"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <PasswordField
                  id="confirm"
                  label="Επιβεβαίωση κωδικού"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={working}
                className="w-full py-4 rounded-full bg-primary text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
              >
                {working ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                    {demoMode ? 'Δημιουργία demo γραφείου…' : 'Μετάβαση στο Stripe…'}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">
                      {demoMode ? 'science' : 'lock'}
                    </span>
                    {demoMode
                      ? `Ενεργοποίηση demo (${trialDays} ημέρες)`
                      : 'Συνέχεια στην πληρωμή'}
                  </>
                )}
              </button>

              <p className="text-xs text-center text-gray-500">
                {demoMode
                  ? 'Demo πληρωμή — χωρίς χρέωση κάρτας. Μπορείτε αργότερα να ενεργοποιήσετε πραγματικό Stripe.'
                  : 'Με την εγγραφή αποδέχεστε τους όρους SaaS · η χρέωση ξεκινά μετά την ολοκλήρωση του Checkout'}
              </p>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
