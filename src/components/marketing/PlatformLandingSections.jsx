import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AUDIENCE_HOOKS,
  FEATURES,
  FEATURES_BACKGROUND_IMAGE,
  HERO,
  HERO_BACKGROUND_IMAGE,
  PLATFORM_TAGLINE,
  STATS,
  STEPS,
} from '../../lib/marketing/platformCopy.js';
import {
  getPlatformDemoFleetPreview,
  getPlatformDemoTripPreview,
  PLATFORM_DEMO_COPY,
} from '../../lib/marketing/platformDemoShowcase.js';
import { mergeRentPlanCatalog } from '../../lib/billing/planCatalog.js';
import { fetchPublicRentPlanCatalog } from '../../services/rentPlanCatalogApi.js';
import AgencyPlansHook from './AgencyPlansHook.jsx';

const FEATURE_ICON_STYLES = {
  violet: 'bg-gradient-to-br from-[#ede8ff] to-[#f7f4ff] text-[#7d5ae8]',
  sky: 'bg-gradient-to-br from-[#e3f0ff] to-[#f2f8ff] text-[#0077ed]',
  emerald: 'bg-gradient-to-br from-[#dff7ec] to-[#f0fdf7] text-[#1f9d62]',
  indigo: 'bg-gradient-to-br from-[#e8ecff] to-[#f4f6ff] text-[#4f5bd5]',
  amber: 'bg-gradient-to-br from-[#fff4df] to-[#fffaf0] text-[#c9860a]',
  rose: 'bg-gradient-to-br from-[#ffe8ef] to-[#fff5f8] text-[#e84a7a]',
};

export function HeroSection() {
  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden bg-slate-950">
      <div className="absolute inset-0" aria-hidden>
        <img
          src={HERO_BACKGROUND_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/88 to-slate-950/45 lg:to-slate-950/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/55" />
      </div>

      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_15%_20%,rgba(56,189,248,0.12),transparent)] pointer-events-none z-[1]"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.15] z-[1] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 md:px-8 py-28 md:py-32">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-white leading-[1.08] tracking-tight mb-6">
            {HERO.title}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-cyan-200 to-indigo-300">
              {HERO.titleAccent}
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/70 leading-relaxed mb-8 max-w-2xl">
            {HERO.subtitle}
          </p>

          <div className="flex flex-wrap gap-3 mb-10">
            <Link
              to="/grafeia"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-slate-900 rounded-full font-bold text-base hover:scale-[1.02] shadow-xl shadow-black/20 transition-transform"
            >
              Δείτε τα συμβόλαια
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
            <a
              href="#platform-demo-fleet"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base border border-teal-300/50 bg-teal-500/15 text-teal-50 hover:bg-teal-400/25 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">directions_bus</span>
              Στόλος demo
            </a>
            <a
              href="#platform-demo-trips"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base border border-sky-300/45 bg-sky-500/15 text-sky-50 hover:bg-sky-400/25 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">map</span>
              Εκδρομές demo
            </a>
            <Link
              to="/rent"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base border border-white/25 text-white hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">car_rental</span>
              Ενοικιάσεις
            </Link>
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base border border-white/25 text-white hover:bg-white/10 transition-colors"
            >
              Σύνδεση γραφείου
            </Link>
          </div>

          <p className="text-sm text-white/45">{PLATFORM_TAGLINE}</p>
        </div>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
          {STATS.map((s) => (
            <div
              key={s.label}
              className={`rounded-2xl border px-4 py-4 backdrop-blur-sm ${
                s.value === 'Rent'
                  ? 'bg-teal-500/15 border-teal-300/30'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <p className="text-xl md:text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/55 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PainPointsSection() {
  return (
    <section className="relative py-20 md:py-28 overflow-hidden bg-[#f5f7fb] border-y border-slate-200/70 text-slate-900">
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(ellipse 90% 55% at 50% -15%, rgba(99,102,241,0.10), transparent 58%), radial-gradient(ellipse 50% 35% at 0% 80%, rgba(14,165,233,0.06), transparent 55%), radial-gradient(ellipse 45% 30% at 100% 90%, rgba(99,102,241,0.05), transparent 50%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        aria-hidden
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'linear-gradient(180deg, black 0%, transparent 92%)',
          WebkitMaskImage: 'linear-gradient(180deg, black 0%, transparent 92%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 md:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-100/90 border border-indigo-200/70 text-xs font-bold uppercase tracking-wider text-indigo-700 mb-5">
            <span className="material-symbols-outlined text-[16px]">groups</span>
            Για ποιον είναι
          </span>
          <h2 className="text-2xl md:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
            Αναγνωρίζετε τον εαυτό σας;
          </h2>
          <p className="text-slate-600 mt-3 text-base md:text-lg leading-relaxed">
            Έξι καθημερινές προκλήσεις που λύνουμε με μία πλατφόρμα.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 max-w-5xl mx-auto">
          {AUDIENCE_HOOKS.map((item, index) => {
            const iconStyle = FEATURE_ICON_STYLES[item.accent] || FEATURE_ICON_STYLES.indigo;

            return (
              <article
                key={item.text}
                className="group relative flex flex-col gap-4 p-6 md:p-7 rounded-[22px] bg-gradient-to-br from-indigo-50/90 via-white to-sky-50/70 border border-indigo-200/70 shadow-[0_8px_28px_rgba(79,91,213,0.08)] hover:shadow-[0_16px_40px_rgba(79,91,213,0.14)] hover:border-indigo-300 hover:-translate-y-1 transition-all duration-300"
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${iconStyle}`}
                >
                  <span className="material-symbols-outlined text-[24px] font-light" aria-hidden>
                    {item.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] md:text-base font-semibold text-slate-800 leading-snug group-hover:text-slate-900">
                    {item.text}
                  </p>
                  <span className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Ναι — αυτό λύνουμε
                  </span>
                </div>
                <div
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-indigo-100/90 text-indigo-500 flex items-center justify-center text-xs font-black"
                  aria-hidden
                >
                  {index + 1}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-12 md:mt-16 max-w-2xl mx-auto text-center">
          <div className="inline-flex flex-col items-center gap-4 px-8 py-6 rounded-[24px] bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-200/80 shadow-[0_8px_32px_rgba(99,102,241,0.08)] text-slate-800">
            <span className="material-symbols-outlined text-[28px] text-indigo-500">handshake</span>
            <p className="text-sm md:text-base text-slate-600 leading-relaxed font-medium">
              Αν απαντήσατε «ναι» σε οποιοδήποτε — η πλατφόρμα είναι φτιαγμένη για εσάς, όχι για ένα
              μεμονωμένο brand.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative isolate overflow-hidden py-24 md:py-32 antialiased font-[system-ui,-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif]"
    >
      <div className="absolute inset-0 -z-10" aria-hidden>
        <img
          src={FEATURES_BACKGROUND_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[center_45%]"
        />
        <div className="absolute inset-0 bg-slate-950/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/45 to-slate-950/75" />
      </div>

      <div className="relative max-w-[980px] mx-auto px-5 md:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14 md:mb-20">
          <p className="text-sm font-medium text-white/65 tracking-wide mb-3">Δυνατότητες</p>
          <h2 className="text-[32px] md:text-[48px] font-semibold text-white tracking-[-0.02em] leading-[1.08]">
            Ό,τι χρειάζεται ένα σύγχρονο γραφείο.
            <br className="hidden sm:block" />
            <span className="text-white/70"> Built-in.</span>
          </h2>
          <p className="text-[17px] md:text-[19px] text-white/70 mt-5 leading-relaxed font-normal">
            Έτοιμη υποδομή για περισσότερες εκδρομές με λιγότερο admin.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {FEATURES.map((f) => {
            const iconStyle = FEATURE_ICON_STYLES[f.accent] || FEATURE_ICON_STYLES.indigo;
            return (
              <article
                key={f.title}
                className="group flex flex-col rounded-[22px] bg-white/92 backdrop-blur-xl p-7 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.22)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.28)] transition-[box-shadow,transform] duration-500 ease-out hover:-translate-y-0.5"
              >
                <div
                  className={`w-[52px] h-[52px] rounded-[14px] flex items-center justify-center mb-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ${iconStyle}`}
                >
                  <span className="material-symbols-outlined text-[26px] font-light" aria-hidden>
                    {f.icon}
                  </span>
                </div>

                <h3 className="text-[19px] font-semibold text-[#1d1d1f] tracking-[-0.01em] leading-snug mb-2">
                  {f.title}
                </h3>
                <p className="text-[15px] text-[#6e6e73] leading-[1.55] flex-1">{f.body}</p>
                <p className="text-[13px] font-medium text-[#0071e3] mt-4 leading-snug group-hover:underline decoration-[#0071e3]/40 underline-offset-2">
                  {f.hook}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section className="py-20 md:py-24 bg-white text-slate-900 border-y border-slate-200/70">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1d1d1f]">Πώς ξεκινάτε</h2>
          <p className="text-[#6e6e73] mt-3">Τρία βήματα · χωρίς IT ομάδα</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <div key={s.step} className="relative">
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-slate-200" />
              )}
              <span className="text-4xl font-black text-slate-200">{s.step}</span>
              <h3 className="text-xl font-bold mt-2 mb-2 text-[#1d1d1f]">{s.title}</h3>
              <p className="text-sm text-[#6e6e73] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <Link
            to="/grafeia"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-sky-500 hover:bg-sky-400 text-white rounded-full font-bold transition-colors"
          >
            Δείτε συμβόλαια & τιμές
            <span className="material-symbols-outlined">payments</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function PricingTeaserSection() {
  return (
    <section id="pricing" className="py-20 md:py-24 px-4 md:px-8 max-w-6xl mx-auto">
      <AgencyPlansHook />
    </section>
  );
}

export function RentProductSection() {
  const [standalone, setStandalone] = useState(() => mergeRentPlanCatalog(null).standalone);

  useEffect(() => {
    let cancelled = false;
    fetchPublicRentPlanCatalog().then((data) => {
      if (!cancelled) setStandalone(data.standalone);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (standalone.visible === false) return null;

  return (
    <section
      id="rent"
      className="relative py-20 md:py-28 overflow-hidden border-y border-teal-900/20 bg-gradient-to-b from-[#062a30] via-[#0b3d4a] to-slate-950"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(ellipse 70% 50% at 15% 20%, rgba(45,212,191,0.25), transparent), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(56,189,248,0.12), transparent)',
        }}
      />
      <div className="relative max-w-6xl mx-auto px-4 md:px-8">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 items-center">
          <div>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-400/15 border border-teal-300/25 text-xs font-bold uppercase tracking-wider text-teal-200 mb-5">
              <span className="material-symbols-outlined text-[16px]">car_rental</span>
              Νέα υπηρεσία · Rent
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
              Ενοικιάσεις οχημάτων με SOS, οδική βοήθεια και καθαρή ασφάλεια
            </h2>
            <p className="mt-4 text-base md:text-lg text-teal-50/75 leading-relaxed max-w-xl">
              Ξεχωριστό συμβόλαιο μόνο για Rent, ή add-on πάνω στο πλάνο λεωφορείων. Δες τον στόλο
              παραπάνω ή τις υπηρεσίες στο{' '}
              <span className="text-white font-semibold">/rent/services</span> — χωρίς σύνδεση.
            </p>
            <ul className="mt-6 grid sm:grid-cols-2 gap-2.5 text-sm text-teal-50/90">
              {[
                'SOS + live τοποθεσία',
                'Οδική βοήθεια 24/7',
                'CDW / SCDW πριν την υπογραφή',
                'Share trip στην οικογένεια',
                'Checklist πριν την αναχώρηση',
                'Desk Ενοικιάσεις στο panel',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-teal-300 text-[18px] mt-0.5">
                    check_circle
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#rent-guest-fleet"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white text-teal-950 font-bold hover:bg-teal-50"
              >
                Δες τον στόλο
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </a>
              <Link
                to="/rent/services"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-white/25 text-white font-bold hover:bg-white/10"
              >
                Υπηρεσίες Rent
              </Link>
              <Link
                to="/grafeia"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-white/25 text-white font-bold hover:bg-white/10"
              >
                Συμβόλαια Rent
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <article className="rounded-[24px] border border-white/15 bg-white/10 backdrop-blur-md p-6 text-white">
              <p className="text-[11px] font-bold uppercase tracking-wider text-teal-200">
                {standalone.badge}
              </p>
              <h3 className="mt-2 text-xl font-bold">{standalone.name}</h3>
              <p className="mt-1 text-sm text-white/65">
                {standalone.tagline}
              </p>
              <p className="mt-4 text-2xl font-bold tabular-nums">
                από €{standalone.monthlyEur}
                <span className="text-sm font-semibold text-white/55">/μήνα</span>
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section className="py-20 px-4 md:px-8">
      <div className="max-w-4xl mx-auto text-center rounded-[32px] bg-gradient-to-br from-indigo-600 to-violet-700 p-10 md:p-14 text-white shadow-2xl">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">
          Έτοιμοι να ξεκινήσετε;
        </h2>
        <p className="text-white/80 mb-8 max-w-lg mx-auto">
          Συνδεθείτε στο panel του γραφείου σας ή ζητήστε συμβόλαιο — η πλατφόρμα δουλεύει από την πρώτη μέρα.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/admin/login"
            className="px-8 py-3.5 bg-white text-indigo-900 rounded-full font-bold hover:opacity-95"
          >
            Σύνδεση γραφείου
          </Link>
          <Link
            to="/grafeia"
            className="px-8 py-3.5 border border-white/40 rounded-full font-bold hover:bg-white/10"
          >
            Επιλογή συμβολαίου
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Prospective-buyer showcase: rent στόλος + bus εκδρομές (marketing host only). */
export function PlatformDemoShowcase() {
  const fleet = getPlatformDemoFleetPreview(3);
  const trips = getPlatformDemoTripPreview(3);

  return (
    <section
      id="platform-demo"
      className="relative py-20 md:py-24 bg-slate-950 border-y border-white/10 overflow-hidden"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(ellipse 70% 50% at 15% 0%, rgba(45,212,191,0.12), transparent 55%), radial-gradient(ellipse 60% 45% at 90% 20%, rgba(56,189,248,0.10), transparent 50%)',
        }}
      />
      <div className="relative max-w-6xl mx-auto px-4 md:px-8">
        <div className="max-w-2xl mb-12 md:mb-14">
          <p className="text-sm font-semibold tracking-wide text-teal-300/90 mb-3">
            {PLATFORM_DEMO_COPY.kicker}
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
            {PLATFORM_DEMO_COPY.title}
          </h2>
          <p className="mt-4 text-base md:text-lg text-white/65 leading-relaxed">
            {PLATFORM_DEMO_COPY.subtitle}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12">
          <div id="platform-demo-fleet" className="scroll-mt-28">
            <div className="flex items-end justify-between gap-3 mb-5">
              <h3 className="text-xl font-bold text-white">{PLATFORM_DEMO_COPY.fleetTitle}</h3>
              <Link
                to="/rent#rent-guest-fleet"
                className="text-sm font-bold text-teal-300 hover:text-teal-200 inline-flex items-center gap-1"
              >
                {PLATFORM_DEMO_COPY.fleetCta}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {fleet.map((v) => (
                <Link
                  key={v.id}
                  to={v.href}
                  className="group rounded-2xl overflow-hidden border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] transition-colors"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-slate-900">
                    <img
                      src={v.photo}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="p-3.5">
                    <p className="font-bold text-white text-sm tracking-tight">{v.title}</p>
                    <p className="text-xs text-teal-300/90 font-semibold mt-1">{v.priceLabel}</p>
                    <p className="text-[11px] text-white/45 mt-1">{v.seats} θέσεις</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div id="platform-demo-trips" className="scroll-mt-28">
            <div className="flex items-end justify-between gap-3 mb-5">
              <h3 className="text-xl font-bold text-white">{PLATFORM_DEMO_COPY.tripsTitle}</h3>
              {trips[0] ? (
                <Link
                  to={trips[0].href}
                  className="text-sm font-bold text-sky-300 hover:text-sky-200 inline-flex items-center gap-1"
                >
                  {PLATFORM_DEMO_COPY.tripsCta}
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              ) : null}
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {trips.map((t) => (
                <Link
                  key={t.id}
                  to={t.href}
                  className="group rounded-2xl overflow-hidden border border-white/10 bg-white/[0.04] hover:bg-white/[0.07] transition-colors"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-slate-900">
                    <img
                      src={t.photo}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="p-3.5">
                    <p className="font-bold text-white text-sm tracking-tight leading-snug">{t.title}</p>
                    <p className="text-xs text-sky-300/90 font-semibold mt-1">{t.priceLabel}</p>
                    {t.blurb ? (
                      <p className="text-[11px] text-white/45 mt-1 line-clamp-2">{t.blurb}</p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
