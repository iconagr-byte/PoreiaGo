/**
 * Platform UI language (EL / EN) — persisted for admin + syncs rent wallet lang.
 */
import { setRentLang } from '../rental/rentI18n.js';

export const UI_LANG_KEY = 'poreiago_ui_lang_v1';
export const UI_LANG_EVENT = 'poreiago-ui-lang';

/** @typedef {'el' | 'en'} UiLang */

/** @type {UiLang | null} */
let memoryLang = null;

/** @returns {UiLang} */
export function getUiLang() {
  if (memoryLang === 'en' || memoryLang === 'el') return memoryLang;
  try {
    const raw = localStorage.getItem(UI_LANG_KEY);
    if (raw === 'en' || raw === 'el') {
      memoryLang = raw;
      return raw;
    }
  } catch {
    /* ignore */
  }
  return 'el';
}

/** @param {string} lang @returns {UiLang} */
export function setUiLang(lang) {
  const next = lang === 'en' ? 'en' : 'el';
  memoryLang = next;
  try {
    localStorage.setItem(UI_LANG_KEY, next);
  } catch {
    /* ignore */
  }
  try {
    setRentLang(next);
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next === 'en' ? 'en' : 'el';
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UI_LANG_EVENT, { detail: { lang: next } }));
  }
  return next;
}

/** @param {(lang: UiLang) => void} listener @returns {() => void} */
export function subscribeUiLang(listener) {
  if (typeof window === 'undefined') return () => {};
  const onCustom = (e) => listener(e?.detail?.lang === 'en' ? 'en' : getUiLang());
  const onStorage = (e) => {
    if (e.key === UI_LANG_KEY) listener(getUiLang());
  };
  window.addEventListener(UI_LANG_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(UI_LANG_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

/** @returns {string} */
export function uiDateLocale(lang = getUiLang()) {
  return lang === 'en' ? 'en-GB' : 'el-GR';
}

/** Apply <html lang> on boot. */
export function bootUiLang() {
  const lang = getUiLang();
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang === 'en' ? 'en' : 'el';
  }
  return lang;
}
