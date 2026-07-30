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
}));

import { canAccessPlatformOperatorUi, isImpersonating } from '../lib/saasJwt.js';
import { isPlatformMarketingHost } from '../lib/platform/tenantHost.js';
import { shouldShowRentMenu } from './officeModulesApi.js';

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
