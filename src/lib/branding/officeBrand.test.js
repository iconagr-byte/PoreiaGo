import { describe, expect, it } from 'vitest';
import {
  isPlatformPlaceholderLogo,
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
