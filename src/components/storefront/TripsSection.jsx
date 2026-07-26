import TripCard from './TripCard.jsx';
import { tripsGridClass, tripCardWrapperClass } from '../../lib/homepage/homepageTemplates.js';

export default function TripsSection({
  id,
  eyebrow,
  title,
  subtitle,
  trips,
  emptyMessage,
  siteAppearance,
  pricingSettings,
  hidden = false,
}) {
  if (hidden) return null;

  const layoutId = siteAppearance.trips_layout_template || 'grid_three';
  const cardId = siteAppearance.trip_card_template || 'premium';
  const tripCount = trips.length;
  const solo = tripCount === 1;
  const gridClass = tripsGridClass(layoutId, tripCount);
  const wrapClass = tripCardWrapperClass(layoutId, tripCount);

  return (
    <section
      id={id}
      className={`${solo ? 'py-10 md:py-12' : 'py-24'} px-margin-desktop max-w-container-max mx-auto bg-surface`}
    >
      <div className={`text-center ${solo ? 'mb-6' : 'mb-16'}`}>
        {eyebrow && (
          <span className="text-primary font-semibold tracking-wider uppercase text-sm mb-3 block">
            {eyebrow}
          </span>
        )}
        <h2
          className={`font-bold text-on-surface tracking-tight ${
            solo ? 'text-2xl md:text-3xl' : 'font-headline-lg text-4xl md:text-5xl'
          }`}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className={`text-on-surface-variant font-body-md mt-3 mx-auto ${
              solo ? 'max-w-md text-sm sm:text-base' : 'max-w-xl'
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>

      {trips.length === 0 ? (
        <p className="text-center text-on-surface-variant py-12 font-body-md">{emptyMessage}</p>
      ) : (
        <div className={gridClass}>
          {trips.map((trip, index) => (
            <div key={trip.id} className={wrapClass}>
              <TripCard
                trip={trip}
                pricingSettings={pricingSettings}
                templateId={cardId}
                layoutId={layoutId}
                index={index}
                solo={solo}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
