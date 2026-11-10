import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPlatformSeatBookingDemo } from './platformBusDemoShowcase.js';

describe('isPlatformSeatBookingDemo', () => {
  it('is true on poreiago marketing hosts', () => {
    assert.equal(isPlatformSeatBookingDemo('www.poreiago.com'), true);
    assert.equal(isPlatformSeatBookingDemo('poreiago.com'), true);
    assert.equal(isPlatformSeatBookingDemo('localhost'), true);
  });

  it('is false on tenant storefront hosts', () => {
    assert.equal(isPlatformSeatBookingDemo('demo.poreiago.com'), false);
    assert.equal(isPlatformSeatBookingDemo('www.achilliotravel.com'), false);
  });

  it('is false on localhost when My Wallet is sealed to an office', () => {
    assert.equal(
      isPlatformSeatBookingDemo('localhost', { sealedWallet: true }),
      false,
    );
    assert.equal(
      isPlatformSeatBookingDemo('www.poreiago.com', { sealedWallet: true }),
      false,
    );
  });
});
