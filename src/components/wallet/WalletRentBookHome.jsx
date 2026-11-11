import { useMemo } from 'react';
import RentGuestHero from '../rental/RentGuestHero.jsx';
import RentBookingSearchBar from '../rental/RentBookingSearchBar.jsx';
import { resolveRentAppBranding } from '../../lib/rental/rentAppBranding.js';
import { resolveOfficeBrand } from '../../lib/branding/officeBrand.js';
import { getRentThemeById, resolveRentTheme } from '../../lib/rental/rentThemes.js';

/**
 * Book-first rent home inside My Wallet (native Ενοικιάσεις).
 * Same panel UX as /rent guest — not a Hertz clone.
 */
export default function WalletRentBookHome({
  siteAppearance = {},
  welcomeName = '',
  onSearch,
} = {}) {
  const brand = useMemo(() => resolveOfficeBrand(siteAppearance || {}), [siteAppearance]);
  const branding = useMemo(
    () =>
      resolveRentAppBranding(
        {
          ...(siteAppearance || {}),
          footer_brand_name: siteAppearance?.footer_brand_name || brand.displayName || '',
          display_name: brand.displayName || '',
        },
        { guest: true },
      ),
    [siteAppearance, brand.displayName],
  );
  const rentTheme = useMemo(() => resolveRentTheme(siteAppearance || {}), [siteAppearance]);
  const pickupLocations = useMemo(
    () =>
      Array.isArray(siteAppearance?.rent_pickup_locations)
        ? siteAppearance.rent_pickup_locations.map((x) => String(x || '').trim()).filter(Boolean)
        : [],
    [siteAppearance],
  );
  const footerAddress = String(siteAppearance?.footer_address || '').trim();
  const themeId = String(siteAppearance?.rent_theme_id || rentTheme.themeId || '').trim();
  const themeFromId = themeId ? getRentThemeById(themeId) : null;

  return (
    <div
      className="wallet-rent-bookfirst"
      data-rent-theme={themeFromId?.id || rentTheme.themeId}
      data-rent-hero={rentTheme.heroStyle}
    >
      <RentGuestHero
        brandLabel={branding.brandLabel}
        logoUrl={branding.logoUrl}
        brandSubtitle={branding.brandSubtitle}
        logoHeightPx={branding.logoHeightPx}
        logoMaxWidthPx={branding.logoMaxWidthPx}
        logoRadiusPx={branding.logoRadiusPx}
        logoPaddingPx={branding.logoPaddingPx}
        logoBgMode={branding.logoBgMode}
        logoShadow={branding.logoShadow}
        heroStyle={rentTheme.heroStyle}
        heroLayout={rentTheme.heroLayout}
        heroImageUrl={rentTheme.heroImageUrl}
        title={branding.title}
        titleAccent={branding.titleAccent}
        copy={branding.copy}
        welcomeName={welcomeName}
        siteAppearance={siteAppearance}
      >
        <RentBookingSearchBar
          variant="hero"
          brandLabel={branding.brandLabel}
          footerAddress={footerAddress}
          pickupLocations={pickupLocations}
          showDropoffToggle={branding.searchLayout?.showDropoffToggle !== false}
          showPromo={branding.searchLayout?.showPromo !== false}
          submitLabel={branding.searchLayout?.submitLabel || branding.ctaLabel || 'Δες οχήματα'}
          onSearch={(prefs) => onSearch?.(prefs)}
        />
      </RentGuestHero>
    </div>
  );
}
