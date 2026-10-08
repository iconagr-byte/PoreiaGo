/**
 * Marketing homepage — buses session (hook + clear info + trip/fleet preview).
 */
import { useMemo } from 'react';
import {
  getPlatformDemoBuses,
  getPlatformDemoIntlTrips,
  getPlatformDemoTrips,
} from '../../lib/marketing/platformBusDemoShowcase.js';
import { BUSES_SESSION } from '../../lib/marketing/platformCopy.js';
import { DEFAULT_PLATFORM_SETTINGS } from '../../services/platformApi.js';
import { DEFAULT_SITE_APPEARANCE } from '../../services/siteAppearanceApi.js';
import TripsSection from '../storefront/TripsSection.jsx';
import FleetShowcaseSection from '../FleetShowcaseSection.jsx';
import '../../styles/marketing-apple.css';
import '../../styles/platform-service-sessions.css';

export default function PlatformBusesSession() {
  const domesticTrips = useMemo(() => getPlatformDemoTrips(3), []);
  const intlTrips = useMemo(() => getPlatformDemoIntlTrips(3), []);
  const buses = useMemo(() => getPlatformDemoBuses(3), []);

  return (
    <section
      id={BUSES_SESSION.id}
      className="pg-session pg-session--buses"
      aria-labelledby="buses-session-hook"
    >
      <div className="pg-session-intro">
        <p className="pg-session-kicker">
          <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16 }}>
            directions_bus
          </span>
          {BUSES_SESSION.kicker}
        </p>
        <h2 id="buses-session-hook" className="pg-session-hook">
          {BUSES_SESSION.hook}
        </h2>
        <p className="pg-session-support">{BUSES_SESSION.support}</p>
        <ul className="pg-session-points">
          {BUSES_SESSION.points.map((point) => (
            <li key={point.label}>
              <span className="material-symbols-outlined" aria-hidden>
                {point.icon}
              </span>
              {point.label}
            </li>
          ))}
        </ul>
        <a href={BUSES_SESSION.ctaHref} className="pg-session-cta pg-session-cta--buses">
          {BUSES_SESSION.ctaLabel}
          <span className="material-symbols-outlined" aria-hidden>
            arrow_downward
          </span>
        </a>
      </div>

      <div className="pg-session-preview pg-apple">
        <div className="pg-apple-cards-band">
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

          <TripsSection
            id="platform-abroad"
            compact
            eyebrow="Εξωτερικό"
            title="Εκδρομές εξωτερικού"
            subtitle="Παρίσι · Ρώμη · Πράγα & Βιέννη — ίδια κάρτα εμφάνισης με τις εγχώριες."
            trips={intlTrips}
            emptyMessage="Δεν υπάρχουν διεθνείς εκδρομές προς εμφάνιση."
            siteAppearance={{
              ...DEFAULT_SITE_APPEARANCE,
              trips_layout_template: 'grid_three',
              trip_card_template: 'premium',
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
    </section>
  );
}
