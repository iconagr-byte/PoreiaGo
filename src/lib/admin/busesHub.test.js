import { describe, expect, it } from 'vitest';
import {
  BUSES_HUB_TAB_IDS,
  DEFAULT_BUSES_HUB_TAB,
  busesHubTabsInOrder,
  isBusesHubTab,
  moveBusesHubTab,
  normalizeBusesHubOrder,
  sanitizeBusesHubTab,
} from './busesHub.js';

describe('busesHub', () => {
  it('classifies buses hub tabs and fleet-ops subtabs', () => {
    expect(DEFAULT_BUSES_HUB_TAB).toBe('routes');
    expect(isBusesHubTab('routes')).toBe(true);
    expect(isBusesHubTab('fleet_ops')).toBe(true);
    expect(isBusesHubTab('fleet_kpis')).toBe(true);
    expect(isBusesHubTab('customers')).toBe(true);
    expect(isBusesHubTab('bus_setup')).toBe(true);
  });

  it('sanitizes tab ids', () => {
    expect(sanitizeBusesHubTab('bookings')).toBe('bookings');
    expect(sanitizeBusesHubTab('bus_setup')).toBe('bus_setup');
    expect(sanitizeBusesHubTab('fleet_kpis')).toBe('fleet_ops');
    expect(sanitizeBusesHubTab('nope')).toBe('routes');
  });

  it('normalizes and reorders saved menu order', () => {
    expect(normalizeBusesHubOrder(['bookings', 'routes', 'nope'])).toEqual([
      'bookings',
      'routes',
      ...BUSES_HUB_TAB_IDS.filter((id) => id !== 'bookings' && id !== 'routes'),
    ]);
    const moved = moveBusesHubTab(BUSES_HUB_TAB_IDS, 'bookings', 0);
    expect(moved[0]).toBe('bookings');
    expect(moved).toHaveLength(BUSES_HUB_TAB_IDS.length);
    expect(busesHubTabsInOrder(moved).map((t) => t.id)).toEqual(moved);

    const sample = ['routes', 'customers', 'fleet', 'bookings'];
    expect(moveBusesHubTab(sample, 'routes', 2)).toEqual([
      'customers',
      'routes',
      'fleet',
      'bookings',
    ]);
    expect(moveBusesHubTab(sample, 'bookings', 0)).toEqual([
      'bookings',
      'routes',
      'customers',
      'fleet',
    ]);
    expect(moveBusesHubTab(sample, 'customers', 1)).toEqual(sample);
  });
});
