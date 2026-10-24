/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  isWalletBookFlow,
  walletBookNavState,
  walletSelectSeatPath,
} from './walletBookTrip.js';

describe('walletBookTrip', () => {
  it('builds select-seat path for a trip id', () => {
    expect(walletSelectSeatPath(15)).toBe('/select-seat/15');
    expect(walletSelectSeatPath('99')).toBe('/select-seat/99');
    expect(walletSelectSeatPath(null)).toBe('/wallet');
  });

  it('marks nav state as fromWallet for back navigation', () => {
    expect(walletBookNavState()).toEqual({ fromWallet: true });
    expect(isWalletBookFlow({ fromWallet: true })).toBe(true);
    expect(isWalletBookFlow({})).toBe(false);
    expect(isWalletBookFlow(null)).toBe(false);
  });
});
