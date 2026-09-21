/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  formatPlatformTenantLabel,
  normalizePlatformTenantList,
} from '../lib/platform/tenantOptions.js';

describe('normalizePlatformTenantList', () => {
  it('unwraps items without double-listing', () => {
    const a = { id: '1', legal_name: 'PoreiaGo', slug: 'achillio' };
    const b = { id: '2', legal_name: 'Achillio Travel', slug: 'admin-achillio-gr' };
    expect(normalizePlatformTenantList({ items: [a, b], total: 2 })).toEqual([a, b]);
  });

  it('dedupes identical ids if a wrapper repeats rows', () => {
    const a = { id: '1', legal_name: 'PoreiaGo', slug: 'achillio' };
    expect(normalizePlatformTenantList({ items: [a, a] })).toEqual([a]);
  });

  it('keeps two real PoreiaGo rows with different ids', () => {
    const seed = { id: 'aaa', legal_name: 'PoreiaGo', slug: 'achillio' };
    const other = { id: 'bbb', legal_name: 'PoreiaGo', slug: 'poreiago' };
    expect(normalizePlatformTenantList({ items: [seed, other] })).toEqual([seed, other]);
  });
});

describe('formatPlatformTenantLabel', () => {
  it('disambiguates identical legal_names with slug', () => {
    expect(
      formatPlatformTenantLabel({ legal_name: 'PoreiaGo', slug: 'achillio', subdomain: 'achillio' }),
    ).toBe('PoreiaGo · achillio');
    expect(
      formatPlatformTenantLabel({ legal_name: 'PoreiaGo', slug: 'poreiago', subdomain: 'poreiago' }),
    ).toBe('PoreiaGo · poreiago');
  });

  it('shows subdomain when it differs from slug', () => {
    expect(
      formatPlatformTenantLabel({
        legal_name: 'PoreiaGo',
        slug: 'achillio',
        subdomain: 'demo',
      }),
    ).toBe('PoreiaGo · achillio / demo');
  });
});
