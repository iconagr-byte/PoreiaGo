/**
 * Marketing host only: trip cards + bus fleet showcase under the hero.
 */
import { Link } from 'react-router-dom';
import {
  getPlatformDemoBuses,
  getPlatformDemoTrips,
  PLATFORM_OPS_COPY,
} from '../../lib/marketing/platformBusDemoShowcase.js';
import { DEFAULT_PLATFORM_SETTINGS } from '../../services/platformApi.js';
import { DEFAULT_SITE_APPEARANCE } from '../../services/siteAppearanceApi.js';
import TripsSection from '../storefront/TripsSection.jsx';
import FleetShowcaseSection from '../FleetShowcaseSection.jsx';

export default function PlatformOpsShowcase() {
  const trips = getPlatformDemoTrips(3);
  const buses = getPlatformDemoBuses(3);

  return (
    <div id="platform-ops" className="bg-[#f5f7fb] text-slate-900 scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-16 md:pt-20 pb-4 text-center">
        <p className="text-sm font-semibold tracking-wide text-sky-700 mb-3">
          {PLATFORM_OPS_COPY.kicker}
        </p>
        <h2
          className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900"
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
        >
          {PLATFORM_OPS_COPY.title}
        </h2>
        <p className="mt-4 text-base md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          {PLATFORM_OPS_COPY.subtitle}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="#platform-trips"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-700 hover:text-sky-900"
          >
            <span className="material-symbols-outlined text-[18px]">map</span>
            Εκδρομές
          </a>
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <a
            href="#our-fleet"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 hover:text-teal-900"
          >
            <span className="material-symbols-outlined text-[18px]">directions_bus</span>
            Στόλος λεωφορείων
          </a>
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <Link
            to="/rent"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-slate-900"
          >
            <span className="material-symbols-outlined text-[18px]">car_rental</span>
            Ενοικιάσεις οχημάτων
          </Link>
        </div>
      </div>

      <TripsSection
        id="platform-trips"
        eyebrow="Εκδρομές"
        title="Κάρτες ταξιδιών"
        subtitle="Online κράτηση με τιμές, θέσεις και ημερομηνία — όπως στο site του γραφείου."
        trips={trips}
        emptyMessage="Δεν υπάρχουν εκδρομές προς εμφάνιση."
        siteAppearance={{
          ...DEFAULT_SITE_APPEARANCE,
          trips_layout_template: 'grid_three',
          trip_card_template: 'premium',
        }}
        pricingSettings={DEFAULT_PLATFORM_SETTINGS}
      />

      <FleetShowcaseSection vehicles={buses} loading={false} />
    </div>
  );
}
