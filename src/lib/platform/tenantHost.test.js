import assert from 'node:assert/strict';
import { isPlatformMarketingHost, isTenantStorefrontHost } from './tenantHost.js';

assert.equal(isPlatformMarketingHost('www.poreiago.com'), true);
assert.equal(isPlatformMarketingHost('poreiago.com'), true);
assert.equal(isPlatformMarketingHost('localhost'), true);
assert.equal(isTenantStorefrontHost('www.poreiago.com'), false);
assert.equal(isTenantStorefrontHost('www.achilliotravel.com'), true);
assert.equal(isTenantStorefrontHost('achilliotravel.com'), true);
assert.equal(isTenantStorefrontHost('demo.poreiago.com'), true);
assert.equal(isTenantStorefrontHost('api.poreiago.com'), false);
assert.equal(isTenantStorefrontHost('www.demo.poreiago.com'), false);

console.log('tenantHost: OK');
