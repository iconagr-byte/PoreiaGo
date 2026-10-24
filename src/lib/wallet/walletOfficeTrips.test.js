/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/officeTripsApi.js', () => ({
  fetchPublicOfficeTrips: vi.fn(),
}));

vi.mock('../trips/tripStore.js', () => ({
  loadTrips: vi.fn(() => []),
}));

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      map.set(String(k), String(v));
    },
    removeItem: (k) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
}

globalThis.sessionStorage = makeStorage();

import { fetchPublicOfficeTrips } from '../../services/officeTripsApi.js';
import { loadTrips } from '../trips/tripStore.js';
import {
  getCachedWalletOfficeTrips,
  rememberWalletOfficeTrips,
  resolvePublicOfficeTrip,
} from './walletOfficeTrips.js';

describe('walletOfficeTrips', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    loadTrips.mockReturnValue([]);
  });

  it('caches and returns sealed-office trips for booking', () => {
    const trips = [
      { id: 10, title: 'Μετέωρα' },
      { id: 11, title: 'Αθήνα' },
    ];
    rememberWalletOfficeTrips(trips, 'achillio-tid');
    expect(getCachedWalletOfficeTrips('achillio-tid')).toEqual(trips);
    expect(getCachedWalletOfficeTrips('other-tid')).toEqual([]);
  });

  it('resolvePublicOfficeTrip hits session cache before API', async () => {
    rememberWalletOfficeTrips([{ id: 42, title: 'Ιωάννινα', price: 28 }], 't1');
    const hit = await resolvePublicOfficeTrip(42, 't1');
    expect(hit?.title).toBe('Ιωάννινα');
    expect(fetchPublicOfficeTrips).not.toHaveBeenCalled();
  });

  it('resolvePublicOfficeTrip fetches sealed catalog when cache misses', async () => {
    fetchPublicOfficeTrips.mockResolvedValue([{ id: 7, title: 'Κωνσταντινούπολη', price: 250 }]);
    const hit = await resolvePublicOfficeTrip(7, 't1');
    expect(hit?.title).toBe('Κωνσταντινούπολη');
    expect(fetchPublicOfficeTrips).toHaveBeenCalledWith({ tenantId: 't1' });
  });
});
