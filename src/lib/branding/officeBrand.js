/** Shared office brand helpers for storefront header/footer. */

const PLATFORM_BRAND_RE = /^(aerostride|poreiago)$/i;
const PLATFORM_COPY_RE = /aerostride|poreiago/i;

export function isPlatformPlaceholderBrand(name) {
  return !name || PLATFORM_BRAND_RE.test(String(name).trim());
}

export function isPlatformPlaceholderCopyright(text) {
  return !text || PLATFORM_COPY_RE.test(String(text));
}

/** Prefer office logo + custom footer name; never show AeroStride/PoreiaGo leftovers. */
export function resolveOfficeBrand(siteAppearance = {}) {
  const logoUrl = siteAppearance.logo_url || '';
  const rawName = (siteAppearance.footer_brand_name || siteAppearance.display_name || '').trim();
  const name = isPlatformPlaceholderBrand(rawName) ? '' : rawName;
  const rawCopy = (siteAppearance.footer_copyright || '').trim();
  const year = new Date().getFullYear();
  const copyright = isPlatformPlaceholderCopyright(rawCopy)
    ? name
      ? `© ${year} ${name}`
      : ''
    : rawCopy;

  return {
    logoUrl,
    name: name || 'Γραφείο',
    displayName: name,
    copyright,
    hasLogo: Boolean(logoUrl),
  };
}

/** Strip legacy platform defaults from appearance payloads. */
export function scrubSiteAppearancePlaceholders(data = {}) {
  const next = { ...data };
  if (isPlatformPlaceholderBrand(next.footer_brand_name)) {
    next.footer_brand_name = '';
  }
  if (isPlatformPlaceholderCopyright(next.footer_copyright)) {
    next.footer_copyright = '';
  }
  return next;
}
