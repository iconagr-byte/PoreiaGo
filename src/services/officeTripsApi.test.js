import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/api.js', () => ({ API_BASE: '' }));
vi.mock('./saasApi.js', () => ({
  getSaasTenantId: vi.fn(() => null),
  getSaasToken: vi.fn(() => null),
}));
vi.mock('../lib/trips/tripMarket.js', () => ({
  normalizeTrip: (t) => t,
}));
vi.mock('../lib/wallet/walletTenantSeal.js', () => ({
  getWalletTenantId: vi.fn(() => 'achillio-tenant-uuid'),
}));

import { fetchPublicOfficeTrips } from './officeTripsApi.js';
import { getWalletTenantId } from '../lib/wallet/walletTenantSeal.js';

describe('fetchPublicOfficeTrips', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getWalletTenantId.mockReturnValue('achillio-tenant-uuid');
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => [{ id: 91001, title: 'Ημερήσια στα Μετέωρα' }],
    }));
  });

  it('sends sealed tenant_id and browser host together', async () => {
    const list = await fetchPublicOfficeTrips({
      tenantId: 'achillio-tenant-uuid',
      host: 'www.achilliotravel.com',
    });

    expect(list).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = String(global.fetch.mock.calls[0][0]);
    expect(url).toContain('tenant_id=achillio-tenant-uuid');
    expect(url).toContain('host=www.achilliotravel.com');
  });

  it('falls back to sealed wallet tenant when opts omit tenantId', async () => {
    await fetchPublicOfficeTrips({ host: 'www.achilliotravel.com' });
    const url = String(global.fetch.mock.calls[0][0]);
    expect(url).toContain('tenant_id=achillio-tenant-uuid');
    expect(url).toContain('host=www.achilliotravel.com');
  });
});
