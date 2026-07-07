import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PlatformBrand from '../components/marketing/PlatformBrand.jsx';
import {
  FeaturesSection,
  FinalCtaSection,
  HeroSection,
  HowItWorksSection,
  PainPointsSection,
  PricingTeaserSection,
} from '../components/marketing/PlatformLandingSections.jsx';
import { PLATFORM_NAME } from '../lib/marketing/platformCopy.js';

export default function FrontPage() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    const refresh = () => setRole(localStorage.getItem('userRole'));
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="fixed top-0 w-full z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-[72px] flex items-center justify-between gap-4">
          <PlatformBrand variant="dark" />

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-white/75">
            <a href="#features" className="hover:text-white transition-colors">
              Λειτουργίες
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Τιμές
            </a>
            {role === 'admin' && (
              <Link to="/admin" className="hover:text-white transition-colors">
                Panel
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/admin/login"
              className="hidden sm:inline-flex px-4 py-2 text-sm font-bold text-white/80 hover:text-white"
            >
              Σύνδεση
            </Link>
            <Link
              to="/grafeia"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold rounded-full shadow-lg shadow-sky-500/25 transition-colors"
            >
              Δωρεάν δοκιμή
              <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <HeroSection />
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
              Cloud πλατφόρμα για ταξιδιωτικά γραφεία — κρατήσεις, στόλος, GPS, billing.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/55">
            <Link to="/grafeia" className="hover:text-white">
              Συμβόλαια
            </Link>
            <Link to="/my-booking" className="hover:text-white">
              Ανάκτηση κράτησης
            </Link>
            <Link to="/admin/login" className="hover:text-white">
              Σύνδεση γραφείου
            </Link>
          </div>
        </div>
        <p className="text-center text-xs text-white/30 mt-10">
          © {new Date().getFullYear()} {PLATFORM_NAME} — Travel Agency SaaS
        </p>
      </footer>
    </div>
  );
}
