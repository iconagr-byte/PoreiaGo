/**
 * Resolve My Wallet «Αρχική» copy from office site appearance.
 * Empty custom fields fall back to hero / brand so every office looks intentional.
 */

import { DEFAULT_SITE_APPEARANCE } from '../../services/siteAppearanceApi.js';

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
 * @param {{ officeName?: string }} [opts]
 */
export function resolveWalletHomeFeed(appearance = {}, opts = {}) {
  const a = appearance && typeof appearance === 'object' ? appearance : {};
  const officeName =
    cleanText(opts.officeName) || cleanText(a.footer_brand_name) || 'Το γραφείο μας';

  const hook =
    cleanText(a.wallet_home_hook) ||
    cleanText(a.hero_badge) ||
    DEFAULT_SITE_APPEARANCE.hero_badge;

  const headline =
    cleanText(a.wallet_home_headline) ||
    [cleanText(a.hero_title), cleanText(a.hero_title_accent)].filter(Boolean).join(' ') ||
    `Καλώς ήρθατε στο ${officeName}`;

  const body =
    cleanText(a.wallet_home_body) ||
    cleanText(a.hero_subtitle) ||
    DEFAULT_SITE_APPEARANCE.hero_subtitle;

  const imageUrl =
    cleanText(a.wallet_home_image_url) || cleanText(a.hero_image_url) || '';

  const services = asList(a.wallet_home_services)
    .map(normalizeService)
    .filter(Boolean);
  const servicesOrDefault =
    services.length > 0
      ? services
      : asList(DEFAULT_SITE_APPEARANCE.wallet_home_services)
          .map(normalizeService)
          .filter(Boolean);

  const news = asList(a.wallet_home_news).map(normalizeNews).filter(Boolean);

  const showTrips = a.wallet_home_show_trips !== false;
  const tripsTitle =
    cleanText(a.wallet_home_trips_title) ||
    DEFAULT_SITE_APPEARANCE.wallet_home_trips_title ||
    'Επερχόμενες εκδρομές';

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
