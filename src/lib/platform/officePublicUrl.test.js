/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  getOfficePublicOrigin,
  getOfficeRentWalletUrl,
  getOfficeShareDisplayName,
  getOfficeWalletUrl,
  isForbiddenForeignOfficeHost,
  sanitizeOfficeBrandingForShare,
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

  it('session seal: PoreiaGo admin never advertises Achillio Travel domain', () => {
    const branding = {
      slug: 'admin-achillio-gr',
      subdomain: 'admin-achillio-gr',
      display_name: 'Achillio Travel',
      custom_domain: 'achilliotravel.com',
      platform_domain: 'poreiago.com',
    };
    expect(
      getOfficeWalletUrl(branding, { contextHost: 'www.poreiago.com' }),
    ).toBe('https://www.poreiago.com/wallet');
    expect(
      getOfficePublicOrigin(branding, { contextHost: 'admin.poreiago.com' }),
    ).toBe('https://www.poreiago.com');
  });

  it('session seal: Achillio host keeps Achillio Travel wallet URL', () => {
    const branding = {
      slug: 'admin-achillio-gr',
      subdomain: 'admin-achillio-gr',
      display_name: 'Achillio Travel',
      custom_domain: 'achilliotravel.com',
      platform_domain: 'poreiago.com',
    };
    expect(
      getOfficeWalletUrl(branding, { contextHost: 'www.achilliotravel.com' }),
    ).toBe('https://www.achilliotravel.com/wallet');
  });

  it('sanitizes poisoned checkout/custom_domain on platform branding', () => {
    const cleaned = sanitizeOfficeBrandingForShare({
      slug: 'poreiago',
      display_name: 'Achillio Travel',
      custom_domain: 'www.achilliotravel.com',
      checkout_base_url: 'https://www.achilliotravel.com',
      platform_domain: 'poreiago.com',
    });
    expect(cleaned.custom_domain).toBe('');
    expect(cleaned.checkout_base_url).toBe('https://www.poreiago.com');
    expect(cleaned.display_name).toBe('PoreiaGo');
  });
});
