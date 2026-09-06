/** Shared office brand helpers for storefront header/footer. */

const PLATFORM_BRAND_RE = /^(aerostride|poreiago)$/i;
const PLATFORM_COPY_RE = /aerostride|poreiago/i;
/**
 * Only strip legacy PoreiaGo / AeroStride brand assets.
 * Do NOT treat `/api/site/assets/logo` as a placeholder — that is the real
 * uploaded office logo URL from the site-appearance upload API.
 */
const PLATFORM_LOGO_RE = /poreiago|aerostride/i;

const LOGO_BG_MODES = new Set(['none', 'white', 'soft', 'dark']);

export function isPlatformPlaceholderBrand(name) {
  return !name || PLATFORM_BRAND_RE.test(String(name).trim());
}

export function isPlatformPlaceholderCopyright(text) {
  return !text || PLATFORM_COPY_RE.test(String(text));
}

export function isPlatformPlaceholderLogo(url) {
  const value = String(url || '').trim();
  if (!value) return true;
  // Tenant uploads (data URLs, absolute CDN, /api/site/assets/…, office-assets) are valid.
  if (value.startsWith('data:image/')) return false;
  if (value.startsWith('/api/site/assets/')) return false;
  if (value.startsWith('/api/site/office-assets/')) return false;
  return PLATFORM_LOGO_RE.test(value);
}

/** Prefer office logo + custom footer name; never show AeroStride/PoreiaGo leftovers. */
export function resolveOfficeBrand(siteAppearance = {}) {
  const rawLogo = siteAppearance.logo_url || '';
  const logoUrl = isPlatformPlaceholderLogo(rawLogo) ? '' : rawLogo;
  const rawName = (
    siteAppearance.footer_brand_name ||
    siteAppearance.rent_office_name ||
    siteAppearance.display_name ||
    ''
  ).trim();
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
    radiusPx: clampLogoRadius(siteAppearance.logo_radius_px),
    paddingPx: clampLogoPadding(siteAppearance.logo_padding_px),
    bgMode: normalizeLogoBgMode(siteAppearance.logo_bg_mode),
    shadow: siteAppearance.logo_shadow === true,
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

export function clampLogoRadius(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(48, Math.round(n)));
}

export function clampLogoPadding(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(24, Math.round(n)));
}

export function normalizeLogoBgMode(value) {
  const mode = String(value || 'none').trim().toLowerCase();
  return LOGO_BG_MODES.has(mode) ? mode : 'none';
}

function logoBgColor(mode) {
  switch (mode) {
    case 'white':
      return '#ffffff';
    case 'soft':
      return 'rgba(15, 23, 42, 0.06)';
    case 'dark':
      return 'rgba(15, 23, 42, 0.92)';
    default:
      return 'transparent';
  }
}

/** Inline styles for office logo images (header / footer / admin). */
export function officeLogoImageStyle(siteAppearance = {}) {
  const radius = clampLogoRadius(siteAppearance.logo_radius_px);
  const padding = clampLogoPadding(siteAppearance.logo_padding_px);
  const bgMode = normalizeLogoBgMode(siteAppearance.logo_bg_mode);
  const shadow = siteAppearance.logo_shadow === true;
  const style = {
    height: `${clampLogoHeight(siteAppearance.logo_height_px)}px`,
    width: 'auto',
    maxWidth: `${clampLogoMaxWidth(siteAppearance.logo_max_width_px)}px`,
    objectFit: 'contain',
    borderRadius: `${radius}px`,
    padding: padding ? `${padding}px` : undefined,
    background: bgMode === 'none' ? undefined : logoBgColor(bgMode),
    boxShadow: shadow ? '0 4px 14px rgba(15, 23, 42, 0.14)' : undefined,
    display: 'block',
  };
  return style;
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
