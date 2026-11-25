/**
 * Rent home «Υπηρεσίες γραφείου» mosaic — office-configurable story panes
 * under the fleet list. Own PoreiaGo coastal look (not a Hertz clone).
 */

export const RENT_SERVICES_MOSAIC_MAX = 6;

export const DEFAULT_RENT_SERVICES_MOSAIC_CARDS = [
  {
    id: 'svc-cover',
    title: 'Καλύψεις & εξοπλισμός',
    subtitle:
      'Το γραφείο σας προσφέρει επιπλέον ασφάλεια, παιδικά καθίσματα και αξεσουάρ για το ταξίδι.',
    href: '#rent-guest-search',
    image_url: '/images/rent-svc-cover.jpg',
    icon: 'verified_user',
  },
  {
    id: 'svc-pickup',
    title: 'Παραλαβή όπου σας βολεύει',
    subtitle:
      'Αεροδρόμιο, λιμάνι ή κατάστημα του γραφείου — επιλέξτε σημείο στην κράτηση.',
    href: '#rent-guest-search',
    image_url: '/images/rent-svc-pickup.jpg',
    icon: 'location_on',
  },
  {
    id: 'svc-support',
    title: 'Υποστήριξη γραφείου',
    subtitle:
      'Η ομάδα του γραφείου είναι δίπλα σας πριν και κατά τη διάρκεια της ενοικίασης.',
    href: '#rent-guest-search',
    image_url: '/images/rent-svc-support.jpg',
    icon: 'support_agent',
  },
  {
    id: 'svc-checkin',
    title: 'Γρήγορο check-in στο γραφείο',
    subtitle:
      'Ολοκληρώστε τα έγγραφα online και παραλάβετε χωρίς αναμονή στο γκισέ.',
    href: '/rent/wallet',
    image_url: '/images/rent-svc-checkin.jpg',
    icon: 'qr_code_2',
  },
];

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeHref(value) {
  const href = cleanText(value);
  if (!href) return '#rent-guest-search';
  if (href.startsWith('#') || href.startsWith('/') || /^https?:\/\//i.test(href)) {
    return href;
  }
  if (href.startsWith('tel:') || href.startsWith('mailto:')) return href;
  return `/${href.replace(/^\/+/, '')}`;
}

export function normalizeRentServicesMosaicCard(row, index = 0) {
  if (!row || typeof row !== 'object') return null;
  const title = cleanText(row.title);
  const subtitle = cleanText(row.subtitle || row.body || row.description);
  if (!title && !subtitle && !cleanText(row.image_url)) return null;
  return {
    id: cleanText(row.id) || `svc-${index + 1}`,
    title: title || 'Υπηρεσία γραφείου',
    subtitle,
    href: normalizeHref(row.href || row.url || row.link),
    image_url: cleanText(row.image_url || row.image || row.photo_url),
    icon: cleanText(row.icon) || 'spa',
  };
}

/**
 * @param {object} appearance
 * @returns {{
 *   enabled: boolean,
 *   kicker: string,
 *   title: string,
 *   lead: string,
 *   cards: Array<object>,
 * }}
 */
export function resolveRentServicesMosaic(appearance = {}) {
  const a = appearance && typeof appearance === 'object' ? appearance : {};
  const enabled = a.rent_services_mosaic_enabled !== false;
  const kicker = cleanText(a.rent_services_mosaic_kicker) || 'Γραφείο';
  const title =
    cleanText(a.rent_services_mosaic_title) || 'Υπηρεσίες του γραφείου μας';
  const lead =
    cleanText(a.rent_services_mosaic_lead) ||
    'Ό,τι προσφέρει το γραφείο δίπλα στον στόλο — πριν την κράτηση.';

  const raw = Array.isArray(a.rent_services_mosaic_cards)
    ? a.rent_services_mosaic_cards
    : [];
  let cards = raw
    .map((row, i) => normalizeRentServicesMosaicCard(row, i))
    .filter(Boolean)
    .slice(0, RENT_SERVICES_MOSAIC_MAX);

  if (!cards.length) {
    cards = DEFAULT_RENT_SERVICES_MOSAIC_CARDS.map((row, i) =>
      normalizeRentServicesMosaicCard(row, i),
    );
  }

  return { enabled, kicker, title, lead, cards };
}
