import PlatformBrand from '../components/marketing/PlatformBrand.jsx';
import PlatformBusesSession from '../components/marketing/PlatformBusesSession.jsx';
import PlatformWalletSession from '../components/marketing/PlatformWalletSession.jsx';
import PlatformMarketingHeader from '../components/marketing/PlatformMarketingHeader.jsx';
import PlatformServiceHub from '../components/marketing/PlatformServiceHub.jsx';
import {
  FeaturesSection,
  FinalCtaSection,
  PainPointsSection,
  PricingTeaserSection,
  RentProductSection,
} from '../components/marketing/PlatformLandingSections.jsx';
import { PLATFORM_BRAND_LINE, PLATFORM_NAME } from '../lib/marketing/platformCopy.js';
import { Link } from 'react-router-dom';
import '../styles/platform-landing-rest.css';

export default function FrontPage() {
  return (
    <div
      className="pg-home-shell min-h-screen bg-slate-950 text-white"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      <PlatformMarketingHeader />

      <main>
        <PlatformServiceHub />
        <PlatformBusesSession />
        <PlatformWalletSession />
        <PainPointsSection />
        <FeaturesSection />
        <PricingTeaserSection />
        <FinalCtaSection />
      </main>

      <footer className="pg-site-footer">
        <div className="pg-site-footer-inner">
          <div className="pg-site-footer-brand">
            <PlatformBrand variant="dark" asLink={false} />
            <p>
              Cloud πλατφόρμα για ταξιδιωτικά γραφεία — κρατήσεις, στόλος, GPS, ενοικιάσεις, χρεώσεις.
            </p>
          </div>

          <div className="pg-site-footer-cols">
            <div className="pg-site-footer-col">
              <span className="pg-site-footer-label pg-site-footer-label--buses">Λεωφορεία</span>
              <a href="#session-buses">Εκδρομές & λεωφορεία</a>
              <a href="#platform-trips">Εκδρομές</a>
              <a href="#our-fleet">Στόλος</a>
              <a href="#session-wallet">My Wallet</a>
              <a href="#features">Λειτουργίες</a>
            </div>
            <div className="pg-site-footer-col">
              <span className="pg-site-footer-label pg-site-footer-label--rent">Ενοικιάσεις</span>
              <Link to="/rent">Ενοικιάσεις οχημάτων</Link>
              <Link to="/rent">Σελίδα Rent</Link>
              <Link to="/grafeia">Συμβόλαια Rent</Link>
            </div>
            <div className="pg-site-footer-col">
              <span className="pg-site-footer-label">Πλατφόρμα</span>
              <a href="#pricing">Τιμές</a>
              <Link to="/my-booking">Ανάκτηση κράτησης</Link>
            </div>
          </div>
        </div>
        <p className="pg-site-footer-copy">
          © {new Date().getFullYear()} {PLATFORM_NAME} — {PLATFORM_BRAND_LINE}
        </p>
      </footer>
    </div>
  );
}
