import { useEffect, useRef, useState } from 'react';
import TripCard from './TripCard.jsx';
import { tripsGridClass, tripCardWrapperClass } from '../../lib/homepage/homepageTemplates.js';
import { PreviewBuilderControl, usePreviewDesignMode } from './preview/PreviewDesignMode.jsx';

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
  sectionClassName = '',
  /** Tighter padding — for strips inserted between hero blocks (e.g. abroad before fleet). */
  compact = false,
  /** Use intl_* appearance keys when set (abroad strip). */
  international = false,
}) {
  const previewCtx = usePreviewDesignMode();
  // Live Page Studio draft wins over the last-fetched appearance so layout/card
  // clicks paint the preview in the same tick (no save / remount required).
  const live = previewCtx?.enabled && previewCtx.form ? previewCtx.form : null;
  const appearance = live || siteAppearance || {};

  const layoutId =
    (international
      ? appearance.intl_trips_layout_template || appearance.trips_layout_template
      : appearance.trips_layout_template) || 'grid_three';
  const cardId =
    (international
      ? appearance.intl_trip_card_template || appearance.trip_card_template
      : appearance.trip_card_template) || 'premium';

  const liveEyebrow = international
    ? live?.intl_section_eyebrow
    : live?.trips_section_eyebrow;
  const liveTitle = international
    ? live?.intl_section_title
    : live?.trips_section_title;
  const liveSubtitle = international
    ? live?.intl_section_subtitle
    : live?.trips_section_subtitle;

  const resolvedEyebrow = liveEyebrow != null ? liveEyebrow : eyebrow;
  const resolvedTitle = liveTitle != null ? liveTitle : title;
  const resolvedSubtitle = liveSubtitle != null ? liveSubtitle : subtitle;

  const [layoutFlash, setLayoutFlash] = useState(false);
  const prevLayoutRef = useRef(layoutId);

  useEffect(() => {
    if (prevLayoutRef.current === layoutId) return undefined;
    prevLayoutRef.current = layoutId;
    setLayoutFlash(true);
    const t = window.setTimeout(() => setLayoutFlash(false), 480);
    return () => window.clearTimeout(t);
  }, [layoutId]);

  if (hidden) return null;

  const tripCount = trips.length;
  const solo = tripCount === 1;
  const dense = compact || solo;
  const gridClass = tripsGridClass(layoutId, tripCount, cardId);
  const abroadStrip = cardId === 'abroad_horizontal';
  const sectionKey = id || 'trips';

  return (
    <section
      id={id}
      className={`sf-trips-section ${dense ? 'py-10 md:py-12' : 'py-16 md:py-24'} px-4 sm:px-margin-desktop max-w-container-max mx-auto bg-surface ${sectionClassName}`.trim()}
      data-trips-layout={layoutId}
      data-trip-card={cardId}
    >
      <div className={`text-center ${dense ? (abroadStrip ? 'mb-8' : 'mb-6') : 'mb-16'}`}>
        {resolvedEyebrow && (
          <span className="text-primary font-semibold tracking-wider uppercase text-sm mb-3 block">
            {resolvedEyebrow}
          </span>
        )}
        {/* One Builder for the whole card template (Καρτέλες) — not per trip card. */}
        <div className="sf-preview-trips-section-head">
          <h2
            className={`font-bold text-on-surface tracking-tight ${
              abroadStrip
                ? 'text-3xl md:text-4xl'
                : dense
                  ? 'text-2xl md:text-3xl'
                  : 'font-headline-lg text-4xl md:text-5xl'
            }`}
          >
            {resolvedTitle}
          </h2>
          <PreviewBuilderControl
            sectionId="trips"
            label="Καρτέλες"
            variant="inline"
            instanceId={`trips-title-${sectionKey}`}
            className="sf-preview-trips-section-head__builder"
          />
        </div>
        {resolvedSubtitle && (
          <p
            className={`text-on-surface-variant font-body-md mt-3 mx-auto ${
              abroadStrip
                ? 'max-w-2xl text-base sm:text-lg'
                : dense
                  ? 'max-w-md text-sm sm:text-base'
                  : 'max-w-xl'
            }`}
          >
            {resolvedSubtitle}
          </p>
        )}
      </div>

      {trips.length === 0 ? (
        <p className="text-center text-on-surface-variant py-12 font-body-md">{emptyMessage}</p>
      ) : (
        <div
          key={`${layoutId}:${cardId}`}
          className={`sf-trips-grid ${gridClass}${layoutFlash ? ' is-layout-flash' : ''}`}
        >
          {trips.map((trip, index) => (
            <div
              key={String(trip.id ?? index)}
              className={`sf-trips-card-wrap ${tripCardWrapperClass(layoutId, tripCount, index, cardId)}`}
            >
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
