/**
 * Rent home newsletter strip — office-configurable CTA under the services mosaic.
 * Split photo + seafoam panel (own look, not a Hertz yellow clone).
 */

export const RENT_NEWSLETTER_INTERESTS_MAX = 6;

export const DEFAULT_RENT_NEWSLETTER_INTERESTS = [
  { id: 'rent-cars', label: 'Ενοικίαση αυτοκινήτου' },
  { id: 'rent-offers', label: 'Προσφορές γραφείου' },
];

export const DEFAULT_RENT_NEWSLETTER = {
  enabled: true,
  title:
    'Θέλεις τα νέα και τις προσφορές του γραφείου στο email σου; Διάλεξε τι σε ενδιαφέρει:',
  image_url: '/images/rent-nl-coast.jpg',
  panel_color: '#dff3ee',
  button_label: 'Γράφομαι στο newsletter',
  email_placeholder: 'Συμπλήρωσε το email σου',
  interests: DEFAULT_RENT_NEWSLETTER_INTERESTS,
};

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeHexColor(value, fallback) {
  const raw = cleanText(value);
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

export function normalizeRentNewsletterInterest(row, index = 0) {
  if (!row || typeof row !== 'object') return null;
  const label = cleanText(row.label || row.title || row.name);
  if (!label) return null;
  return {
    id: cleanText(row.id) || `interest-${index + 1}`,
    label,
  };
}

/**
 * @param {object} appearance
 */
export function resolveRentNewsletterStrip(appearance = {}) {
  const a = appearance && typeof appearance === 'object' ? appearance : {};
  const enabled = a.rent_newsletter_enabled !== false;
  const title = cleanText(a.rent_newsletter_title) || DEFAULT_RENT_NEWSLETTER.title;
  const image_url =
    cleanText(a.rent_newsletter_image_url) || DEFAULT_RENT_NEWSLETTER.image_url;
  const panel_color = normalizeHexColor(
    a.rent_newsletter_panel_color,
    DEFAULT_RENT_NEWSLETTER.panel_color,
  );
  const button_label =
    cleanText(a.rent_newsletter_button_label) || DEFAULT_RENT_NEWSLETTER.button_label;
  const email_placeholder =
    cleanText(a.rent_newsletter_email_placeholder) ||
    DEFAULT_RENT_NEWSLETTER.email_placeholder;

  const raw = Array.isArray(a.rent_newsletter_interests)
    ? a.rent_newsletter_interests
    : [];
  let interests = raw
    .map((row, i) => normalizeRentNewsletterInterest(row, i))
    .filter(Boolean)
    .slice(0, RENT_NEWSLETTER_INTERESTS_MAX);

  if (!interests.length) {
    interests = DEFAULT_RENT_NEWSLETTER_INTERESTS.map((row, i) =>
      normalizeRentNewsletterInterest(row, i),
    );
  }

  const privacy_url = cleanText(a.footer_privacy_url) || '#';
  const privacy_label =
    cleanText(a.footer_privacy_label) || 'Πολιτική Απορρήτου';

  return {
    enabled,
    title,
    image_url,
    panel_color,
    button_label,
    email_placeholder,
    interests,
    privacy_url,
    privacy_label,
  };
}
