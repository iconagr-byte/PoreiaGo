/**
 * Marketing host only: trip cards + bus fleet showcase under the hero.
 * Apple aesthetic — SF Pro stack, soft gray, quiet chips.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getPlatformDemoBuses,
  getPlatformDemoDomesticTrips,
  getPlatformDemoInternationalTrips,
  PLATFORM_OPS_COPY,
} from '../../lib/marketing/platformBusDemoShowcase.js';
import { DEFAULT_PLATFORM_SETTINGS } from '../../services/platformApi.js';
import { DEFAULT_SITE_APPEARANCE } from '../../services/siteAppearanceApi.js';
import TripsSection from '../storefront/TripsSection.jsx';
import FleetShowcaseSection from '../FleetShowcaseSection.jsx';
import '../../styles/marketing-apple.css';

const TRIP_TABS = [
  { id: 'greece', label: 'Ελλάδα', icon: 'map', href: '#platform-trips' },
  { id: 'abroad', label: 'Εξωτερικό', icon: 'public', href: '#platform-trips-abroad' },
];

export default function PlatformOpsShowcase() {
  const [tripTab, setTripTab] = useState('greece');
  const domesticTrips = useMemo(() => getPlatformDemoDomesticTrips(3), []);
  const internationalTrips = useMemo(() => getPlatformDemoInternationalTrips(3), []);
  const buses = useMemo(() => getPlatformDemoBuses(3), []);

  return (
    <div id="platform-ops" className="pg-apple scroll-mt-24">
      <div className="max-w-[980px] mx-auto px-5 md:px-8 pt-20 md:pt-28 pb-6 text-center">
        <p className="pg-apple-kicker mb-3">{PLATFORM_OPS_COPY.kicker}</p>
        <h2 className="pg-apple-title">{PLATFORM_OPS_COPY.title}</h2>
        <p className="pg-apple-subtitle mt-5 max-w-[640px] mx-auto">{PLATFORM_OPS_COPY.subtitle}</p>

        <nav
          className="mt-8 flex flex-wrap justify-center gap-2.5"
          aria-label="Προεπισκόπηση ενοτήτων"
        >
          {TRIP_TABS.map((tab) => {
            const active = tripTab === tab.id;
            return (
              <a
                key={tab.id}
                href={tab.href}
                className={`pg-apple-chip${active ? ' is-active' : ''}`}
                aria-current={active ? 'true' : undefined}
                onClick={() => setTripTab(tab.id)}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  {tab.icon}
                </span>
                {tab.label}
              </a>
            );
          })}
          <a href="#our-fleet" className="pg-apple-chip">
            <span className="material-symbols-outlined" aria-hidden>
              directions_bus
            </span>
            Στόλος λεωφορείων
          </a>
          <Link to="/rent" className="pg-apple-chip">
            <span className="material-symbols-outlined" aria-hidden>
              car_rental
            </span>
            Ενοικιάσεις οχημάτων
          </Link>
        </nav>
      </div>

      {tripTab === 'greece' ? (
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
            sectionClassName="!bg-transparent"
          />
        </div>
      ) : (
        <div className="pg-apple-cards-band border-t border-black/[0.06]">
          <TripsSection
            id="platform-trips-abroad"
            eyebrow="Εξωτερικό"
            title="Εκδρομές εξωτερικού"
            subtitle="Οριζόντια προβολή — σύρετε για Παρίσι, Ρώμη και Πράγα & Βιέννη."
            trips={internationalTrips}
            emptyMessage="Δεν υπάρχουν εκδρομές εξωτερικού."
            siteAppearance={{
              ...DEFAULT_SITE_APPEARANCE,
              trips_layout_template: 'horizontal_scroll',
              trip_card_template: 'premium',
            }}
            pricingSettings={DEFAULT_PLATFORM_SETTINGS}
            sectionClassName="!bg-transparent"
          />
        </div>
      )}

      <div className="pg-apple-cards-band border-t border-black/[0.06]">
        <FleetShowcaseSection
          vehicles={buses}
          loading={false}
          sectionClassName="!bg-transparent !border-transparent"
        />
      </div>
    </div>
  );
}
