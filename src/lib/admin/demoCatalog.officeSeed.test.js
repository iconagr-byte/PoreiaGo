/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  isDemoBooking,
  isOfficeSeedTrip,
  stripDemoBookings,
  stripDemoTrips,
} from './demoCatalog.js';

describe('office seed trips vs platform demos', () => {
  it('keeps Achillio office-seeded Μετέωρα while stripping plain demo copy', () => {
    const kept = stripDemoTrips([
      { id: 91001, title: 'Ημερήσια στα Μετέωρα', officeSeed: true },
      { id: 1, title: 'Ημερήσια στα Μετέωρα' },
      { id: 42, title: 'Ναύπλιο Weekend' },
      { id: 1792475148749, title: 'ΚΩΝΣΤΑΝΤΙΝΟΥΠΟΛΗ: Η ΒΑΣΙΛΙΔΑ ΤΩΝ ΠΟΛΕΩΝ' },
    ]);
    expect(kept.map((t) => t.id)).toEqual([91001, 42, 1792475148749]);
  });

  it('does not strip marketing titles when id is an office seed / timestamp', () => {
    const kept = stripDemoTrips([
      { id: 91002, title: 'Απόδραση στην Πρωτεύουσα' },
      { id: 91003, title: 'Μαγευτικά Ιωάννινα' },
      { id: 3, title: 'Μαγευτικά Ιωάννινα' },
    ]);
    expect(kept.map((t) => t.id)).toEqual([91002, 91003]);
  });

  it('recognizes seed by reserved id range', () => {
    expect(isOfficeSeedTrip({ id: 91002, title: 'Απόδραση στην Πρωτεύουσα' })).toBe(true);
    expect(isOfficeSeedTrip({ id: 2, title: 'Απόδραση στην Πρωτεύουσα' })).toBe(false);
  });

  it('keeps real Μετέωρα guest bookings on office-seed trip 91001', () => {
    const kept = stripDemoBookings([
      {
        id: 'BK-AABBCCDD',
        pnr: 'BK-AABBCCDD',
        tripId: 91001,
        tripTitle: 'Ημερήσια στα Μετέωρα',
        customerName: 'Maria',
      },
      {
        id: 'B-1029',
        pnr: 'B-1029',
        tripId: 1,
        tripTitle: 'Ημερήσια στα Μετέωρα',
        customerName: 'Demo',
      },
      {
        id: 'BK-OLDDEMO',
        tripId: 2,
        tripTitle: 'Απόδραση στην Πρωτεύουσα',
        customerName: 'Legacy',
      },
    ]);
    expect(kept.map((b) => b.id)).toEqual(['BK-AABBCCDD']);
    expect(
      isDemoBooking({
        tripId: 91001,
        tripTitle: 'Ημερήσια στα Μετέωρα',
        pnr: 'BK-REAL1',
      }),
    ).toBe(false);
  });
});
