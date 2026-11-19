import { amenityIcon } from '../services/fleetPublicApi.js';
import { fleetCategoryLabel, fleetCategoryMeta } from '../lib/fleet/fleetVehicleCategories.js';
import { PreviewBuilderControl } from './storefront/preview/PreviewDesignMode.jsx';
import '../styles/storefront-sections.css';

/** Cap amenity chips so every card stays the same visual density. */
const MAX_AMENITIES = 6;

function statusTone(label) {
  const s = String(label || '').toLowerCase();
  if (/περιορισ|limited|low/.test(s)) return 'is-warn';
  if (/διαθέσ|available|ready/.test(s)) return 'is-ok';
  if (/συντήρ|maintenance|εκτός|unavailable/.test(s)) return 'is-muted';
  return 'is-ok';
}

function shortStatus(label) {
  const raw = String(label || '').trim();
  if (!raw) return 'Διαθέσιμο';
  if (/περιορισ/i.test(raw)) return 'Περιορισμένο';
  return raw.length > 18 ? `${raw.slice(0, 16)}…` : raw;
}

function FleetVehicleCard({ bus }) {
  const categoryLabel = bus.category_label || fleetCategoryLabel(bus.category);
  const categoryIcon = fleetCategoryMeta(bus.category)?.icon || 'directions_bus';
  const amenities = Array.isArray(bus.amenities) ? bus.amenities.filter(Boolean) : [];
  const shown = amenities.slice(0, MAX_AMENITIES);
  const extra = Math.max(0, amenities.length - shown.length);
  const tone = statusTone(bus.status_label);
  const meta = [bus.year, bus.seat_count ? `${bus.seat_count} θέσεις` : null, bus.color]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="sf-fleet-card">
      <div className="sf-fleet-card__media">
        <img
          src={bus.image_url || '/images/fleet-bus-white-tourismo.png'}
          alt={bus.name || categoryLabel}
          loading="lazy"
        />
        <span className="sf-fleet-card__cat">
          <span className="material-symbols-outlined" aria-hidden>
            {categoryIcon}
          </span>
          <span className="sf-fleet-card__cat-label">{categoryLabel}</span>
        </span>
        <span className={`sf-fleet-card__status ${tone}`}>{shortStatus(bus.status_label)}</span>
      </div>

      <div className="sf-fleet-card__body">
        <div className="sf-fleet-card__head">
          <h3 className="sf-fleet-card__title">{bus.name || 'Όχημα'}</h3>
          {meta ? <p className="sf-fleet-card__meta">{meta}</p> : null}
          {bus.summary ? <p className="sf-fleet-card__summary">{bus.summary}</p> : null}
        </div>

        <div className="sf-fleet-card__amenities">
          <p className="sf-fleet-card__amenities-label">Παροχές</p>
          {shown.length ? (
            <ul className="sf-fleet-card__amenity-grid">
              {shown.map((item) => (
                <li key={item} className="sf-fleet-card__amenity">
                  <span className="material-symbols-outlined" aria-hidden>
                    {amenityIcon(item)}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
              {extra > 0 ? (
                <li className="sf-fleet-card__amenity is-more">+{extra} ακόμη</li>
              ) : null}
            </ul>
          ) : (
            <p className="sf-fleet-card__amenities-empty">—</p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function FleetShowcaseSection({
  vehicles,
  loading,
  hidden = false,
  sectionClassName = '',
}) {
  if (hidden) return null;

  return (
    <section
      id="our-fleet"
      className={`sf-fleet-section py-24 px-margin-desktop max-w-container-max mx-auto border-y border-white/60 ${sectionClassName}`.trim()}
    >
      <div className="sf-fleet-section__intro text-center mb-14 max-w-2xl mx-auto">
        <div className="sf-preview-trips-section-head mb-3">
          <span className="text-primary font-semibold tracking-wider uppercase text-sm">
            Ο Στόλος Μας
          </span>
          <PreviewBuilderControl
            sectionId="general"
            label="Στόλος"
            variant="inline"
            instanceId="fleet-section-title"
            className="sf-preview-trips-section-head__builder"
          />
        </div>
        <h2 className="font-headline-lg text-4xl md:text-5xl font-bold text-on-surface tracking-tight mb-4">
          Premium λεωφορεία & παροχές
        </h2>
        <p className="text-on-surface-variant font-body-md">
          Τα οχήματά μας συγχρονίζονται από τον πίνακα ελέγχου — άνεση, ασφάλεια και σύγχρονες
          παροχές σε κάθε διαδρομή.
        </p>
      </div>

      {loading ? (
        <p className="text-center text-on-surface-variant py-12">Φόρτωση στόλου…</p>
      ) : vehicles.length === 0 ? (
        <p className="text-center text-on-surface-variant py-12">
          Δεν υπάρχουν διαθέσιμα οχήματα προς εμφάνιση.
        </p>
      ) : (
        <div className="sf-fleet-grid">
          {vehicles.map((bus, index) => {
            const cardKey = String(bus.id ?? `${bus.name || 'bus'}-${index}`);
            return (
              <div key={cardKey} className="sf-fleet-grid__cell">
                <FleetVehicleCard bus={bus} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
