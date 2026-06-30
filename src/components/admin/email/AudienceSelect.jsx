import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { SEGMENT_OPTIONS } from '../../../lib/email/campaignBlocks.js';

export default function AudienceSelect({ value, onChange, segments = [], loading = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const options = segments.length > 0 ? segments : SEGMENT_OPTIONS;

  const selected = options.find((s) => s.id === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="emh-audience-select" ref={rootRef}>
      <button
        type="button"
        className={`emh-audience-trigger ${open ? 'emh-audience-trigger-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={loading}
      >
        <span className="emh-audience-trigger-icon" aria-hidden>
          <Users size={15} />
        </span>
        <span className="emh-audience-trigger-text">
          <span className="emh-audience-trigger-label">{selected?.label || 'Ακροατήριο'}</span>
          {selected?.count != null && (
            <span className="emh-audience-trigger-count">{selected.count} πελάτες</span>
          )}
        </span>
        <ChevronDown size={16} className={`emh-audience-chevron ${open ? 'emh-audience-chevron-open' : ''}`} />
      </button>

      {open && (
        <ul className="emh-audience-menu" role="listbox" aria-label="Ακροατήριο καμπάνιας">
          {options.map((opt) => {
            const active = opt.id === value;
            return (
              <li key={opt.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`emh-audience-option ${active ? 'emh-audience-option-active' : ''}`}
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                >
                  <span className="emh-audience-option-main">
                    <span className="emh-audience-option-label">{opt.label}</span>
                    {opt.description ? (
                      <span className="emh-audience-option-desc">{opt.description}</span>
                    ) : null}
                  </span>
                  <span className="emh-audience-option-badge">{opt.count ?? 0}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
