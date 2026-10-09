import { useEffect, useState } from 'react';
import { t, tAdmin } from '../lib/i18n/t.js';
import { getUiLang, subscribeUiLang, uiDateLocale } from '../lib/i18n/uiLang.js';

/** Subscribe to platform UI language (EL/EN). */
export function useUiLang() {
  const [lang, setLang] = useState(() => getUiLang());

  useEffect(() => subscribeUiLang(setLang), []);

  return {
    lang,
    t: (key, vars) => t(key, vars, lang),
    tAdmin: (kind, id, fallback) => {
      // Force re-read via lang dependency by calling with current lang dict
      void lang;
      return tAdmin(kind, id, fallback);
    },
    dateLocale: uiDateLocale(lang),
    isEn: lang === 'en',
  };
}
