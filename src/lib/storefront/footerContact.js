/**
 * Resolve public contact block for office storefront footers.
 * Never invents phone numbers; may derive a mailbox from the live Host.
 */

function apexFromHost(host) {
  const h = String(host || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
  if (!h || h === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return '';
  const parts = h.split('.').filter(Boolean);
  if (parts.length < 2) return '';
  if (parts[0] === 'www' && parts.length >= 3) return parts.slice(1).join('.');
  return h;
}

export function deriveOfficeInfoEmail(host) {
  const apex = apexFromHost(host);
  if (!apex) return '';
  // Skip SaaS marketing hosts — those are not an office mailbox.
  if (/(^|\.)poreiago\.com$/.test(apex)) return '';
  return `info@${apex}`;
}

/**
 * @param {object} siteAppearance
 * @param {{ host?: string }} [opts]
 */
export function resolveFooterContact(siteAppearance = {}, opts = {}) {
  const email = String(siteAppearance.footer_contact_email || '').trim();
  const phone = String(siteAppearance.footer_contact_phone || '').trim();
  const address = String(siteAppearance.footer_address || '').trim();
  const hours = String(siteAppearance.footer_hours || '').trim();
  const facebook = String(siteAppearance.footer_facebook_url || '').trim();
  const instagram = String(siteAppearance.footer_instagram_url || '').trim();

  let host = opts.host || '';
  if (!host && typeof window !== 'undefined') {
    host = window.location.hostname || '';
  }

  const resolvedEmail = email || deriveOfficeInfoEmail(host);

  return {
    email: resolvedEmail,
    phone,
    address,
    hours,
    facebook,
    instagram,
    hasAny: Boolean(resolvedEmail || phone || address || hours || facebook || instagram),
  };
}
