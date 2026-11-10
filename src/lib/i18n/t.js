import { ADMIN_UI_DICT, adminLabelKey } from './adminUiDict.js';
import { getUiLang } from './uiLang.js';

/**
 * @param {string} key
 * @param {Record<string, string | number>} [vars]
 * @param {import('./uiLang.js').UiLang} [lang]
 */
export function t(key, vars, lang = getUiLang()) {
  const dict = ADMIN_UI_DICT[lang] || ADMIN_UI_DICT.el;
  let out = dict[key] ?? ADMIN_UI_DICT.el[key] ?? key;
  if (vars && typeof out === 'string') {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{${k}}`, String(v));
    }
  }
  return out;
}

/**
 * Localized label for nav / settings / rent ids, with Greek fallback from source.
 * @param {'nav'|'settings'|'rent'|'hint'|'section'} kind
 * @param {string} id
 * @param {string} [fallback]
 */
export function tAdmin(kind, id, fallback = '') {
  const key = adminLabelKey(kind, id);
  if (!key) return fallback || id;
  const lang = getUiLang();
  const dict = ADMIN_UI_DICT[lang] || ADMIN_UI_DICT.el;
  if (dict[key]) return dict[key];
  if (ADMIN_UI_DICT.el[key]) return lang === 'en' ? fallback || ADMIN_UI_DICT.el[key] : ADMIN_UI_DICT.el[key];
  return fallback || id;
}

/** Resolve sidebar / settings row label for the active UI language. */
export function tNavItem(item) {
  if (!item) return '';
  const id = String(item.id || '');
  const fallback = item.label || id;
  if (id.startsWith('fleet_rental_')) {
    return tAdmin('rent', id.slice('fleet_rental_'.length), fallback);
  }
  if (id.startsWith('settings_')) {
    return tAdmin('settings', id.slice('settings_'.length), fallback);
  }
  if (item.type === 'fleet_rental_subtab' && item.fleetRentalTab) {
    return tAdmin('rent', item.fleetRentalTab, fallback);
  }
  return tAdmin('nav', id, fallback);
}
