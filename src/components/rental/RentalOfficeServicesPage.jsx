/**
 * Office-branded full services page for /rent/services on tenant hosts.
 * Builds trust and routes customers into /rent booking.
 */
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { RENT_SERVICE_FEATURES, rentServiceCopy } from '../../lib/rental/rentServicesCatalog.js';
import { resolveOfficeBrand } from '../../lib/branding/officeBrand.js';
import { resolveRentAppBranding } from '../../lib/rental/rentAppBranding.js';
import { fetchSiteAppearance } from '../../services/siteAppearanceApi.js';
import { getRentLang, setRentLang, t } from '../../lib/rental/rentI18n.js';
import '../../styles/rental-pwa.css';

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

const FLOW_STEPS = {
  el: [
    {
      n: '01',
      title: 'Δες υπηρεσίες & στόλο',
      copy: 'Κατάλαβε τι περιλαμβάνεται — ασφάλεια, SOS, οδική — πριν κλείσεις.',
    },
    {
      n: '02',
      title: 'Κράτηση online',
      copy: 'Επίλεξε όχημα και ημερομηνίες στο /rent με σύνδεση πελάτη.',
    },
    {
      n: '03',
      title: 'Wallet στο κινητό',
      copy: 'Pass, checklist και βοήθεια στο δρόμο — όλα μετά την επιβεβαίωση.',
    },
  ],
  en: [
    {
      n: '01',
      title: 'Review services & fleet',
      copy: 'See what is included — cover, SOS, roadside — before you book.',
    },
    {
      n: '02',
      title: 'Book online',
      copy: 'Pick a vehicle and dates on /rent after customer login.',
    },
    {
      n: '03',
      title: 'Wallet on your phone',
      copy: 'Pass, checklist and roadside help — all after confirmation.',
    },
  ],
};

export default function RentalOfficeServicesPage() {
  const lang = getRentLang();
  const en = lang === 'en';
  const [branding, setBranding] = useState(() => resolveRentAppBranding({}, { guest: true }));
  const [logoUrl, setLogoUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSiteAppearance()
      .then((data) => {
        if (cancelled) return;
        const brand = resolveOfficeBrand(data || {});
        setLogoUrl(brand.logoUrl || '');
        setContactEmail(String(data?.footer_contact_email || '').trim());
        setContactPhone(String(data?.footer_contact_phone || '').trim());
        setBranding(
          resolveRentAppBranding(
            {
              ...(data || {}),
              footer_brand_name: data?.footer_brand_name || brand.displayName || brand.name,
              display_name: brand.displayName || brand.name,
            },
            { guest: true },
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const officeName = useMemo(() => {
    const raw = String(branding?.brandLabel || branding?.officeName || '').trim();
    if (raw && raw !== 'Γραφείο' && raw !== 'Ενοικίαση') return raw;
    return brandHintFromHost() || raw || (en ? 'Rentals' : 'Ενοικιάσεις');
  }, [branding, en]);

  const steps = FLOW_STEPS[en ? 'en' : 'el'];

  return (
    <div className={`rent-landing rent-services-page${ready ? ' is-ready' : ''}`}>
      <header className="rent-landing-top">
        <div className="rent-landing-top-inner">
          <Link to="/rent" className="rent-landing-brand-lockup" style={{ textDecoration: 'none' }}>
            {logoUrl ? <img src={logoUrl} alt="" className="rent-landing-logo" /> : null}
            <span className="rent-landing-brand-name">{officeName}</span>
          </Link>
          <div className="rent-landing-top-actions">
            <button
              type="button"
              className="rent-landing-link"
              onClick={() => {
                setRentLang(en ? 'el' : 'en');
                window.location.reload();
              }}
            >
              {en ? 'EL' : 'EN'}
            </button>
            <Link to="/rent" className="rent-landing-link">
              {en ? 'Fleet' : 'Στόλος'}
            </Link>
            <Link to="/rent" className="rent-btn rent-btn-ghost" style={{ textDecoration: 'none' }}>
              {t('book', lang)}
            </Link>
          </div>
        </div>
      </header>

      <section className="rent-landing-hero rent-services-hero" aria-label={t('services_kicker', lang)}>
        <div className="rent-landing-hero-veil" aria-hidden />
        <div className="rent-landing-hero-inner">
          <p className="rent-landing-hero-brand">{officeName}</p>
          <h1 className="rent-landing-hero-title">{t('services_hero_title', lang)}</h1>
          <p className="rent-landing-hero-copy">{t('services_hero_copy', lang)}</p>
          <div className="rent-landing-hero-ctas">
            <Link to="/rent" className="rent-hero-cta" style={{ textDecoration: 'none' }}>
              <span className="material-symbols-outlined" aria-hidden>
                directions_car
              </span>
              {t('services_cta_fleet', lang)}
            </Link>
            <a href="#service-list" className="rent-landing-secondary-cta">
              {t('services_title', lang)}
              <span className="material-symbols-outlined" aria-hidden>
                south
              </span>
            </a>
          </div>
        </div>
      </section>

      <section className="rent-landing-section" aria-labelledby="services-flow-title">
        <div className="rent-landing-wrap">
          <p className="rent-landing-kicker">{en ? 'Journey' : 'Διαδρομή'}</p>
          <h2 id="services-flow-title" className="rent-landing-h2">
            {en ? 'From trust to keys in hand' : 'Από την εμπιστοσύνη στα κλειδιά'}
          </h2>
          <p className="rent-landing-lead">
            {en
              ? 'Everything you need to feel safe booking — then the fleet and wallet take over.'
              : 'Όσα χρειάζεσαι για να κλείσεις με ασφάλεια — μετά μπαίνει στόλος και Wallet.'}
          </p>
          <ol className="rent-landing-steps-list">
            {steps.map((step) => (
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
        id="service-list"
        className="rent-landing-section rent-landing-services"
        aria-labelledby="service-list-title"
      >
        <div className="rent-landing-wrap">
          <p className="rent-landing-kicker">{t('services_kicker', lang)}</p>
          <h2 id="service-list-title" className="rent-landing-h2">
            {t('services_title', lang)}
          </h2>
          <p className="rent-landing-lead">{t('services_lead', lang)}</p>

          <ul className="rent-services-detail-list">
            {RENT_SERVICE_FEATURES.map((feature) => {
              const copy = rentServiceCopy(feature, lang);
              return (
                <li key={feature.id} className="rent-services-detail">
                  <div className="rent-services-detail-head">
                    <span className="rent-landing-service-icon" aria-hidden>
                      <span className="material-symbols-outlined">{feature.icon}</span>
                    </span>
                    <div>
                      <h3>{copy.title}</h3>
                      <p>{copy.copy}</p>
                    </div>
                  </div>
                  {copy.details?.length ? (
                    <ul className="rent-services-detail-bullets">
                      {copy.details.map((line) => (
                        <li key={line}>
                          <span className="material-symbols-outlined" aria-hidden>
                            check_circle
                          </span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="rent-landing-closer" aria-label={t('book', lang)}>
        <div className="rent-landing-wrap rent-landing-closer-inner">
          <h2>{officeName}</h2>
          <p>
            {en
              ? 'Ready to rent? Open the fleet and finish booking in a few steps.'
              : 'Έτοιμος για ενοικίαση; Άνοιξε τον στόλο και ολοκλήρωσε σε λίγα βήματα.'}
          </p>
          <Link to="/rent" className="rent-hero-cta" style={{ textDecoration: 'none' }}>
            <span className="material-symbols-outlined" aria-hidden>
              lock_open
            </span>
            {t('services_cta_fleet', lang)}
          </Link>
        </div>
      </section>

      <footer className="rent-landing-footer">
        <div className="rent-landing-wrap rent-landing-footer-inner">
          <p className="rent-landing-footer-brand">{officeName}</p>
          <div className="rent-landing-footer-meta">
            {contactPhone ? <a href={`tel:${contactPhone}`}>{contactPhone}</a> : null}
            {contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : null}
            <Link to="/rent">{en ? 'Customer login' : 'Σύνδεση πελάτη'}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
