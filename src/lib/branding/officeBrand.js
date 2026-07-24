/** Shared office brand helpers for storefront header/footer. */

const PLATFORM_BRAND_RE = /^(aerostride|poreiago)$/i;
const PLATFORM_COPY_RE = /aerostride|poreiago/i;
/**
 * Only strip legacy PoreiaGo / AeroStride brand assets.
 * Do NOT treat `/api/site/assets/logo` as a placeholder — that is the real
 * uploaded office logo URL from the site-appearance upload API.
 */
const PLATFORM_LOGO_RE = /poreiago|aerostride/i;

export function isPlatformPlaceholderBrand(name) {
  return !name || PLATFORM_BRAND_RE.test(String(name).trim());
}

export function isPlatformPlaceholderCopyright(text) {
  return !text || PLATFORM_COPY_RE.test(String(text));
}

export function isPlatformPlaceholderLogo(url) {
  const value = String(url || '').trim();
  if (!value) return true;
  // Tenant uploads (data URLs, absolute CDN, /api/site/assets/…) are valid.
  if (value.startsWith('data:image/')) return false;
  if (value.startsWith('/api/site/assets/')) return false;
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
    heightPx: clampLogoHeight(siteAppearance.logo_height_px),
    maxWidthPx: clampLogoMaxWidth(siteAppearance.logo_max_width_px),
    // Default ON when a real office name exists — brand must be visible in the header.
    showName: siteAppearance.logo_show_name !== false && Boolean(name),
  };
}

export function clampLogoHeight(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 40;
  return Math.max(20, Math.min(96, Math.round(n)));
}

export function clampLogoMaxWidth(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 180;
  return Math.max(60, Math.min(400, Math.round(n)));
}

/** Inline styles for office logo images (header / footer / admin). */
export function officeLogoImageStyle(siteAppearance = {}) {
  return {
    height: `${clampLogoHeight(siteAppearance.logo_height_px)}px`,
    width: 'auto',
    maxWidth: `${clampLogoMaxWidth(siteAppearance.logo_max_width_px)}px`,
    objectFit: 'contain',
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
