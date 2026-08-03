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

    // Insert-before index 2 while dragging routes (0) → lands after customers.
    const down = moveBusesHubTab(BUSES_HUB_TAB_IDS, 'routes', 2);
    expect(down[0]).toBe('customers');
    expect(down[1]).toBe('routes');
    expect(down).toHaveLength(BUSES_HUB_TAB_IDS.length);

    const up = moveBusesHubTab(BUSES_HUB_TAB_IDS, 'bookings', 0);
    expect(up[0]).toBe('bookings');

    // Adjacent drop is a no-op.
    expect(moveBusesHubTab(BUSES_HUB_TAB_IDS, 'customers', 1)).toEqual([...BUSES_HUB_TAB_IDS]);
  });
});
