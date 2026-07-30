/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/saasJwt.js', () => ({
  canAccessPlatformOperatorUi: vi.fn(() => false),
}));

vi.mock('../lib/platform/tenantHost.js', () => ({
  isPlatformMarketingHost: vi.fn(() => false),
}));

import { canAccessPlatformOperatorUi } from '../lib/saasJwt.js';
import { isPlatformMarketingHost } from '../lib/platform/tenantHost.js';
import { shouldShowRentMenu } from './officeModulesApi.js';

describe('shouldShowRentMenu', () => {
  beforeEach(() => {
    canAccessPlatformOperatorUi.mockReturnValue(false);
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

  it('shows Rent for Achillio JWT only when Super Admin is on poreiago.com', () => {
    canAccessPlatformOperatorUi.mockReturnValue(true);
    isPlatformMarketingHost.mockReturnValue(true);
    expect(
      shouldShowRentMenu({
        rent_enabled: false,
        office_kind: 'achillio_travel',
      }),
    ).toBe(true);
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

  it('shows Rent for Super Admin on poreiago.com host', () => {
    canAccessPlatformOperatorUi.mockReturnValue(true);
    isPlatformMarketingHost.mockReturnValue(true);
    expect(
      shouldShowRentMenu({
        rent_enabled: false,
        office_kind: 'customer',
      }),
    ).toBe(true);
  });
});
