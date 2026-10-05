import { useState } from 'react';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import {
  DEFAULT_RENT_APP_BRANDING,
  rentBrandMarkStyleVars,
  splitRentBrandLabel,
} from '../../lib/rental/rentAppBranding.js';

const DEFAULT_LABEL = DEFAULT_RENT_APP_BRANDING.rent_brand_label;

/**
 * Rent header / hero brand — logo image when available, otherwise teal mark + wordmark.
 *
 * @param {'default' | 'onDark'} variant
 */
export default function RentBrandMark({
  label = DEFAULT_LABEL,
  logoUrl = '',
  showName = true,
  subtitle = '',
  compact = false,
  variant = 'default',
  logoHeightPx,
  logoMaxWidthPx,
  logoRadiusPx,
  logoPaddingPx,
  logoBgMode,
  logoShadow,
} = {}) {
  const [imgBroken, setImgBroken] = useState(false);
  const name = String(label || '').trim() || DEFAULT_LABEL;
  const { primary, accent } = splitRentBrandLabel(name);
  const src = !imgBroken && logoUrl ? resolveSiteAssetUrl(logoUrl) : '';
  const sub = String(subtitle || '').trim();
  const showSub = Boolean(sub) && sub.toLowerCase() !== name.toLowerCase();
  const onDark = variant === 'onDark';
  const bgMode = String(logoBgMode || 'none').trim().toLowerCase();
  const rootClass = [
    'rent-brand-mark',
    compact ? 'rent-brand-mark--compact' : '',
    onDark ? 'rent-brand-mark--on-dark' : '',
    bgMode !== 'none' ? `rent-brand-mark--bg-${bgMode}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const sizeStyle = rentBrandMarkStyleVars({
    logoHeightPx,
    logoMaxWidthPx,
    logoRadiusPx,
    logoPaddingPx,
    logoBgMode,
    logoShadow,
  });

  const wordmark = (
    <span className="rent-brand-mark-copy">
      <span className="rent-brand-mark-name">
        <span className="rent-brand-mark-word">{primary}</span>
        {accent ? <span className="rent-brand-mark-rent">{accent}</span> : null}
      </span>
      {showSub ? <span className="rent-brand-mark-sub">{sub}</span> : null}
    </span>
  );

  if (src) {
    return (
      <span className={rootClass} style={sizeStyle}>
        <span className="rent-brand-mark-logo-wrap">
          <img
            src={src}
            alt={name}
            className="rent-brand-mark-logo"
            onError={() => setImgBroken(true)}
          />
        </span>
        {showName ? wordmark : null}
      </span>
    );
  }

  return (
    <span className={rootClass} style={sizeStyle}>
      <span className="rent-brand-mark-badge" aria-hidden>
        <span className="material-symbols-outlined rent-brand-mark-icon">directions_car</span>
      </span>
      {wordmark}
    </span>
  );
}
