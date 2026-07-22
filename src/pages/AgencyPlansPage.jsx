import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PlatformBrand from '../components/marketing/PlatformBrand.jsx';
import {
  AGENCY_PLANS,
  BILLING_INTERVALS,
  displayPrice,
} from '../lib/billing/planCatalog.js';
import { CAMPAIGN_TEMPLATE_COUNT } from '../lib/marketing/platformCopy.js';
import { getSaasToken } from '../services/saasApi.js';

export default function AgencyPlansPage() {
  const navigate = useNavigate();
  const [interval, setInterval] = useState('month');
  const loggedIn = Boolean(getSaasToken());

  const choosePlan = (planId) => {
    if (planId === 'enterprise') {
      window.location.href = 'mailto:sales@travelos.app?subject=Enterprise%20συμβόλαιο';
      return;
    }
    if (loggedIn) {
      navigate('/admin', {
        state: { activeTab: 'settings', settingsSubTab: 'contracts', plan: planId, interval },
      });
      return;
    }
    navigate(`/grafeia/signup?plan=${planId}&interval=${interval}`);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <PlatformBrand variant="light" />
          <nav className="flex items-center gap-3">
            <Link to="/" className="text-sm font-semibold text-gray-600 hover:text-primary hidden sm:inline">
              Αρχική
            </Link>
            <Link
              to="/admin/login"
              className="text-sm font-bold px-4 py-2 rounded-full bg-gray-900 text-white hover:opacity-90"
            >
              Σύνδεση γραφείου
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 md:py-16 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[16px]">description</span>
            Συμβόλαια SaaS
          </span>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Επιλέξτε το συμβόλαιο του ταξιδιωτικού σας γραφείου
          </h1>
          <p className="text-on-surface-variant text-sm md:text-base">
            Μηνιαία ή ετήσια χρέωση · 14 ημέρες δοκιμή στο Professional · ακύρωση από το Stripe portal
          </p>

          <div className="inline-flex p-1 rounded-full bg-surface-container-low border border-black/[0.06] mt-6">
            {Object.values(BILLING_INTERVALS).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setInterval(opt.id)}
                className={`relative px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                  interval === opt.id
                    ? 'bg-white text-primary shadow-md'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {opt.label}
                {opt.badge && interval === opt.id && (
                  <span className="absolute -top-2 -right-1 text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                    -17%
                  </span>
                )}
              </button>
            ))}
          </div>
          {interval === 'year' && (
            <p className="text-xs text-emerald-700 font-semibold">
              Ετήσιο = 10 μηνιαίες δόσεις (2 μήνες δωρεάν)
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {AGENCY_PLANS.map((plan) => {
            const price = displayPrice(plan, interval);
            return (
              <article
                key={plan.id}
                className={`relative flex flex-col rounded-[28px] border p-6 md:p-8 ${
                  plan.highlighted
                    ? 'border-primary/40 bg-white shadow-xl ring-2 ring-primary/20 scale-[1.02]'
                    : 'border-black/[0.06] bg-surface-container-lowest shadow-sm'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-white text-xs font-bold rounded-full">
                    Προτεινόμενο
                  </span>
                )}
                <h2 className="text-xl font-bold">{plan.name}</h2>
                <p className="text-sm text-on-surface-variant mt-1 mb-6">{plan.tagline}</p>
                <div className="mb-6">
                  {plan.contactSales ? (
                    <p className="text-2xl font-bold">Enterprise</p>
                  ) : (
                    <>
                      <p className="text-3xl font-bold tracking-tight">
                        {price.label}
                        <span className="text-base font-medium text-gray-500">{price.suffix}</span>
                      </p>
                      {price.compareAt && (
                        <p className="text-xs text-gray-400 line-through mt-1">
                          €{price.compareAt}/έτος χωρίς έκπτωση
                        </p>
                      )}
                    </>
                  )}
                </div>
                <ul className="space-y-2 flex-1 text-sm text-on-surface-variant mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px] shrink-0">
                        check_circle
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => choosePlan(plan.id)}
                  className={`w-full py-3.5 rounded-full font-bold text-sm transition-all ${
                    plan.highlighted
                      ? 'bg-primary text-white hover:opacity-90'
                      : 'border border-primary/30 text-primary hover:bg-primary/5'
                  }`}
                >
                  {plan.contactSales ? 'Επικοινωνία πωλήσεων' : loggedIn ? 'Επιλογή συμβολαίου' : 'Ξεκινήστε εγγραφή'}
                </button>
              </article>
            );
          })}
        </div>

        <div className="rounded-[24px] border border-black/[0.06] bg-surface-container-low p-6 md:p-8 text-sm text-on-surface-variant space-y-3">
          <h3 className="font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">info</span>
            Τι περιλαμβάνει το συμβόλαιο
          </h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Πρόσβαση στο Control Panel για το γραφείο σας (όχι platform console)</li>
            <li>Email Hub με {CAMPAIGN_TEMPLATE_COUNT}+ έτοιμα πρότυπα καμπάνιας (προσφορές, εκδρομές, lifecycle)</li>
            <li>Metered χρέωση για ενεργά λεωφορεία & εκδρομές μετά τη βασική συνδρομή</li>
            <li>GDPR εργαλεία για τους πελάτες σας · διαχείριση από Ρυθμίσεις → Συμβόλαια</li>
            <li>Η πλατφόρμα (super admin, backups, SaaS infra) είναι μόνο για τον διαχειριστή συστήματος</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
