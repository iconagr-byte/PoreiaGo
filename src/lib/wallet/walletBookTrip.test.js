/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  isWalletBookFlow,
  officeTripFromWalletState,
  walletBookNavState,
  walletSelectSeatPath,
} from './walletBookTrip.js';

describe('walletBookTrip', () => {
  it('builds select-seat path for a trip id', () => {
    expect(walletSelectSeatPath(15)).toBe('/select-seat/15');
    expect(walletSelectSeatPath('99')).toBe('/select-seat/99');
    expect(walletSelectSeatPath(null)).toBe('/wallet');
  });

  it('marks nav state as fromWallet and seeds office trip', () => {
    expect(walletBookNavState()).toEqual({ fromWallet: true });
    const trip = { id: 7, title: 'Μετεωρα' };
    expect(walletBookNavState(trip)).toEqual({ fromWallet: true, officeTrip: trip });
    expect(isWalletBookFlow({ fromWallet: true })).toBe(true);
    expect(isWalletBookFlow(null)).toBe(false);
  });

  it('treats pendingCheckout.fromWallet as wallet book flow', () => {
    const store = globalThis.sessionStorage;
    if (!store || typeof store.setItem !== 'function') return;
    store.removeItem('pendingCheckout');
    expect(isWalletBookFlow({})).toBe(false);
    store.setItem('pendingCheckout', JSON.stringify({ fromWallet: true, tripId: 91001 }));
    expect(isWalletBookFlow({})).toBe(true);
    store.removeItem('pendingCheckout');
  });

  it('reads seeded office trip only when ids match', () => {
    const trip = { id: 42, title: 'Ιωάννινα' };
    expect(officeTripFromWalletState({ fromWallet: true, officeTrip: trip }, 42)).toEqual(trip);
    expect(officeTripFromWalletState({ fromWallet: true, officeTrip: trip }, '42')).toEqual(trip);
    expect(officeTripFromWalletState({ fromWallet: true, officeTrip: trip }, 99)).toBeNull();
    expect(officeTripFromWalletState({ fromWallet: true }, 42)).toBeNull();
    expect(officeTripFromWalletState(null, 42)).toBeNull();
  });
});
