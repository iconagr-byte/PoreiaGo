/**
 * Public shareable page: /rent/services — advertise Rent trip-safety services.
 * No login required. CTA → /rent for fleet + booking.
 */
import { Link, useNavigate } from 'react-router-dom';
import RentalServicesShowcase from '../components/rental/RentalServicesShowcase.jsx';
import { getRentLang, setRentLang, t } from '../lib/rental/rentI18n.js';
import '../styles/rental-pwa.css';

export default function RentalServicesPage() {
  const navigate = useNavigate();
  const lang = getRentLang();

  return (
    <div className="rent-phone-stage rent-services-page">
      <div className="rent-app rent-app--guest rent-app--services">
        <header className="rent-topbar">
          <Link to="/rent" className="rent-topbar-brand">
            Rent
          </Link>
          <div className="rent-topbar-actions">
            <button
              type="button"
              className="rent-btn rent-btn-ghost"
              onClick={() => {
                setRentLang(lang === 'en' ? 'el' : 'en');
                navigate(0);
              }}
            >
              {lang === 'en' ? 'EL' : 'EN'}
            </button>
            <Link to="/rent" className="rent-btn rent-btn-ghost">
              {t('book', lang)}
            </Link>
          </div>
        </header>

        <main className="rent-home">
          <section className="rent-hero" aria-label={t('services_title', lang)}>
            <p className="rent-hero-brand">Rent</p>
            <h1 className="rent-hero-title">{t('services_hero_title', lang)}</h1>
            <p className="rent-hero-copy">{t('services_hero_copy', lang)}</p>
          </section>

          <div className="rent-home-stack">
            <RentalServicesShowcase
              onCta={() => navigate('/rent')}
              ctaLabel={t('services_cta_fleet', lang)}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
