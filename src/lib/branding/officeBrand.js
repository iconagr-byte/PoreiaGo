/** Shared office brand helpers for storefront header/footer. */

const PLATFORM_BRAND_RE = /^(aerostride|poreiago)$/i;
const PLATFORM_COPY_RE = /aerostride|poreiago/i;
/** Shared PoreiaGo platform asset — never show on office storefronts. */
const PLATFORM_LOGO_RE = /\/api\/site\/assets\/logo|poreiago|aerostride/i;

export function isPlatformPlaceholderBrand(name) {
  return !name || PLATFORM_BRAND_RE.test(String(name).trim());
}

export function isPlatformPlaceholderCopyright(text) {
  return !text || PLATFORM_COPY_RE.test(String(text));
}

export function isPlatformPlaceholderLogo(url) {
  const value = String(url || '').trim();
  if (!value) return true;
  return PLATFORM_LOGO_RE.test(value);
}

/** Prefer office logo + custom footer name; never show AeroStride/PoreiaGo leftovers. */
export function resolveOfficeBrand(siteAppearance = {}) {
  const rawLogo = siteAppearance.logo_url || '';
  const logoUrl = isPlatformPlaceholderLogo(rawLogo) ? '' : rawLogo;
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
  if (isPlatformPlaceholderLogo(next.logo_url)) {
    next.logo_url = '';
  }
  return next;
}
