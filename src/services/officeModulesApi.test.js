/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/saasJwt.js', () => ({
  canAccessPlatformOperatorUi: vi.fn(() => false),
  isImpersonating: vi.fn(() => false),
}));

vi.mock('../lib/platform/tenantHost.js', () => ({
  isPlatformMarketingHost: vi.fn(() => false),
  isAchillioTravelHost: vi.fn((hostname = '') => {
    const host = String(hostname || '').toLowerCase().split(':')[0];
    const apex = host.replace(/^www\./, '');
    return apex === 'achilliotravel.com' || host.endsWith('.achilliotravel.com');
  }),
}));

import { canAccessPlatformOperatorUi, isImpersonating } from '../lib/saasJwt.js';
import { isPlatformMarketingHost } from '../lib/platform/tenantHost.js';
import { shouldShowRentMenu, shouldShowRentStorefront } from './officeModulesApi.js';

describe('shouldShowRentMenu', () => {
  beforeEach(() => {
    canAccessPlatformOperatorUi.mockReturnValue(false);
    isImpersonating.mockReturnValue(false);
    isPlatformMarketingHost.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('hides Rent for Achillio Travel on its office context', () => {
    expect(
      shouldShowRentMenu({
        rent_enabled: true,
        office_kind: 'achillio_travel',
      }),
    ).toBe(false);
  });

  it('shows Rent for PoreiaGo Super Admin even when modules look like Achillio', () => {
    canAccessPlatformOperatorUi.mockReturnValue(true);
    expect(
      shouldShowRentMenu({
        rent_enabled: false,
        office_kind: 'achillio_travel',
      }),
    ).toBe(true);
  });

  it('shows Rent on PoreiaGo marketing host for Super Admin office', () => {
    isPlatformMarketingHost.mockReturnValue(true);
    expect(
      shouldShowRentMenu(
        {
          rent_enabled: false,
          office_kind: 'customer',
        },
        { hostname: 'www.poreiago.com' },
      ),
    ).toBe(true);
  });

  it('hides Rent while impersonating Achillio even on poreiago.com', () => {
    isImpersonating.mockReturnValue(true);
    isPlatformMarketingHost.mockReturnValue(true);
    expect(
      shouldShowRentMenu({
        rent_enabled: false,
        office_kind: 'achillio_travel',
      }),
    ).toBe(false);
  });

  it('shows Rent when office has rent_enabled', () => {
    expect(shouldShowRentMenu({ rent_enabled: true, office_kind: 'customer' })).toBe(true);
  });

  it('shows Rent for PoreiaGo platform office', () => {
    expect(
      shouldShowRentMenu({
        rent_enabled: false,
        office_kind: 'poreiago_platform',
      }),
    ).toBe(true);
  });

  it('shows Rent for historic PoreiaGo seed slug even when mis-tagged customer', () => {
    expect(
      shouldShowRentMenu({
        rent_enabled: false,
        office_kind: 'customer',
        tenant_slug: 'achillio',
      }),
    ).toBe(true);
  });

  it('shows Rent while impersonating PoreiaGo seed office', () => {
    isImpersonating.mockReturnValue(true);
    expect(
      shouldShowRentMenu({
        rent_enabled: false,
        office_kind: 'customer',
        tenant_slug: 'achillio',
      }),
    ).toBe(true);
  });

  it('shows Rent for Super Admin regardless of hostname', () => {
    canAccessPlatformOperatorUi.mockReturnValue(true);
    expect(
      shouldShowRentMenu(
        {
          rent_enabled: false,
          office_kind: 'customer',
        },
        { hostname: 'demo.example.com' },
      ),
    ).toBe(true);
  });

  it('hides Rent for regular offices without rent', () => {
    expect(
      shouldShowRentMenu({
        rent_enabled: false,
        office_kind: 'customer',
        tenant_slug: 'sunny-buses',
      }),
    ).toBe(false);
  });
});

describe('shouldShowRentStorefront', () => {
  beforeEach(() => {
    isPlatformMarketingHost.mockReturnValue(false);
  });

  it('shows Rent on PoreiaGo marketing host', () => {
    isPlatformMarketingHost.mockReturnValue(true);
    expect(shouldShowRentStorefront({ rent_enabled: false })).toBe(true);
  });

  it('hides Rent on tenant storefront without rent_enabled', () => {
    expect(
      shouldShowRentStorefront({
        rent_enabled: false,
        office_kind: 'customer',
      }),
    ).toBe(false);
  });

  it('shows Rent on tenant storefront when rent_enabled', () => {
    expect(
      shouldShowRentStorefront({
        rent_enabled: true,
        office_kind: 'customer',
      }),
    ).toBe(true);
  });

  it('hides Rent for Achillio Travel even if rent_enabled is set', () => {
    expect(
      shouldShowRentStorefront({
        rent_enabled: true,
        office_kind: 'achillio_travel',
      }),
    ).toBe(false);
  });

  it('hides Rent on achilliotravel.com hostname even if rent_enabled is set', () => {
    expect(
      shouldShowRentStorefront(
        { rent_enabled: true, office_kind: 'customer' },
        { hostname: 'www.achilliotravel.com' },
      ),
    ).toBe(false);
  });
});
