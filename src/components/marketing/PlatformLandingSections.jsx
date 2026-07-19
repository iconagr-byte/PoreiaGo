import { Link } from 'react-router-dom';
import {
  AUDIENCE_HOOKS,
  FEATURES,
  HERO,
  HERO_BACKGROUND_IMAGE,
  PLATFORM_TAGLINE,
  STATS,
  STEPS,
} from '../../lib/marketing/platformCopy.js';
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
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-bold uppercase tracking-wider text-sky-200 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {HERO.badge}
          </span>

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
              Ξεκινήστε δωρεάν δοκιμή
              <span className="material-symbols-outlined">arrow_forward</span>
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
              className="rounded-2xl bg-white/5 border border-white/10 px-4 py-4 backdrop-blur-sm"
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
    <section className="relative py-20 md:py-28 overflow-hidden bg-gradient-to-b from-white via-indigo-50/40 to-slate-50 border-y border-slate-200/60">
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.12), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(139,92,246,0.08), transparent)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.35] pointer-events-none"
        aria-hidden
        style={{
          backgroundImage:
            'linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 md:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-100/80 border border-indigo-200/60 text-xs font-bold uppercase tracking-wider text-indigo-700 mb-5">
            <span className="material-symbols-outlined text-[16px]">groups</span>
            Για ποιον είναι
          </span>
          <h2 className="text-2xl md:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
            Αναγνωρίζετε τον εαυτό σας;
          </h2>
          <p className="text-slate-600 mt-3 text-base md:text-lg leading-relaxed">
            Πέντε καθημερινές προκλήσεις που λύνουμε με μία πλατφόρμα.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 md:gap-5 max-w-5xl mx-auto">
          {AUDIENCE_HOOKS.map((item, index) => {
            const iconStyle = FEATURE_ICON_STYLES[item.accent] || FEATURE_ICON_STYLES.indigo;
            const gridClass =
              index < 3
                ? 'lg:col-span-2'
                : index === 3
                  ? 'lg:col-span-2 lg:col-start-2'
                  : 'lg:col-span-2 lg:col-start-4';

            return (
              <article
                key={item.text}
                className={`group relative flex flex-col sm:flex-row lg:flex-col gap-4 p-6 md:p-7 rounded-[22px] bg-white/90 backdrop-blur-sm border border-white shadow-[0_4px_24px_rgba(15,23,42,0.05)] hover:shadow-[0_16px_48px_rgba(99,102,241,0.12)] hover:border-indigo-200/80 hover:-translate-y-1 transition-all duration-300 ${gridClass}`}
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
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-indigo-50 text-indigo-400 flex items-center justify-center text-xs font-black opacity-40 group-hover:opacity-100 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-all"
                  aria-hidden
                >
                  {index + 1}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-12 md:mt-16 max-w-2xl mx-auto text-center">
          <div className="inline-flex flex-col items-center gap-4 px-8 py-6 rounded-[24px] bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xl shadow-indigo-900/20">
            <span className="material-symbols-outlined text-[28px] text-indigo-300">handshake</span>
            <p className="text-sm md:text-base text-white/90 leading-relaxed font-medium">
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
      className="py-24 md:py-32 bg-[#f5f5f7] antialiased font-[system-ui,-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif]"
    >
      <div className="max-w-[980px] mx-auto px-5 md:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14 md:mb-20">
          <p className="text-sm font-medium text-[#6e6e73] tracking-wide mb-3">Δυνατότητες</p>
          <h2 className="text-[32px] md:text-[48px] font-semibold text-[#1d1d1f] tracking-[-0.02em] leading-[1.08]">
            Ό,τι χρειάζεται ένα σύγχρονο γραφείο.
            <br className="hidden sm:block" />
            <span className="text-[#6e6e73]"> Built-in.</span>
          </h2>
          <p className="text-[17px] md:text-[19px] text-[#6e6e73] mt-5 leading-relaxed font-normal">
            Έτοιμη υποδομή για περισσότερες εκδρομές με λιγότερο admin.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {FEATURES.map((f) => {
            const iconStyle = FEATURE_ICON_STYLES[f.accent] || FEATURE_ICON_STYLES.indigo;
            return (
              <article
                key={f.title}
                className="group flex flex-col rounded-[22px] bg-white/90 backdrop-blur-xl p-7 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition-[box-shadow,transform] duration-500 ease-out hover:-translate-y-0.5"
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
    <section className="py-20 bg-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold">Πώς ξεκινάτε</h2>
          <p className="text-white/60 mt-3">Τρία βήματα · χωρίς IT ομάδα</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <div key={s.step} className="relative">
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-white/15" />
              )}
              <span className="text-4xl font-black text-white/20">{s.step}</span>
              <h3 className="text-xl font-bold mt-2 mb-2">{s.title}</h3>
              <p className="text-sm text-white/65 leading-relaxed">{s.body}</p>
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
