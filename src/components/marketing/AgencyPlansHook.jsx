import { Link } from 'react-router-dom';
import { AGENCY_PLANS, BILLING_INTERVALS, displayPrice } from '../../lib/billing/planCatalog.js';
import { CAMPAIGN_TEMPLATE_COUNT, PLATFORM_NAME } from '../../lib/marketing/platformCopy.js';

export default function AgencyPlansHook({ variant = 'hero' }) {
  const pro = AGENCY_PLANS.find((p) => p.id === 'professional');
  const price = displayPrice(pro, 'month');

  if (variant === 'compact') {
    return (
      <Link
        to="/grafeia"
        className="group flex items-center gap-3 px-4 py-2.5 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white text-sm font-bold border border-indigo-400/40 shadow-lg transition-all"
      >
        <span className="material-symbols-outlined text-[18px]">storefront</span>
        Γραφείο ταξιδιών;
        <span className="text-indigo-200 group-hover:text-white">Συμβόλαια από {price.label}{price.suffix}</span>
        <span className="material-symbols-outlined text-[16px] opacity-80">arrow_forward</span>
      </Link>
    );
  }

  return (
    <section
      id="agency-saas"
      className="relative overflow-hidden rounded-[32px] border border-indigo-200/80 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-8 md:p-12 shadow-2xl"
    >
      <div className="absolute top-0 right-0 w-72 h-72 bg-sky-400/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="relative z-10 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-wider mb-4">
            <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
            SaaS {PLATFORM_NAME} · για ταξιδιωτικά γραφεία
          </span>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
            Ψηφιοποιήστε το γραφείο σας — κρατήσεις, στόλος, GPS, billing σε ένα panel
          </h2>
          <p className="text-white/75 text-sm md:text-base leading-relaxed mb-6 max-w-xl">
            Επιλέξτε <strong className="text-white">μηνιαίο ή ετήσιο συμβόλαιο</strong>, ξεκινήστε δοκιμή
            14 ημερών και στείλτε καμπάνιες με {CAMPAIGN_TEMPLATE_COUNT} έτοιμα email πρότυπα.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/grafeia/signup"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-white text-indigo-950 rounded-full font-bold hover:scale-[1.02] transition-transform shadow-lg"
            >
              Ξεκινήστε δωρεάν δοκιμή
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </Link>
            <Link
              to="/grafeia"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-bold border border-white/30 hover:bg-white/10 transition-colors"
            >
              Συμβόλαια & τιμές
            </Link>
          </div>
        </div>
        <div className="grid gap-3">
          {AGENCY_PLANS.filter((p) => !p.contactSales).map((plan) => {
            const m = displayPrice(plan, 'month');
            const y = displayPrice(plan, 'year');
            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-4 border backdrop-blur-sm ${
                  plan.highlighted
                    ? 'bg-white/15 border-sky-300/50 ring-1 ring-sky-400/30'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="font-bold">{plan.name}</p>
                    <p className="text-xs text-white/60 mt-0.5">{plan.tagline}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-lg">
                      {m.label}
                      <span className="text-sm font-medium text-white/70">{m.suffix}</span>
                    </p>
                    <p className="text-[11px] text-emerald-300 font-semibold">
                      ή {y.label}{y.suffix} · {BILLING_INTERVALS.year.badge}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
