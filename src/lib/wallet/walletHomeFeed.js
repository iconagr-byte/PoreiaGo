/**
 * Resolve My Wallet «Αρχική» copy from office site appearance.
 * Empty custom fields fall back to hero / brand so every office looks intentional.
 *
 * Bus vs rent separation:
 * - Rent marketing/copy is used ONLY when opts.rentOnly is true (contract mode).
 * - wallet_home_show_trips=false only hides the trips block; it must NOT flip the office to rent.
 * - Rent-only empty services must NOT fall back to bus DEFAULT_SITE_APPEARANCE.wallet_home_services.
 */

import { DEFAULT_SITE_APPEARANCE } from '../../services/siteAppearanceApi.js';

/** Rent-safe Παροχές when a rent-only office has no custom wallet_home_services. */
export const RENT_WALLET_HOME_SERVICES = [
  {
    icon: 'directions_car',
    title: 'Online κράτηση',
    body: 'Κλείστε αυτοκίνητο σε λίγα βήματα από το κινητό.',
  },
  {
    icon: 'qr_code_2',
    title: 'Ψηφιακό check-in',
    body: 'Τα έγγραφα και το QR πάντα στο Wallet.',
  },
  {
    icon: 'support_agent',
    title: 'Υποστήριξη γραφείου',
    body: 'Είμαστε δίπλα σας πριν και κατά την ενοικίαση.',
  },
];

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeService(row, index = 0) {
  if (!row || typeof row !== 'object') return null;
  const title = cleanText(row.title);
  const body = cleanText(row.body || row.description);
  if (!title && !body) return null;
  return {
    id: cleanText(row.id) || `svc-${index}`,
    icon: cleanText(row.icon) || 'check_circle',
    title: title || 'Παροχή',
    body,
  };
}

function normalizeNews(row, index = 0) {
  if (!row || typeof row !== 'object') return null;
  const title = cleanText(row.title);
  const body = cleanText(row.body || row.text);
  if (!title && !body) return null;
  return {
    id: cleanText(row.id) || `news-${index}`,
    title: title || 'Νέα',
    body,
    date: cleanText(row.date || row.published_at),
    badge: cleanText(row.badge || row.tag),
  };
}

/**
 * @param {object} appearance
 * @param {{ officeName?: string, rentOnly?: boolean }} [opts]
 */
export function resolveWalletHomeFeed(appearance = {}, opts = {}) {
  const a = appearance && typeof appearance === 'object' ? appearance : {};
  const officeName =
    cleanText(opts.officeName) ||
    cleanText(a.rent_office_name) ||
    cleanText(a.footer_brand_name) ||
    'Το γραφείο μας';

  // Contract mode only — never infer rent from wallet_home_show_trips.
  // Bus/hybrid offices may hide the trips block without becoming rent-only.
  const rentOffice = Boolean(opts.rentOnly);

  // Rent-only offices often still carry bus DEFAULT hero_* until healed — prefer rent copy.
  const rentTitle = cleanText(a.rent_guest_hero_title) || cleanText(a.rent_hero_title);
  const rentBody =
    cleanText(a.rent_guest_hero_copy) || cleanText(a.rent_hero_copy);

  const hook =
    cleanText(a.wallet_home_hook) ||
    (rentOffice ? 'Ενοικιάσεις γραφείου' : '') ||
    cleanText(a.hero_badge) ||
    (rentOffice ? 'Ενοικιάσεις γραφείου' : DEFAULT_SITE_APPEARANCE.hero_badge);

  const headline =
    cleanText(a.wallet_home_headline) ||
    (rentOffice
      ? [rentTitle, cleanText(a.rent_guest_hero_title_accent)].filter(Boolean).join(' ')
      : '') ||
    [cleanText(a.hero_title), cleanText(a.hero_title_accent)].filter(Boolean).join(' ') ||
    `Καλώς ήρθατε στο ${officeName}`;

  const body =
    cleanText(a.wallet_home_body) ||
    (rentOffice ? rentBody : '') ||
    cleanText(a.hero_subtitle) ||
    (rentOffice
      ? 'Κράτηση, ημερολόγιο και χάρτης παραλαβής — όλα σε μία σελίδα.'
      : DEFAULT_SITE_APPEARANCE.hero_subtitle);

  const imageUrl =
    cleanText(a.wallet_home_image_url) ||
    (rentOffice ? cleanText(a.rent_hero_image_url) : '') ||
    cleanText(a.hero_image_url) ||
    '';

  const services = asList(a.wallet_home_services)
    .map(normalizeService)
    .filter(Boolean);
  const defaultServices = rentOffice
    ? RENT_WALLET_HOME_SERVICES
    : DEFAULT_SITE_APPEARANCE.wallet_home_services;
  const servicesOrDefault =
    services.length > 0
      ? services
      : asList(defaultServices).map(normalizeService).filter(Boolean);

  const news = asList(a.wallet_home_news).map(normalizeNews).filter(Boolean);

  // Trips visibility is independent of rent marketing — rent-only always hides bus trips.
  const showTrips = rentOffice ? false : a.wallet_home_show_trips !== false;
  const tripsTitle =
    cleanText(a.wallet_home_trips_title) ||
    (rentOffice
      ? 'Οι κρατήσεις σας'
      : DEFAULT_SITE_APPEARANCE.wallet_home_trips_title || 'Επερχόμενες εκδρομές');

  return {
    officeName,
    hook,
    headline,
    body,
    imageUrl,
    services: servicesOrDefault,
    news,
    showTrips,
    tripsTitle,
  };
}
