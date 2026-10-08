import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AUDIENCE,
  FEATURES,
  FEATURE_LANES,
  FEATURES_BACKGROUND_IMAGE,
  HERO,
  HERO_BACKGROUND_IMAGE,
  PLATFORM_TAGLINE,
  STATS,
  STEPS,
} from '../../lib/marketing/platformCopy.js';
import { mergeRentPlanCatalog } from '../../lib/billing/planCatalog.js';
import { fetchPublicRentPlanCatalog } from '../../services/rentPlanCatalogApi.js';
import AgencyPlansHook from './AgencyPlansHook.jsx';
import '../../styles/platform-landing-rest.css';

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
              href="#platform-trips"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base border border-sky-300/45 bg-sky-500/15 text-sky-50 hover:bg-sky-400/25 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">map</span>
              Εκδρομές
            </a>
            <a
              href="#our-fleet"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base border border-teal-300/50 bg-teal-500/15 text-teal-50 hover:bg-teal-400/25 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">directions_bus</span>
              Στόλος λεωφορείων
            </a>
            <Link
              to="/rent"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold text-base border border-white/25 text-white hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">car_rental</span>
              Ενοικιάσεις
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
    <section className="pg-rest pg-audience" aria-labelledby="audience-title">
      <div className="pg-audience-inner">
        <div className="pg-audience-head">
          <p className="pg-audience-kicker">
            <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16 }}>
              groups
            </span>
            {AUDIENCE.kicker}
          </p>
          <h2 id="audience-title">{AUDIENCE.title}</h2>
          <p>{AUDIENCE.support}</p>
        </div>

        <div className="pg-audience-grid">
          {[
            { key: 'buses', lane: AUDIENCE.buses, mod: 'buses', icon: 'directions_bus' },
            { key: 'rent', lane: AUDIENCE.rent, mod: 'rent', icon: 'car_rental' },
          ].map(({ key, lane, mod, icon }) => (
            <article key={key} className={`pg-audience-lane pg-audience-lane--${mod}`}>
              <p className="pg-audience-lane-kicker">
                <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 15 }}>
                  {icon}
                </span>
                {lane.kicker}
              </p>
              <h3>{lane.title}</h3>
              <ul>
                {lane.points.map((point) => (
                  <li key={point.text}>
                    <span className="material-symbols-outlined" aria-hidden>
                      {point.icon}
                    </span>
                    <span>{point.text}</span>
                  </li>
                ))}
              </ul>
              <a href={lane.href} className="pg-audience-lane-link">
                {mod === 'buses' ? 'Πίσω στις εκδρομές' : 'Πίσω στις ενοικιάσεις'}
                <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 18 }}>
                  arrow_upward
                </span>
              </a>
            </article>
          ))}
        </div>

        <p className="pg-audience-close">{AUDIENCE.close}</p>
      </div>
    </section>
  );
}

export function FeaturesSection() {
  const lanes = useMemo(() => {
    const byLane = { buses: [], rent: [], shared: [] };
    for (const feature of FEATURES) {
      const key = feature.lane && byLane[feature.lane] ? feature.lane : 'shared';
      byLane[key].push(feature);
    }
    return ['buses', 'rent', 'shared'].map((id) => ({
      id,
      meta: FEATURE_LANES[id],
      items: byLane[id],
    }));
  }, []);

  return (
    <section id="features" className="pg-rest pg-features-rest" aria-labelledby="features-title">
      <div className="pg-features-rest-bg" aria-hidden>
        <img src={FEATURES_BACKGROUND_IMAGE} alt="" />
      </div>

      <div className="pg-features-rest-inner">
        <div className="pg-features-rest-head">
          <p className="pg-audience-kicker">Δυνατότητες</p>
          <h2 id="features-title">
            Δύο πόρτες. Ένας πίνακας.
          </h2>
          <p>
            Λεωφορεία για εκδρομές, ενοικιάσεις για αυτοκίνητα — και κοινά εργαλεία brand, email και
            συμβολαίου.
          </p>
        </div>

        <div className="pg-features-lanes">
          {lanes.map((lane) => (
            <article key={lane.id} className={`pg-features-lane pg-features-lane--${lane.id}`}>
              <p className="pg-features-lane-kicker">{lane.meta.kicker}</p>
              <h3>{lane.meta.title}</h3>
              <ul>
                {lane.items.map((item) => (
                  <li key={item.id}>
                    <span className="material-symbols-outlined" aria-hidden>
                      {item.icon}
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.body}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <a href={lane.meta.href} className="pg-features-lane-link">
                {lane.id === 'shared'
                  ? 'Δείτε τιμές'
                  : lane.id === 'buses'
                    ? 'Πίσω στις εκδρομές'
                    : 'Πίσω στις ενοικιάσεις'}
                <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 17 }}>
                  {lane.id === 'shared' ? 'arrow_downward' : 'arrow_upward'}
                </span>
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section className="pg-rest pg-how" aria-labelledby="how-title">
      <div className="pg-how-inner">
        <div className="pg-how-head">
          <h2 id="how-title">Πώς ξεκινάτε</h2>
          <p>Τρία βήματα · λεωφορεία, ενοικιάσεις, ή και τα δύο</p>
        </div>
        <div className="pg-how-steps">
          {STEPS.map((s) => (
            <div key={s.step}>
              <span className="pg-how-step-num">{s.step}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
        <div className="pg-how-cta">
          <Link to="/grafeia">
            Δείτε συμβόλαια & τιμές
            <span className="material-symbols-outlined" aria-hidden>
              payments
            </span>
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
              Ξεχωριστό συμβόλαιο μόνο για Rent, ή add-on πάνω στο πλάνο λεωφορείων. Δες στόλο και
              υπηρεσίες στο <span className="text-white font-semibold">/rent</span> — χωρίς σύνδεση.
            </p>
            <ul className="mt-6 grid sm:grid-cols-2 gap-2.5 text-sm text-teal-50/90">
              {[
                'SOS + live τοποθεσία',
                'Οδική βοήθεια 24/7',
                'CDW / SCDW πριν την υπογραφή',
                'Share trip στην οικογένεια',
                'Checklist πριν την αναχώρηση',
                'Θυρίδα Ενοικιάσεων στον πίνακα',
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
                to="/rent"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-white/25 text-white font-bold hover:bg-white/10"
              >
                Άνοιγμα Rent
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
    <section className="pg-rest pg-final" aria-labelledby="final-cta-title">
      <div className="pg-final-panel">
        <h2 id="final-cta-title">Έτοιμοι να ανοίξετε τις πόρτες σας;</h2>
        <p>
          Επιλέξτε συμβόλαιο για λεωφορεία, ενοικιάσεις, ή και τα δύο — με το brand του γραφείου σας
          από την πρώτη μέρα.
        </p>
        <div className="pg-final-actions">
          <Link to="/grafeia" className="pg-final-cta-btn pg-final-cta-btn--primary">
            Επιλογή συμβολαίου
          </Link>
          <a href="#session-buses" className="pg-final-cta-btn pg-final-cta-btn--buses">
            Λεωφορεία
          </a>
          <a href="#session-rent" className="pg-final-cta-btn pg-final-cta-btn--rent">
            Ενοικιάσεις
          </a>
        </div>
      </div>
    </section>
  );
}
