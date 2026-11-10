/**
 * Desktop guest landing for /rent — full trust + services surface
 * before login. Mobile still uses the compact phone shell / login gate.
 */
import { useEffect, useMemo, useState } from 'react';
import { RENT_SERVICE_FEATURES, rentServiceCopy } from '../../lib/rental/rentServicesCatalog.js';
import { rentCategoryLabel } from '../../lib/rental/demoRentFleet.js';

const HOME_CATEGORIES = ['', 'CAR', 'VAN', 'MINIBUS'];

const STEPS = [
  {
    n: '01',
    title: 'Δες τον στόλο',
    copy: 'Επιβατικά, van και minibus — τιμές ανά ημέρα, χωρίς λογαριασμό.',
  },
  {
    n: '02',
    title: 'Σύνδεση & κράτηση',
    copy: 'Επίλεξε ημερομηνίες, επιβεβαίωσε όρους ασφάλειας και ολοκλήρωσε σε λίγα βήματα.',
  },
  {
    n: '03',
    title: 'Wallet στο κινητό',
    copy: 'Pass, checklist, SOS και οδική βοήθεια — όλα στο Rent Wallet μετά την κράτηση.',
  },
];

const TRUST_POINTS = [
  {
    icon: 'verified_user',
    title: 'Καθαροί όροι ασφάλειας',
    copy: 'CDW / SCDW και franchise εξηγούνται πριν υπογράψεις.',
  },
  {
    icon: 'support_agent',
    title: 'Υποστήριξη στο δρόμο',
    copy: 'SOS προς το γραφείο και οδική βοήθεια 24/7 στο pass σου.',
  },
  {
    icon: 'qr_code_2',
    title: 'Check-in χωρίς χαρτί',
    copy: 'QR, checklist και έγγραφα στο κινητό — λιγότερη αναμονή στο desk.',
  },
];

function brandHintFromHost() {
  if (typeof window === 'undefined') return '';
  const host = String(window.location.hostname || '')
    .replace(/^www\./i, '')
    .toLowerCase();
  if (!host || host.includes('localhost') || host.includes('poreiago') || host.includes('127.0.0.1')) {
    return '';
  }
  const label = host.split('.')[0] || '';
  if (!label || label.length < 2) return '';
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function RentalGuestLanding({
  branding,
  logoUrl = '',
  homeFleet = [],
  fleetLoading = false,
  favorites = [],
  onToggleFavorite,
  onRequireLogin,
  onPickVehicle,
  contactEmail = '',
  contactPhone = '',
}) {
  const [homeCategory, setHomeCategory] = useState('');
  const [homeQuery, setHomeQuery] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const officeName = useMemo(() => {
    const raw = String(branding?.brandLabel || branding?.officeName || '').trim();
    if (raw && raw !== 'Γραφείο' && raw !== 'Ενοικίαση') return raw;
    return brandHintFromHost() || raw || 'Ενοικιάσεις';
  }, [branding]);

  const filteredHomeFleet = homeFleet
    .filter((v) => (homeCategory ? v.category === homeCategory : true))
    .filter((v) => {
      const q = homeQuery.trim().toLowerCase();
      if (!q) return true;
      return `${v.model || ''} ${v.category || ''} ${v.display_name || ''}`.toLowerCase().includes(q);
    });

  const scrollToFleet = () => {
    document.getElementById('rent-fleet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={`rent-landing${visible ? ' is-ready' : ''}`}>
      <header className="rent-landing-top">
        <div className="rent-landing-top-inner">
          <div className="rent-landing-brand-lockup">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="rent-landing-logo" />
            ) : null}
            <span className="rent-landing-brand-name">{officeName}</span>
          </div>
          <div className="rent-landing-top-actions">
            <button type="button" className="rent-landing-link" onClick={scrollToFleet}>
              Στόλος
            </button>
            <a href="/rent/services" className="rent-landing-link">
              Υπηρεσίες
            </a>
            <button type="button" className="rent-btn rent-btn-ghost" onClick={onRequireLogin}>
              Κράτηση
            </button>
          </div>
        </div>
      </header>

      <section className="rent-landing-hero" aria-label="Ενοικίαση">
        <div className="rent-landing-hero-veil" aria-hidden />
        <div className="rent-landing-hero-inner">
          <p className="rent-landing-hero-brand">{officeName}</p>
          <h1 className="rent-landing-hero-title">{branding.title}</h1>
          <p className="rent-landing-hero-copy">{branding.copy}</p>
          <div className="rent-landing-hero-ctas">
            <button type="button" className="rent-hero-cta" onClick={onRequireLogin}>
              <span className="material-symbols-outlined" aria-hidden>
                lock_open
              </span>
              Σύνδεση για κράτηση
            </button>
            <button type="button" className="rent-landing-secondary-cta" onClick={scrollToFleet}>
              Δες τον στόλο
              <span className="material-symbols-outlined" aria-hidden>
                south
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="rent-landing-section rent-landing-steps" aria-labelledby="rent-steps-title">
        <div className="rent-landing-wrap">
          <p className="rent-landing-kicker">Πώς δουλεύει</p>
          <h2 id="rent-steps-title" className="rent-landing-h2">
            Από την περιήγηση στην παραλαβή
          </h2>
          <p className="rent-landing-lead">
            Τρία ξεκάθαρα βήματα — χωρίς τηλεφωνικό κυνήγι και χωρίς χαρτιά στο desk.
          </p>
          <ol className="rent-landing-steps-list">
            {STEPS.map((step) => (
              <li key={step.n} className="rent-landing-step">
                <span className="rent-landing-step-n" aria-hidden>
                  {step.n}
                </span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="rent-services"
        className="rent-landing-section rent-landing-services"
        aria-labelledby="rent-services-title"
      >
        <div className="rent-landing-wrap">
          <p className="rent-landing-kicker">Υπηρεσίες</p>
          <h2 id="rent-services-title" className="rent-landing-h2">
            Όσα περιλαμβάνει η ενοικίαση
          </h2>
          <p className="rent-landing-lead">
            Υποστήριξη, ασφάλεια και εργαλεία ταξιδιού μέσα από το Rent Wallet — για να νιώθεις
            ασφαλής πριν και κατά τη διαδρομή.
          </p>
          <ul className="rent-landing-services-list">
            {RENT_SERVICE_FEATURES.map((feature) => {
              const copy = rentServiceCopy(feature, 'el');
              return (
                <li key={feature.id} className="rent-landing-service">
                  <span className="rent-landing-service-icon" aria-hidden>
                    <span className="material-symbols-outlined">{feature.icon}</span>
                  </span>
                  <div>
                    <h3>{copy.title}</h3>
                    <p>{copy.copy}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="rent-landing-services-more">
            <a href="/rent/services" className="rent-landing-secondary-cta rent-landing-secondary-cta--ink">
              Όλες οι λεπτομέρειες υπηρεσιών
              <span className="material-symbols-outlined" aria-hidden>
                arrow_forward
              </span>
            </a>
          </div>
        </div>
      </section>

      <section
        id="rent-fleet"
        className="rent-landing-section rent-landing-fleet"
        aria-labelledby="rent-fleet-title"
      >
        <div className="rent-landing-wrap">
          <p className="rent-landing-kicker">Στόλος</p>
          <h2 id="rent-fleet-title" className="rent-landing-h2">
            Στόλος ενοικίασης
          </h2>
          <p className="rent-landing-lead">
            Διάλεξε όχημα για προεπιλογή — μετά θα σε πάει στη σύνδεση για να ολοκληρώσεις την
            κράτηση.
          </p>

          <div className="rent-home-fleet-tools rent-landing-fleet-tools">
            <input
              type="search"
              value={homeQuery}
              onChange={(e) => setHomeQuery(e.target.value)}
              placeholder="Αναζήτηση μοντέλου…"
              aria-label="Αναζήτηση μοντέλου"
            />
            <div className="rent-home-fleet-cats">
              {HOME_CATEGORIES.map((c) => (
                <button
                  key={c || 'all'}
                  type="button"
                  className={homeCategory === c ? 'is-active' : ''}
                  onClick={() => setHomeCategory(c)}
                >
                  {c ? rentCategoryLabel(c) : 'Όλα'}
                </button>
              ))}
            </div>
          </div>

          {fleetLoading ? (
            <p className="rent-home-fleet-empty">Φόρτωση στόλου…</p>
          ) : filteredHomeFleet.length ? (
            <div className="rent-landing-fleet-grid">
              {filteredHomeFleet.map((v) => {
                const cover = v.photo_urls?.[0] || v.photo_url || '';
                const isFav = favorites.includes(v.id);
                const name = v.display_name || v.model || 'Όχημα';
                return (
                  <button
                    key={v.id}
                    type="button"
                    className="rent-landing-fleet-card"
                    onClick={() => {
                      onPickVehicle?.(v);
                      onRequireLogin?.();
                    }}
                  >
                    <span
                      className="rent-home-fleet-fav"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleFavorite?.(v.id);
                      }}
                    >
                      <span className="material-symbols-outlined" aria-hidden>
                        {isFav ? 'favorite' : 'favorite_border'}
                      </span>
                    </span>
                    <div className="rent-landing-fleet-media">
                      {cover ? (
                        <img src={cover} alt={name} loading="lazy" />
                      ) : (
                        <span className="material-symbols-outlined">directions_car</span>
                      )}
                    </div>
                    <div className="rent-landing-fleet-body">
                      <p className="rent-landing-fleet-cat">{rentCategoryLabel(v.category)}</p>
                      <strong>{name}</strong>
                      <span>
                        {v.seating_capacity || '—'} θέσεις · από €
                        {Number(v.daily_rate_eur || 0).toFixed(0)}/ημέρα
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rent-home-fleet-empty">Δεν βρέθηκαν οχήματα για τα φίλτρα.</p>
          )}
        </div>
      </section>

      <section className="rent-landing-section rent-landing-trust" aria-labelledby="rent-trust-title">
        <div className="rent-landing-wrap">
          <p className="rent-landing-kicker">Εμπιστοσύνη</p>
          <h2 id="rent-trust-title" className="rent-landing-h2">
            Γιατί να κλείσεις εδώ
          </h2>
          <p className="rent-landing-lead">
            Διαφάνεια πριν την υπογραφή, υποστήριξη στο δρόμο και ψηφιακό check-in — ώστε να
            ξέρεις τι πληρώνεις και τι σε περιμένει.
          </p>
          <ul className="rent-landing-trust-list">
            {TRUST_POINTS.map((item) => (
              <li key={item.title}>
                <span className="material-symbols-outlined" aria-hidden>
                  {item.icon}
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rent-landing-closer" aria-label="Κράτηση">
        <div className="rent-landing-wrap rent-landing-closer-inner">
          <h2>{officeName}</h2>
          <p>Ετοιμος για κράτηση; Συνδέσου και ολοκλήρωσε σε λίγα λεπτά.</p>
          <button type="button" className="rent-hero-cta" onClick={onRequireLogin}>
            <span className="material-symbols-outlined" aria-hidden>
              directions_car
            </span>
            Ξεκίνα κράτηση
          </button>
        </div>
      </section>

      <footer className="rent-landing-footer">
        <div className="rent-landing-wrap rent-landing-footer-inner">
          <p className="rent-landing-footer-brand">{officeName}</p>
          <div className="rent-landing-footer-meta">
            {contactPhone ? <a href={`tel:${contactPhone}`}>{contactPhone}</a> : null}
            {contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : null}
            <button type="button" onClick={onRequireLogin}>
              Σύνδεση πελάτη
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
