import { useState } from 'react';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

/**
 * Rent header / hero brand — logo image when available, otherwise teal mark + wordmark.
 * Replaces the bare «Γραφείο» text that looked like a placeholder.
 *
 * @param {'default' | 'onDark'} variant
 */
export default function RentBrandMark({
  label = 'Ενοικιάσεις',
  logoUrl = '',
  showName = true,
  subtitle = '',
  compact = false,
  variant = 'default',
} = {}) {
  const [imgBroken, setImgBroken] = useState(false);
  const name = String(label || '').trim() || 'Ενοικιάσεις';
  const src = !imgBroken && logoUrl ? resolveSiteAssetUrl(logoUrl) : '';
  const sub = String(subtitle || '').trim();
  const showSub = Boolean(sub) && sub.toLowerCase() !== name.toLowerCase();
  const onDark = variant === 'onDark';
  const rootClass = [
    'rent-brand-mark',
    compact ? 'rent-brand-mark--compact' : '',
    onDark ? 'rent-brand-mark--on-dark' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (src) {
    return (
      <span className={rootClass}>
        <span className="rent-brand-mark-logo-wrap">
          <img
            src={src}
            alt={name}
            className="rent-brand-mark-logo"
            onError={() => setImgBroken(true)}
          />
        </span>
        {showName ? (
          <span className="rent-brand-mark-copy">
            <span className="rent-brand-mark-name">{name}</span>
            {showSub ? <span className="rent-brand-mark-sub">{sub}</span> : null}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className={rootClass}>
      <span className="rent-brand-mark-badge" aria-hidden>
        <span className="material-symbols-outlined rent-brand-mark-icon">directions_car</span>
      </span>
      <span className="rent-brand-mark-copy">
        <span className="rent-brand-mark-name">{name}</span>
        {showSub ? <span className="rent-brand-mark-sub">{sub}</span> : null}
      </span>
    </span>
  );
}
