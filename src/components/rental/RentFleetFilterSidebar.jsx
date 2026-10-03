import { useMemo, useState } from 'react';
import {
  EMPTY_RENT_FLEET_FILTERS,
  RENT_FILTER_EXTRAS,
  RENT_FILTER_EXTRAS_VISIBLE,
  RENT_FILTER_LOCATIONS,
  RENT_FILTER_LUGGAGE,
  RENT_FILTER_TRANSMISSIONS,
  countRentFleetFilterFacets,
  rentFleetFiltersActive,
  toggleRentFilterValue,
} from '../../lib/rental/rentFleetFilters.js';

function FilterCheck({ id, label, count, checked, onChange }) {
  return (
    <label className="rent-side-filter-opt" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
      />
      <span className="rent-side-filter-opt-label">{label}</span>
      {count != null ? <span className="rent-side-filter-opt-count">{count}</span> : null}
    </label>
  );
}

/**
 * Left sidebar filters for guest /rent fleet pick (desktop + collapsible mobile).
 */
export default function RentFleetFilterSidebar({
  vehicles = [],
  filters = EMPTY_RENT_FLEET_FILTERS,
  onChange,
} = {}) {
  const [extrasOpen, setExtrasOpen] = useState(false);
  const facets = useMemo(
    () => countRentFleetFilterFacets(vehicles, filters),
    [vehicles, filters],
  );
  const active = rentFleetFiltersActive(filters);

  const patch = (key, nextList) => {
    if (typeof onChange !== 'function') return;
    onChange({ ...filters, [key]: nextList });
  };

  const extras = extrasOpen
    ? RENT_FILTER_EXTRAS
    : RENT_FILTER_EXTRAS.slice(0, RENT_FILTER_EXTRAS_VISIBLE);
  const hiddenExtras = Math.max(0, RENT_FILTER_EXTRAS.length - RENT_FILTER_EXTRAS_VISIBLE);

  return (
    <aside className="rent-side-filters" aria-label="Φίλτρα στόλου">
      <div className="rent-side-filters-card">
        <header className="rent-side-filters-head">
          <h3>Φίλτρα</h3>
          {active ? (
            <button
              type="button"
              className="rent-side-filters-clear"
              onClick={() => onChange?.({ ...EMPTY_RENT_FLEET_FILTERS })}
            >
              Καθαρισμός
            </button>
          ) : null}
        </header>

        <section className="rent-side-filters-section">
          <h4>Τοποθεσία</h4>
          <div className="rent-side-filters-list">
            {RENT_FILTER_LOCATIONS.map((opt) => (
              <FilterCheck
                key={opt.id}
                id={`rent-loc-${opt.id}`}
                label={opt.label}
                count={facets.locations[opt.id]}
                checked={(filters.locations || []).includes(opt.id)}
                onChange={() =>
                  patch('locations', toggleRentFilterValue(filters.locations, opt.id))
                }
              />
            ))}
          </div>
        </section>

        <section className="rent-side-filters-section">
          <h4>Κιβώτιο</h4>
          <div className="rent-side-filters-list">
            {RENT_FILTER_TRANSMISSIONS.map((opt) => (
              <FilterCheck
                key={opt.id}
                id={`rent-tr-${opt.id}`}
                label={opt.label}
                count={facets.transmissions[opt.id]}
                checked={(filters.transmissions || []).includes(opt.id)}
                onChange={() =>
                  patch(
                    'transmissions',
                    toggleRentFilterValue(filters.transmissions, opt.id),
                  )
                }
              />
            ))}
          </div>
        </section>

        <section className="rent-side-filters-section">
          <h4>Extras</h4>
          <p className="rent-side-filters-hint">
            Εμφάνιση οχημάτων με αυτά τα extras διαθέσιμα
          </p>
          <div className="rent-side-filters-list">
            {extras.map((opt) => (
              <FilterCheck
                key={opt.id}
                id={`rent-ex-${opt.id}`}
                label={opt.label}
                count={facets.extras[opt.id]}
                checked={(filters.extras || []).includes(opt.id)}
                onChange={() =>
                  patch('extras', toggleRentFilterValue(filters.extras, opt.id))
                }
              />
            ))}
          </div>
          {hiddenExtras > 0 ? (
            <button
              type="button"
              className="rent-side-filters-more"
              onClick={() => setExtrasOpen((v) => !v)}
              aria-expanded={extrasOpen}
            >
              {extrasOpen ? 'Λιγότερα' : `Εμφάνιση όλων (${RENT_FILTER_EXTRAS.length})`}
              <span className="material-symbols-outlined" aria-hidden>
                {extrasOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          ) : null}
        </section>

        <section className="rent-side-filters-section">
          <h4>Χωρητικότητα αποσκευών</h4>
          <p className="rent-side-filters-hint">
            Βάσει βαλίτσας ≈ 62 × 42 × 25 cm
          </p>
          <div className="rent-side-filters-list">
            {RENT_FILTER_LUGGAGE.map((opt) => (
              <FilterCheck
                key={opt.id}
                id={`rent-bag-${opt.id}`}
                label={opt.label}
                count={facets.luggage[opt.id]}
                checked={(filters.luggage || []).includes(opt.id)}
                onChange={() =>
                  patch('luggage', toggleRentFilterValue(filters.luggage, opt.id))
                }
              />
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
