import { useMemo, useState } from 'react';
import TemplatePreviewThumb from './TemplatePreviewThumb.jsx';

/** Always-visible chip order when space is limited (compact Builder). */
const COMPACT_PRIMARY = ['Premium', 'Minimal', 'Featured', 'Luxury'];
/** Full picker: slightly broader default row. */
const PRIMARY_CHIPS = ['Premium', 'Minimal', 'Featured', 'Luxury', 'Mobile', 'Editorial'];

/** Tags that count as «δημοφιλή» for the quick filter. */
const POPULAR_TAGS = new Set(['Δημοφιλές', 'Featured', 'Premium']);

function collectFilterChips(templates, compact) {
  const counts = new Map();
  for (const tpl of templates) {
    for (const tag of tpl.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  const preferred = compact ? COMPACT_PRIMARY : PRIMARY_CHIPS;
  const primary = preferred.filter((t) => counts.has(t));
  const rest = [...counts.keys()].filter((t) => !preferred.includes(t)).sort();
  return { primary: ['Όλα', ...primary], rest };
}

function isPopularTemplate(tpl) {
  return (tpl.tags || []).some((t) => POPULAR_TAGS.has(t));
}

export default function TemplatePicker({
  category,
  templates,
  value,
  onChange,
  columns = 3,
  accent = 'sky',
  /** Denser layout for preview-chrome Builder dropdown. */
  compact = false,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Όλα');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [popularOnly, setPopularOnly] = useState(false);

  const { primary, rest } = useMemo(
    () => collectFilterChips(templates, compact),
    [templates, compact],
  );
  /** Compact: only Όλα + first 2 style chips unless expanded. */
  const visiblePrimary = compact ? primary.slice(0, 3) : primary;
  const chips = showMoreFilters
    ? [...primary, ...rest]
    : visiblePrimary;
  const hiddenCount = showMoreFilters
    ? 0
    : Math.max(0, primary.length + rest.length - visiblePrimary.length);
  const hasMore = hiddenCount > 0 || rest.length > 0;

  const selected = useMemo(
    () => templates.find((t) => t.id === value) || templates[0],
    [templates, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((tpl) => {
      if (popularOnly && !isPopularTemplate(tpl)) return false;
      if (filter !== 'Όλα' && !(tpl.tags || []).includes(filter)) return false;
      if (!q) return true;
      const hay = `${tpl.label} ${tpl.description} ${(tpl.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [templates, filter, query, popularOnly]);

  const colClass = compact
    ? 'grid-cols-2'
    : columns === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : columns === 4
        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2';

  const accentTone = accent === 'teal' ? 'teal' : 'sky';

  const clearFilters = () => {
    setQuery('');
    setFilter('Όλα');
    setPopularOnly(false);
  };

  const hasActiveFilters = query || filter !== 'Όλα' || popularOnly;

  return (
    <div className={`pdw-picker${compact ? ' is-compact' : ''}`}>
      {selected ? (
        <div
          className={`pdw-picker__selected${compact ? ' is-compact' : ''}`}
          data-accent={accentTone}
        >
          <div className="pdw-picker__selected-main">
            <span className="pdw-picker__selected-icon" aria-hidden>
              <span className="material-symbols-outlined">{selected.icon}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="pdw-picker__selected-kicker">Επιλεγμένο</p>
              <p className="pdw-picker__selected-label">{selected.label}</p>
            </div>
          </div>
          <span className="pdw-picker__selected-count" title="Εμφανίζονται / σύνολο">
            {filtered.length}/{templates.length}
          </span>
        </div>
      ) : null}

      <div className={`pdw-picker__toolbar${compact ? ' is-compact' : ''}`}>
        <label className="pdw-picker__search">
          <span className="material-symbols-outlined pdw-picker__search-icon" aria-hidden>
            search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση προτύπου…"
            className="pdw-picker__search-input"
          />
          {query ? (
            <button
              type="button"
              className="pdw-picker__search-clear"
              onClick={() => setQuery('')}
              aria-label="Καθαρισμός αναζήτησης"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          ) : null}
        </label>
        {hasActiveFilters ? (
          <button type="button" onClick={clearFilters} className="pdw-picker__clear">
            Καθαρισμός
          </button>
        ) : null}
      </div>

      <div className={`pdw-picker__filters${compact ? ' is-compact' : ''}`}>
        {compact ? (
          <button
            type="button"
            className={`pdw-picker__popular${popularOnly ? ' is-active' : ''}`}
            aria-pressed={popularOnly}
            onClick={() => setPopularOnly((v) => !v)}
            title="Πρότυπα με Premium / Featured"
          >
            <span className="material-symbols-outlined" aria-hidden>
              star
            </span>
            Δημοφιλή
          </button>
        ) : null}
        <div className="pdw-picker__chips" role="group" aria-label="Φίλτρα προτύπων">
          {chips.map((chip) => {
            const active = filter === chip;
            return (
              <button
                key={chip}
                type="button"
                onClick={() => setFilter(chip)}
                className={`pdw-picker__chip${active ? ' is-active' : ''}`}
                data-accent={accentTone}
              >
                {chip}
              </button>
            );
          })}
          {hasMore ? (
            <button
              type="button"
              onClick={() => setShowMoreFilters((v) => !v)}
              className={`pdw-picker__chip is-more${showMoreFilters ? ' is-open' : ''}`}
            >
              {showMoreFilters
                ? 'Λιγότερα'
                : compact
                  ? `+${hiddenCount || rest.length}`
                  : `+${rest.length} ακόμα`}
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="pdw-picker__empty">
          Δεν βρέθηκαν πρότυπα —{' '}
          <button type="button" className="pdw-picker__empty-link" onClick={clearFilters}>
            καθάρισε τα φίλτρα
          </button>
          .
        </p>
      ) : (
        <div className={`pdw-picker__grid ${colClass}${compact ? ' is-compact' : ''}`}>
          {filtered.map((tpl) => {
            const isSelected = value === tpl.id;
            const isPremium = (tpl.tags || []).includes('Premium');
            const visibleTags = (tpl.tags || []).filter((t) => t !== 'Premium').slice(0, 2);
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onChange(tpl.id)}
                aria-pressed={isSelected}
                className={`pdw-picker__card${compact ? ' is-compact' : ''}${
                  isSelected ? ' is-selected' : ''
                }`}
                data-accent={accentTone}
              >
                <div className="pdw-picker__card-thumb">
                  <TemplatePreviewThumb category={category} templateId={tpl.id} />
                  {isSelected ? (
                    <span className="pdw-picker__card-check" aria-hidden>
                      <span className="material-symbols-outlined">check</span>
                    </span>
                  ) : null}
                  {!compact && isPremium ? (
                    <span className="pdw-picker__card-badge">Premium</span>
                  ) : null}
                  {compact && isPremium ? (
                    <span className="pdw-picker__card-dot" title="Premium" aria-hidden />
                  ) : null}
                </div>
                <div className="pdw-picker__card-meta">
                  <p className="pdw-picker__card-title">
                    <span className="material-symbols-outlined" aria-hidden>
                      {tpl.icon}
                    </span>
                    <span className="truncate">{tpl.label}</span>
                  </p>
                  {!compact || !isSelected ? (
                    <p className="pdw-picker__card-desc">{tpl.description}</p>
                  ) : (
                    <p className="pdw-picker__card-desc is-active">Ενεργό πρότυπο</p>
                  )}
                </div>
                {!compact && visibleTags.length > 0 ? (
                  <div className="pdw-picker__card-tags">
                    {visibleTags.map((tag) => (
                      <span key={tag} className="pdw-picker__card-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
