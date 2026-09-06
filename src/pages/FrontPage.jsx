import PlatformBrand from '../components/marketing/PlatformBrand.jsx';
import PlatformMarketingHeader from '../components/marketing/PlatformMarketingHeader.jsx';
import PlatformOpsShowcase from '../components/marketing/PlatformOpsShowcase.jsx';
import {
  FeaturesSection,
  FinalCtaSection,
  HeroSection,
  HowItWorksSection,
  PainPointsSection,
  PricingTeaserSection,
} from '../components/marketing/PlatformLandingSections.jsx';
import { PLATFORM_NAME } from '../lib/marketing/platformCopy.js';
import { Link } from 'react-router-dom';

export default function FrontPage() {
  return (
    <div
      className="min-h-screen bg-slate-950 text-white"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      <PlatformMarketingHeader />

      <main>
        <HeroSection />
        <PlatformOpsShowcase />
        <PainPointsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingTeaserSection />
        <FinalCtaSection />
      </main>

      <footer className="border-t border-white/10 bg-slate-950 py-12">
        <div className="max-w-6xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between gap-8">
          <div>
            <PlatformBrand variant="dark" asLink={false} />
            <p className="text-sm text-white/45 mt-4 max-w-xs">
              Cloud πλατφόρμα για ταξιδιωτικά γραφεία — κρατήσεις, στόλος, GPS, ενοικιάσεις, χρεώσεις.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/55">
            <div className="flex flex-col gap-2 min-w-[8rem]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-300/80">
                Λεωφορεία
              </span>
              <a href="#platform-trips" className="hover:text-white">
                Εκδρομές
              </a>
              <a href="#our-fleet" className="hover:text-white">
                Στόλος
              </a>
              <a href="#features" className="hover:text-white">
                Λειτουργίες
              </a>
            </div>
            <div className="flex flex-col gap-2 min-w-[8rem]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300/80">
                Ενοικιάσεις
              </span>
              <Link to="/rent" className="hover:text-white">
                Σελίδα Rent
              </Link>
              <Link to="/grafeia" className="hover:text-white">
                Συμβόλαια Rent
              </Link>
            </div>
            <div className="flex flex-col gap-2 min-w-[8rem]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                Πλατφόρμα
              </span>
              <a href="#pricing" className="hover:text-white">
                Τιμές
              </a>
              <Link to="/my-booking" className="hover:text-white">
                Ανάκτηση κράτησης
              </Link>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-white/30 mt-10">
          © {new Date().getFullYear()} {PLATFORM_NAME} — SaaS για ταξιδιωτικά γραφεία
        </p>
      </footer>
    </div>
  );
}
