/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../platform/tenantHost.js', () => ({
  isPlatformMarketingHost: vi.fn(() => true),
}));

import { isPlatformMarketingHost } from '../platform/tenantHost.js';
import {
  isAchillioTravelAppearance,
  scrubAchillioBrandForPlatformHost,
  shouldBlockStorefrontOnHost,
} from './platformStorefrontGuard.js';

describe('platformStorefrontGuard', () => {
  beforeEach(() => {
    isPlatformMarketingHost.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('detects Achillio Travel appearance', () => {
    expect(
      isAchillioTravelAppearance({
        footer_brand_name: 'Achillio Travel',
        logo_url: '/api/site/assets/logo',
      }),
    ).toBe(true);
  });

  it('scrubs Achillio brand to PoreiaGo on marketing host', () => {
    const next = scrubAchillioBrandForPlatformHost({
      footer_brand_name: 'Achillio Travel',
      rent_office_name: 'Achillion',
      logo_url: '/images/achillio-logo.png',
      hero_image_url: '/images/hero-bus-achillio.png',
      hero_title: 'Η Ελλάδα',
    });
    expect(next.footer_brand_name).toBe('PoreiaGo');
    expect(next.rent_office_name).toBe('PoreiaGo');
    expect(next.logo_url).toBe('');
    expect(next.hero_image_url).toBe('');
    expect(next.hero_title).toBe('Η Ελλάδα');
  });

  it('leaves appearance untouched off marketing host', () => {
    isPlatformMarketingHost.mockReturnValue(false);
    const raw = { footer_brand_name: 'Achillio Travel' };
    expect(scrubAchillioBrandForPlatformHost(raw)).toEqual(raw);
  });

  it('blocks storefront on PoreiaGo marketing host', () => {
    expect(shouldBlockStorefrontOnHost('www.poreiago.com')).toBe(true);
  });
});
