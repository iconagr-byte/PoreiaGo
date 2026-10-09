/**
 * Marketing homepage — buses session (hook + journey capabilities + trip/fleet preview).
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

function renderHook(hook, accent) {
  if (!accent || !hook.includes(accent)) return hook;
  const [before, after] = hook.split(accent);
  return (
    <>
      {before}
      <em className="pg-buses-hook-accent">{accent}</em>
      {after}
    </>
  );
}

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
      <div className="pg-buses-atmosphere" aria-hidden>
        <div className="pg-buses-atmosphere-glow" />
        <div className="pg-buses-atmosphere-grid" />
      </div>

      <div className="pg-session-intro pg-session-intro--buses">
        <p className="pg-session-kicker pg-buses-rise" style={{ '--pg-rise-delay': '0ms' }}>
          <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16 }}>
            directions_bus
          </span>
          {BUSES_SESSION.kicker}
        </p>
        <h2
          id="buses-session-hook"
          className="pg-session-hook pg-buses-rise"
          style={{ '--pg-rise-delay': '60ms' }}
        >
          {renderHook(BUSES_SESSION.hook, BUSES_SESSION.hookAccent)}
        </h2>
        <p className="pg-session-support pg-buses-rise" style={{ '--pg-rise-delay': '120ms' }}>
          {BUSES_SESSION.support}
        </p>

        <div
          className="pg-buses-journey pg-buses-rise"
          style={{ '--pg-rise-delay': '180ms' }}
          aria-label="Λειτουργίες και παροχές λεωφορείων"
        >
          {BUSES_SESSION.groups.map((group, groupIndex) => (
            <div
              key={group.id}
              className="pg-buses-journey-col"
              style={{ '--pg-col-delay': `${220 + groupIndex * 70}ms` }}
            >
              <p className="pg-buses-journey-label">
                <span aria-hidden>{String(groupIndex + 1).padStart(2, '0')}</span>
                {group.label}
              </p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.label}>
                    <span className="pg-buses-icon material-symbols-outlined" aria-hidden>
                      {item.icon}
                    </span>
                    <div>
                      <strong>{item.label}</strong>
                      {item.detail ? <span>{item.detail}</span> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <a
          href={BUSES_SESSION.ctaHref}
          className="pg-session-cta pg-session-cta--buses pg-buses-rise"
          style={{ '--pg-rise-delay': '360ms' }}
        >
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
