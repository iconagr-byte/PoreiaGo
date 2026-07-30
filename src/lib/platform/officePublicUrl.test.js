/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  getOfficePublicOrigin,
  getOfficeRentWalletUrl,
  getOfficeShareDisplayName,
  isForbiddenForeignOfficeHost,
} from './officePublicUrl.js';

describe('officePublicUrl seal — no Achillio Travel bleed', () => {
  it('never emits achilliotravel.com for PoreiaGo platform seed', () => {
    const branding = {
      slug: 'achillio',
      subdomain: 'achillio',
      display_name: 'Achillio Travel',
      custom_domain: 'achilliotravel.com',
      platform_domain: 'poreiago.com',
      checkout_base_url: 'https://www.achilliotravel.com',
    };
    expect(isForbiddenForeignOfficeHost('www.achilliotravel.com', branding)).toBe(true);
    expect(getOfficePublicOrigin(branding)).toBe('https://www.poreiago.com');
    expect(getOfficeRentWalletUrl(branding)).toBe('https://www.poreiago.com/rent/wallet');
    expect(getOfficeShareDisplayName(branding)).toBe('PoreiaGo');
  });

  it('keeps achilliotravel.com for the real Achillio Travel office', () => {
    const branding = {
      slug: 'admin-achillio-gr',
      subdomain: 'admin-achillio-gr',
      display_name: 'Achillio Travel',
      custom_domain: 'achilliotravel.com',
      platform_domain: 'poreiago.com',
    };
    expect(isForbiddenForeignOfficeHost('www.achilliotravel.com', branding)).toBe(false);
    expect(getOfficePublicOrigin(branding)).toBe('https://www.achilliotravel.com');
    expect(getOfficeRentWalletUrl(branding)).toBe(
      'https://www.achilliotravel.com/rent/wallet',
    );
    expect(getOfficeShareDisplayName(branding)).toBe('Achillio Travel');
  });

  it('blocks achilliotravel.com on unrelated customer offices', () => {
    const branding = {
      slug: 'sunny-rentals',
      subdomain: 'sunny',
      display_name: 'Sunny',
      custom_domain: 'www.achilliotravel.com',
      platform_domain: 'poreiago.com',
    };
    expect(getOfficePublicOrigin(branding)).toBe('https://sunny.poreiago.com');
  });
});
