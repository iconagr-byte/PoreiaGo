/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { isOfficeSeedTrip, stripDemoTrips } from './demoCatalog.js';

describe('office seed trips vs platform demos', () => {
  it('keeps Achillio office-seeded Μετέωρα while stripping plain demo copy', () => {
    const kept = stripDemoTrips([
      { id: 91001, title: 'Ημερήσια στα Μετέωρα', officeSeed: true },
      { id: 1, title: 'Ημερήσια στα Μετέωρα' },
      { id: 42, title: 'Ναύπλιο Weekend' },
    ]);
    expect(kept.map((t) => t.id)).toEqual([91001, 42]);
  });

  it('recognizes seed by reserved id range', () => {
    expect(isOfficeSeedTrip({ id: 91002, title: 'Απόδραση στην Πρωτεύουσα' })).toBe(true);
    expect(isOfficeSeedTrip({ id: 2, title: 'Απόδραση στην Πρωτεύουσα' })).toBe(false);
  });
});
