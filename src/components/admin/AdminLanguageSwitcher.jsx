import { useEffect, useRef, useState } from 'react';
import { useUiLang } from '../../hooks/useUiLang.js';
import { setUiLang } from '../../lib/i18n/uiLang.js';
import '../../styles/admin-language-switcher.css';

const OPTIONS = [
  { id: 'el', flag: 'ΕΛ' },
  { id: 'en', flag: 'EN' },
];

/**
 * Header language control — placed left of the notification bell.
 */
export default function AdminLanguageSwitcher() {
  const { lang, t } = useUiLang();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = OPTIONS.find((o) => o.id === lang) || OPTIONS[0];

  return (
    <div className="admin-lang" ref={rootRef}>
      <button
        type="button"
        className={`admin-lang-btn${open ? ' is-open' : ''}`}
        aria-label={t('language')}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="material-symbols-outlined admin-lang-icon" aria-hidden>
          translate
        </span>
        <span className="admin-lang-code">{current.flag}</span>
        <span className="material-symbols-outlined admin-lang-chevron" aria-hidden>
          expand_more
        </span>
      </button>

      {open ? (
        <ul className="admin-lang-menu" role="listbox" aria-label={t('language')}>
          {OPTIONS.map((opt) => {
            const active = opt.id === lang;
            const label = opt.id === 'en' ? t('lang_en') : t('lang_el');
            return (
              <li key={opt.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`admin-lang-option${active ? ' is-active' : ''}`}
                  onClick={() => {
                    setUiLang(opt.id);
                    setOpen(false);
                  }}
                >
                  <span className="admin-lang-option-code">{opt.flag}</span>
                  <span className="admin-lang-option-label">{label}</span>
                  {active ? (
                    <span className="material-symbols-outlined admin-lang-check" aria-hidden>
                      check
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
