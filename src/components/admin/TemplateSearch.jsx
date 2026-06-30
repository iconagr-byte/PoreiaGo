import { useEffect, useMemo, useRef, useState } from 'react';
import { buildTemplateSearchIndex, filterTemplateSearch } from '../../lib/admin/templateSearch.js';

export default function TemplateSearch({ onUseTemplate }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const index = useMemo(() => buildTemplateSearchIndex(), []);
  const results = useMemo(() => filterTemplateSearch(index, query), [index, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (item) => {
    if (!item?.payload) return;
    onUseTemplate?.(item.payload);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter') && query.trim()) {
      setOpen(true);
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[activeIdx]);
    }
  };

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={rootRef} className="relative w-full">
      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
        dashboard_customize
      </span>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (query.trim()) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="w-full pl-10 pr-10 py-2 bg-surface-container-low border-0 rounded-full focus:ring-2 focus:ring-primary-container text-body-md font-body-md transition-shadow"
        placeholder="Αναζήτηση προτύπων…"
        aria-label="Αναζήτηση προτύπων"
        aria-expanded={showDropdown}
        aria-controls="template-search-results"
        autoComplete="off"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setOpen(false);
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-0.5"
          aria-label="Καθαρισμός"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      )}

      {showDropdown && (
        <div
          id="template-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[min(70vh,420px)] overflow-y-auto rounded-2xl border border-black/[0.08] bg-white shadow-xl"
        >
          {results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-on-surface-variant text-center">
              Δεν βρέθηκε πρότυπο για «{query}»
            </p>
          ) : (
            <ul className="py-2">
              {results.map((item, idx) => (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={idx === activeIdx}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                      idx === activeIdx ? 'bg-primary/8' : 'hover:bg-surface-container-low'
                    }`}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => pick(item)}
                  >
                    <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-on-surface truncate">
                        {item.title}
                      </span>
                      <span className="block text-xs text-on-surface-variant truncate mt-0.5">
                        {item.subtitle}
                      </span>
                    </span>
                    {item.category && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/70 shrink-0 mt-1 max-w-[88px] text-right leading-tight">
                        {item.category}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
