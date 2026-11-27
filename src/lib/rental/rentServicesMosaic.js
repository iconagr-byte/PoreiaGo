/**
 * Rent home «Υπηρεσίες γραφείου» mosaic — office-configurable story panes
 * under the fleet list. Own PoreiaGo coastal look (not a Hertz clone).
 */

export const RENT_SERVICES_MOSAIC_MAX = 6;

export const DEFAULT_RENT_SERVICES_MOSAIC_CTA = 'Μάθετε περισσότερα';

/** Quick link targets the office can pick in the editor. */
export const RENT_SERVICES_MOSAIC_LINK_PRESETS = [
  { value: '#rent-guest-search', label: 'Κράτηση (αναζήτηση)' },
  { value: '#rent-guest-fleet', label: 'Στόλος οχημάτων' },
  { value: '/rent/wallet', label: 'My Wallet / check-in' },
  { value: '/contact', label: 'Επικοινωνία' },
];

export const DEFAULT_RENT_SERVICES_MOSAIC_CARDS = [
  {
    id: 'svc-cover',
    title: 'Καλύψεις & εξοπλισμός',
    subtitle:
      'Το γραφείο σας προσφέρει επιπλέον ασφάλεια, παιδικά καθίσματα και αξεσουάρ για το ταξίδι.',
    body:
      'Επιλέξτε κάλυψη και αξεσουάρ κατά την κράτηση. Το γραφείο σας ενημερώνει για τιμές και διαθεσιμότητα πριν την παραλαβή.',
    href: '#rent-guest-search',
    cta_label: DEFAULT_RENT_SERVICES_MOSAIC_CTA,
    image_url: '/images/rent-svc-cover.jpg',
    icon: 'verified_user',
  },
  {
    id: 'svc-pickup',
    title: 'Παραλαβή όπου σας βολεύει',
    subtitle:
      'Αεροδρόμιο, λιμάνι ή κατάστημα του γραφείου — επιλέξτε σημείο στην κράτηση.',
    body:
      'Στην κράτηση επιλέγετε σημείο παραλαβής και ώρα. Το γραφείο επιβεβαιώνει τη διαδρομή και σας ενημερώνει πριν φτάσετε.',
    href: '#rent-guest-search',
    cta_label: DEFAULT_RENT_SERVICES_MOSAIC_CTA,
    image_url: '/images/rent-svc-pickup.jpg',
    icon: 'location_on',
  },
  {
    id: 'svc-support',
    title: 'Υποστήριξη γραφείου',
    subtitle:
      'Η ομάδα του γραφείου είναι δίπλα σας πριν και κατά τη διάρκεια της ενοικίασης.',
    body:
      'Για αλλαγές, βοήθεια στον δρόμο ή ερωτήσεις για την κράτηση, επικοινωνήστε με το γραφείο από την κράτηση ή τη σελίδα επικοινωνίας.',
    href: '/contact',
    cta_label: 'Επικοινωνία',
    image_url: '/images/rent-svc-support.jpg',
    icon: 'support_agent',
  },
  {
    id: 'svc-checkin',
    title: 'Γρήγορο check-in στο γραφείο',
    subtitle:
      'Ολοκληρώστε τα έγγραφα online και παραλάβετε χωρίς αναμονή στο γκισέ.',
    body:
      'Ανοίξτε το My Wallet, ολοκληρώστε τα στοιχεία και τα έγγραφα πριν φτάσετε. Στο γκισέ μένει μόνο η παραλαβή του οχήματος.',
    href: '/rent/wallet',
    cta_label: 'Άνοιγμα Wallet',
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
  const subtitle = cleanText(row.subtitle || row.description);
  const body = cleanText(row.body || row.detail || row.long_text);
  if (!title && !subtitle && !body && !cleanText(row.image_url)) return null;
  return {
    id: cleanText(row.id) || `svc-${index + 1}`,
    title: title || 'Υπηρεσία γραφείου',
    subtitle,
    body,
    href: normalizeHref(row.href || row.url || row.link),
    cta_label:
      cleanText(row.cta_label || row.cta || row.button_label) ||
      DEFAULT_RENT_SERVICES_MOSAIC_CTA,
    image_url: cleanText(row.image_url || row.image || row.photo_url),
    icon: cleanText(row.icon) || 'spa',
  };
}

/** Follow a mosaic card href: hash scroll, in-app path, or external URL. */
export function followRentServicesMosaicHref(href, { navigate } = {}) {
  const target = normalizeHref(href);
  if (target.startsWith('#')) {
    const id = target.slice(1);
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return 'scroll';
    }
    return 'missing';
  }
  if (target.startsWith('tel:') || target.startsWith('mailto:')) {
    if (typeof window !== 'undefined') window.location.href = target;
    return 'protocol';
  }
  if (/^https?:\/\//i.test(target)) {
    if (typeof window !== 'undefined') {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
    return 'external';
  }
  if (typeof navigate === 'function') {
    navigate(target);
    return 'navigate';
  }
  if (typeof window !== 'undefined') {
    window.location.assign(target);
  }
  return 'assign';
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
