/**
 * Marketing host only: Greece trip cards + 3 abroad horizontal cards + bus fleet.
 * Abroad strip sits in the gap between εκδρομές and «Ο ΣΤΟΛΟΣ ΜΑΣ».
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getPlatformDemoBuses,
  getPlatformDemoIntlTrips,
  getPlatformDemoTrips,
  PLATFORM_OPS_COPY,
} from '../../lib/marketing/platformBusDemoShowcase.js';
import { DEFAULT_PLATFORM_SETTINGS } from '../../services/platformApi.js';
import { DEFAULT_SITE_APPEARANCE } from '../../services/siteAppearanceApi.js';
import TripsSection from '../storefront/TripsSection.jsx';
import FleetShowcaseSection from '../FleetShowcaseSection.jsx';
import '../../styles/marketing-apple.css';

export default function PlatformOpsShowcase() {
  // Greece grid (existing) + exactly 3 abroad horizontal cards + fleet buses.
  const domesticTrips = useMemo(() => getPlatformDemoTrips(3), []);
  const intlTrips = useMemo(() => getPlatformDemoIntlTrips(3), []);
  const buses = useMemo(() => getPlatformDemoBuses(3), []);

  return (
    <div id="platform-ops" className="pg-apple scroll-mt-24">
      <div className="max-w-[980px] mx-auto px-5 md:px-8 pt-20 md:pt-28 pb-6 text-center">
        <p className="pg-apple-kicker mb-3">{PLATFORM_OPS_COPY.kicker}</p>
        <h2 className="pg-apple-title">{PLATFORM_OPS_COPY.title}</h2>
        <p className="pg-apple-subtitle mt-5 max-w-[640px] mx-auto">{PLATFORM_OPS_COPY.subtitle}</p>

        <nav
          className="mt-8 flex flex-col items-center gap-3"
          aria-label="Προεπισκόπηση ενοτήτων"
        >
          <div className="flex flex-wrap justify-center gap-2.5" role="group" aria-label="Λεωφορεία">
            <span className="pg-apple-chip-label">Λεωφορεία</span>
            <a href="#platform-trips" className="pg-apple-chip">
              <span className="material-symbols-outlined" aria-hidden>
                map
              </span>
              Εκδρομές
            </a>
            <a href="#platform-abroad" className="pg-apple-chip">
              <span className="material-symbols-outlined" aria-hidden>
                public
              </span>
              Εξωτερικό
            </a>
            <a href="#our-fleet" className="pg-apple-chip">
              <span className="material-symbols-outlined" aria-hidden>
                directions_bus
              </span>
              Στόλος
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5" role="group" aria-label="Ενοικιάσεις">
            <span className="pg-apple-chip-label pg-apple-chip-label--rent">Ενοικιάσεις</span>
            <Link to="/rent" className="pg-apple-chip pg-apple-chip--rent">
              <span className="material-symbols-outlined" aria-hidden>
                car_rental
              </span>
              Σελίδα ενοικιάσεων
            </Link>
          </div>
        </nav>
      </div>

      {/* One continuous band: Greece → 3 abroad horizontals → fleet (no empty gap). */}
      <div className="pg-apple-cards-band border-t border-black/[0.06]">
        <TripsSection
          id="platform-trips"
          eyebrow="Εκδρομές"
          title="Κάρτες ταξιδιών"
          subtitle="Online κράτηση με τιμές, θέσεις και ημερομηνία — όπως στο site του γραφείου."
          trips={domesticTrips}
          emptyMessage="Δεν υπάρχουν εκδρομές προς εμφάνιση."
          siteAppearance={{
            ...DEFAULT_SITE_APPEARANCE,
            trips_layout_template: 'grid_three',
            trip_card_template: 'premium',
          }}
          pricingSettings={DEFAULT_PLATFORM_SETTINGS}
          sectionClassName="!bg-transparent !pb-8 md:!pb-10"
        />

        {/* Inserted between Greece cards and «Ο ΣΤΟΛΟΣ ΜΑΣ» — 3 abroad trip cards. */}
        <TripsSection
          id="platform-abroad"
          compact
          eyebrow="Εξωτερικό"
          title="Εκδρομές εξωτερικού"
          subtitle="Παρίσι · Ρώμη · Πράγα & Βιέννη — οριζόντια κάρτα λεωφορείου."
          trips={intlTrips}
          emptyMessage="Δεν υπάρχουν διεθνείς εκδρομές προς εμφάνιση."
          siteAppearance={{
            ...DEFAULT_SITE_APPEARANCE,
            // Stack of 3 wide horizontal cards (not a thin carousel strip).
            trips_layout_template: 'editorial_stack',
            trip_card_template: 'abroad_horizontal',
          }}
          pricingSettings={DEFAULT_PLATFORM_SETTINGS}
          sectionClassName="!bg-transparent !pt-2 !pb-10 md:!pb-12 pg-apple-abroad-strip"
        />

        <FleetShowcaseSection
          vehicles={buses}
          loading={false}
          sectionClassName="!bg-transparent !border-transparent !pt-8 md:!pt-10"
        />
      </div>
    </div>
  );
}
