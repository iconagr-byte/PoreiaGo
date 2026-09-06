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

  it('scrubs opaque Achillio logo on platform seed slug even off marketing host', () => {
    isPlatformMarketingHost.mockReturnValue(false);
    const next = scrubAchillioBrandForPlatformHost({
      tenant_slug: 'achillio',
      footer_brand_name: 'Achillio Travel',
      logo_url: 'data:image/png;base64,AAA',
    });
    expect(next.footer_brand_name).toBe('PoreiaGo');
    expect(next.logo_url).toBe('');
  });

  it('leaves Achillio Travel office appearance untouched off marketing host', () => {
    isPlatformMarketingHost.mockReturnValue(false);
    const raw = {
      tenant_slug: 'admin-achillio-gr',
      footer_brand_name: 'Achillio Travel',
      logo_url: 'data:image/png;base64,AAA',
    };
    expect(scrubAchillioBrandForPlatformHost(raw)).toEqual(raw);
  });

  it('keeps Achillio Travel logo when admin UI is on poreiago.com', () => {
    isPlatformMarketingHost.mockReturnValue(true);
    const raw = {
      tenant_slug: 'admin-achillio-gr',
      footer_brand_name: 'Achillio Travel',
      logo_url: '/api/site/office-assets/tid/logo/logo.jpg',
    };
    expect(scrubAchillioBrandForPlatformHost(raw)).toEqual(raw);
  });

  it('still scrubs Achillio poison on marketing host without customer slug', () => {
    isPlatformMarketingHost.mockReturnValue(true);
    const next = scrubAchillioBrandForPlatformHost({
      footer_brand_name: 'Achillio Travel',
      logo_url: '/api/site/office-assets/tid/logo/logo.jpg',
    });
    expect(next.footer_brand_name).toBe('PoreiaGo');
    expect(next.logo_url).toBe('');
  });

  it('blocks storefront on PoreiaGo marketing host', () => {
    expect(shouldBlockStorefrontOnHost('www.poreiago.com')).toBe(true);
  });
});
