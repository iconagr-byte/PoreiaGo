import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatPlatformTenantLabel,
  normalizePlatformTenantList,
} from './tenantOptions.js';

describe('normalizePlatformTenantList', () => {
  it('unwraps items without double-listing', () => {
    const a = { id: '1', legal_name: 'PoreiaGo', slug: 'achillio' };
    const b = { id: '2', legal_name: 'Achillio Travel', slug: 'admin-achillio-gr' };
    assert.deepEqual(normalizePlatformTenantList({ items: [a, b], total: 2 }), [a, b]);
  });

  it('dedupes identical ids if a wrapper repeats rows', () => {
    const a = { id: '1', legal_name: 'PoreiaGo', slug: 'achillio' };
    assert.deepEqual(normalizePlatformTenantList({ items: [a, a] }), [a]);
  });

  it('keeps two real PoreiaGo rows with different ids', () => {
    const seed = { id: 'aaa', legal_name: 'PoreiaGo', slug: 'achillio' };
    const other = { id: 'bbb', legal_name: 'PoreiaGo', slug: 'poreiago' };
    assert.deepEqual(normalizePlatformTenantList({ items: [seed, other] }), [seed, other]);
  });
});

describe('formatPlatformTenantLabel', () => {
  it('disambiguates identical legal_names with slug', () => {
    assert.equal(
      formatPlatformTenantLabel({ legal_name: 'PoreiaGo', slug: 'achillio', subdomain: 'achillio' }),
      'PoreiaGo · achillio',
    );
    assert.equal(
      formatPlatformTenantLabel({ legal_name: 'PoreiaGo', slug: 'poreiago', subdomain: 'poreiago' }),
      'PoreiaGo · poreiago',
    );
  });

  it('shows subdomain when it differs from slug', () => {
    assert.equal(
      formatPlatformTenantLabel({
        legal_name: 'PoreiaGo',
        slug: 'achillio',
        subdomain: 'demo',
      }),
      'PoreiaGo · achillio / demo',
    );
  });
});
