import { useEffect, useId, useMemo, useRef, useState } from 'react';

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function optionMeta(loc) {
  if (!loc) return '';
  const hint = String(loc.hint || '').trim();
  if (hint) return hint;
  if (loc.kind === 'office') return 'Κύριο σημείο γραφείου';
  return 'Σημείο παραλαβής / παράδοσης';
}

/**
 * Custom pickup/dropoff location picker — searchable list, keyboard, office vs network.
 */
export default function RentLocationPicker({
  id,
  label = 'Σημείο',
  value,
  locations = [],
  onChange,
  placeholder = 'Αναζήτηση τόπου…',
  emptyLabel = 'Κανένα σημείο',
} = {}) {
  const listId = useId();
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = useMemo(
    () => locations.find((l) => l.value === value) || locations[0] || null,
    [locations, value],
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return locations;
    return locations.filter((loc) => {
      const hay = normalize(`${loc.label} ${loc.value} ${optionMeta(loc)}`);
      return hay.includes(q);
    });
  }, [locations, query]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    const idx = Math.max(
      0,
      filtered.findIndex((l) => l.value === (selected?.value || value)),
    );
    setActiveIndex(idx < 0 ? 0 : idx);
    const t = window.setTimeout(() => searchRef.current?.focus?.(), 30);
    return () => window.clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only on open

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex((i) => {
      if (!filtered.length) return 0;
      return Math.min(i, filtered.length - 1);
    });
  }, [filtered, open]);

  useEffect(() => {
    if (!open) return;
    const el = rootRef.current?.querySelector('.rent-loc-picker-option.is-active');
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, open, filtered]);

  const pick = (loc) => {
    if (!loc) return;
    onChange?.(loc.value, loc);
    setOpen(false);
  };

  const onTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e) => {
    if (!filtered.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(filtered[activeIndex]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(filtered.length - 1);
    }
  };

  const showSearch = locations.length > 3;

  return (
    <div
      className={`rent-loc-picker${open ? ' is-open' : ''}`}
      ref={rootRef}
      data-kind={selected?.kind || 'extra'}
    >
      <button
        type="button"
        id={id}
        className="rent-loc-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="rent-loc-picker-trigger-text">
          <span className="rent-loc-picker-value">
            {selected?.label || emptyLabel}
          </span>
          {selected ? (
            <span className="rent-loc-picker-meta">{optionMeta(selected)}</span>
          ) : null}
        </span>
        <span className="rent-loc-picker-chevron material-symbols-outlined" aria-hidden>
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open ? (
        <div className="rent-loc-picker-panel" role="presentation" onKeyDown={onListKeyDown}>
          {showSearch ? (
            <label className="rent-loc-picker-search">
              <span className="material-symbols-outlined" aria-hidden>
                search
              </span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                autoComplete="off"
              />
            </label>
          ) : null}

          <ul
            id={listId}
            className="rent-loc-picker-list"
            role="listbox"
            aria-label={label}
            tabIndex={-1}
          >
            {filtered.length === 0 ? (
              <li className="rent-loc-picker-empty" role="presentation">
                Δεν βρέθηκε σημείο
              </li>
            ) : (
              filtered.map((loc, idx) => {
                const isActive = idx === activeIndex;
                const isSelected = loc.value === (selected?.value || value);
                const icon = loc.kind === 'office' ? 'storefront' : 'location_on';
                return (
                  <li key={loc.id || loc.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`rent-loc-picker-option${isActive ? ' is-active' : ''}${
                        isSelected ? ' is-selected' : ''
                      }`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => pick(loc)}
                    >
                      <span
                        className={`rent-loc-picker-option-icon material-symbols-outlined${
                          loc.kind === 'office' ? ' is-office' : ''
                        }`}
                        aria-hidden
                      >
                        {icon}
                      </span>
                      <span className="rent-loc-picker-option-copy">
                        <span className="rent-loc-picker-option-label">{loc.label}</span>
                        <span className="rent-loc-picker-option-meta">{optionMeta(loc)}</span>
                      </span>
                      {isSelected ? (
                        <span className="material-symbols-outlined rent-loc-picker-check" aria-hidden>
                          check
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <p className="rent-loc-picker-foot">
            {filtered.length} από {locations.length} σημεία
          </p>
        </div>
      ) : null}
    </div>
  );
}
