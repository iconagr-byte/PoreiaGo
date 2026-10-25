/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const store = new Map();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => {
        store.set(k, String(v));
      },
      removeItem: (k) => {
        store.delete(k);
      },
      clear: () => store.clear(),
    },
  });
  vi.stubGlobal('localStorage', window.localStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
  store.clear();
});

describe('walletPassLifecycle', () => {
  test('dismissWalletPass stores aliases and clear removes one', async () => {
    const {
      clearDismissedWalletPass,
      dismissWalletPass,
      loadDismissedWalletPassIds,
    } = await import('./walletPassLifecycle.js');

    expect(loadDismissedWalletPassIds()).toEqual([]);
    const next = dismissWalletPass(['B1', 'PNR-1']);
    expect(next).toEqual(['B1', 'PNR-1']);
    expect(loadDismissedWalletPassIds()).toEqual(['B1', 'PNR-1']);
    expect(clearDismissedWalletPass('B1')).toEqual(['PNR-1']);
  });
});
