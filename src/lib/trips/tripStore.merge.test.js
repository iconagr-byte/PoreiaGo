/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(String(k), String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
};

vi.mock('../admin/officeTenantStore.js', () => ({
  isAuthenticatedOfficeSession: vi.fn(() => true),
  officeStorageKey: (base) => `${base}::tenant::test`,
}));

vi.mock('../platform/tenantHost.js', () => ({
  isPlatformMarketingHost: vi.fn(() => false),
  isTenantStorefrontHost: vi.fn(() => false),
}));

vi.mock('../../services/tripsSyncApi.js', () => ({
  syncTripToPostgres: vi.fn(),
}));

vi.mock('../../services/hybridTripApi.js', () => ({
  syncHybridTripToServer: vi.fn(),
}));

import { loadTrips, mergeServerTripsIntoStore, saveTrips } from './tripStore.js';

describe('mergeServerTripsIntoStore pruneMissingLocal', () => {
  beforeEach(() => {
    localStorage.clear();
    saveTrips([
      {
        id: 101,
        title: 'Keep',
        destination: 'A',
        price: 10,
        status: 'published',
      },
      {
        id: 102,
        title: 'test1',
        destination: 'B',
        price: 34,
        status: 'published',
      },
      {
        id: 103,
        title: 'τεστ',
        destination: 'C',
        price: 0,
        status: 'published',
      },
    ]);
  });

  it('drops local trips deleted on the server when pruning', () => {
    const result = mergeServerTripsIntoStore(
      [{ id: 101, title: 'Keep', destination: 'A', price: 10, status: 'published' }],
      { pruneMissingLocal: true },
    );
    expect(result.removed).toBe(2);
    expect(result.trips.map((t) => t.id)).toEqual([101]);
    expect(loadTrips().map((t) => t.id)).toEqual([101]);
  });

  it('keeps local-only ghosts when pruneMissingLocal is false', () => {
    const result = mergeServerTripsIntoStore(
      [{ id: 101, title: 'Keep', destination: 'A', price: 10, status: 'published' }],
      { pruneMissingLocal: false },
    );
    expect(result.removed).toBe(0);
    expect(result.trips.map((t) => t.id).sort((a, b) => a - b)).toEqual([101, 102, 103]);
  });

  it('clears all local trips when server catalog is empty and pruning', () => {
    const result = mergeServerTripsIntoStore([], { pruneMissingLocal: true });
    expect(result.removed).toBe(3);
    expect(result.trips).toEqual([]);
    expect(loadTrips()).toEqual([]);
  });
});
