import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSES_HUB_TAB,
  isBusesHubTab,
  sanitizeBusesHubTab,
} from './busesHub.js';

describe('busesHub', () => {
  it('classifies buses hub tabs and fleet-ops subtabs', () => {
    expect(DEFAULT_BUSES_HUB_TAB).toBe('routes');
    expect(isBusesHubTab('routes')).toBe(true);
    expect(isBusesHubTab('fleet_ops')).toBe(true);
    expect(isBusesHubTab('fleet_kpis')).toBe(true);
    expect(isBusesHubTab('customers')).toBe(true);
  });

  it('sanitizes tab ids', () => {
    expect(sanitizeBusesHubTab('bookings')).toBe('bookings');
    expect(sanitizeBusesHubTab('fleet_kpis')).toBe('fleet_ops');
    expect(sanitizeBusesHubTab('nope')).toBe('routes');
  });
});
