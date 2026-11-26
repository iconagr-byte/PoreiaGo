/**
 * Rent home newsletter strip — office-configurable CTA under the services mosaic.
 * Split photo + seafoam panel (own look, not a Hertz yellow clone).
 * Email + consent only — no interest checkboxes.
 */

export const DEFAULT_RENT_NEWSLETTER = {
  enabled: true,
  title: 'Θέλεις τα νέα και τις προσφορές του γραφείου στο email σου;',
  image_url: '/images/rent-nl-coast.jpg',
  panel_color: '#dff3ee',
  button_label: 'Γράφομαι στο newsletter',
  email_placeholder: 'Συμπλήρωσε το email σου',
};

/** @deprecated Old default that asked visitors to pick interests. */
const LEGACY_RENT_NEWSLETTER_TITLE =
  'Θέλεις τα νέα και τις προσφορές του γραφείου στο email σου; Διάλεξε τι σε ενδιαφέρει:';

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

/**
 * @param {object} appearance
 */
export function resolveRentNewsletterStrip(appearance = {}) {
  const a = appearance && typeof appearance === 'object' ? appearance : {};
  const enabled = a.rent_newsletter_enabled !== false;
  const rawTitle = cleanText(a.rent_newsletter_title);
  const title =
    !rawTitle || rawTitle === LEGACY_RENT_NEWSLETTER_TITLE
      ? DEFAULT_RENT_NEWSLETTER.title
      : rawTitle;
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
    privacy_url,
    privacy_label,
  };
}
