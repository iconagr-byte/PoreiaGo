import { describe, expect, it } from 'vitest';
import {
  isPlatformPlaceholderLogo,
  officeLogoImageStyle,
  resolveOfficeBrand,
  scrubSiteAppearancePlaceholders,
} from './officeBrand.js';

describe('isPlatformPlaceholderLogo', () => {
  it('keeps uploaded site asset and data URLs', () => {
    expect(isPlatformPlaceholderLogo('/api/site/assets/logo?v=12')).toBe(false);
    expect(isPlatformPlaceholderLogo('/api/site/assets/logo')).toBe(false);
    expect(isPlatformPlaceholderLogo('data:image/png;base64,abc')).toBe(false);
    expect(isPlatformPlaceholderLogo('https://cdn.example/brand.png')).toBe(false);
  });

  it('strips empty and legacy platform brand URLs', () => {
    expect(isPlatformPlaceholderLogo('')).toBe(true);
    expect(isPlatformPlaceholderLogo('https://www.poreiago.com/mark.svg')).toBe(true);
    expect(isPlatformPlaceholderLogo('/branding/aerostride-logo.png')).toBe(true);
  });
});

describe('resolveOfficeBrand', () => {
  it('shows uploaded asset logos on the storefront', () => {
    const brand = resolveOfficeBrand({
      logo_url: '/api/site/assets/logo?v=99',
      footer_brand_name: 'Achillio Travel',
    });
    expect(brand.hasLogo).toBe(true);
    expect(brand.logoUrl).toContain('/api/site/assets/logo');
    expect(brand.showName).toBe(true);
    expect(brand.displayName).toBe('Achillio Travel');
  });

  it('hides name only when logo_show_name is explicitly false', () => {
    const brand = resolveOfficeBrand({
      logo_url: '/api/site/assets/logo',
      footer_brand_name: 'Achillio Travel',
      logo_show_name: false,
    });
    expect(brand.showName).toBe(false);
  });

  it('applies rounded logo styles', () => {
    const style = officeLogoImageStyle({
      logo_height_px: 48,
      logo_max_width_px: 120,
      logo_radius_px: 16,
      logo_padding_px: 4,
      logo_bg_mode: 'white',
      logo_shadow: true,
    });
    expect(style.borderRadius).toBe('16px');
    expect(style.padding).toBe('4px');
    expect(style.background).toBe('#ffffff');
    expect(style.boxShadow).toContain('rgba');
  });
});

describe('scrubSiteAppearancePlaceholders', () => {
  it('does not wipe real uploaded logos', () => {
    const next = scrubSiteAppearancePlaceholders({
      logo_url: '/api/site/assets/logo?v=1',
      footer_brand_name: 'Office',
    });
    expect(next.logo_url).toBe('/api/site/assets/logo?v=1');
  });
});
