import { describe, expect, it } from 'vitest';
import { segmentGpsSessions, pathLengthKm } from './fleetVehicleHistory.js';
import { vehicleHasActiveExcursion } from './fleetBusPillLabel.js';

describe('segmentGpsSessions', () => {
  it('returns empty for no points', () => {
    expect(segmentGpsSessions([])).toEqual([]);
  });

  it('keeps continuous points as one session', () => {
    const points = [
      { lat: 38.1, lng: 23.7, recorded_at: '2026-03-25T08:00:00.000Z', speed_kmh: 40 },
      { lat: 38.11, lng: 23.71, recorded_at: '2026-03-25T08:05:00.000Z', speed_kmh: 50 },
      { lat: 38.12, lng: 23.72, recorded_at: '2026-03-25T08:10:00.000Z', speed_kmh: 45 },
    ];
    const sessions = segmentGpsSessions(points, { activeWithinMs: 0 });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].enteredAt).toBe('2026-03-25T08:00:00.000Z');
    expect(sessions[0].exitedAt).toBe('2026-03-25T08:10:00.000Z');
    expect(sessions[0].pointCount).toBe(3);
    expect(sessions[0].km).toBeGreaterThan(0);
  });

  it('splits when gap exceeds threshold (enter / exit)', () => {
    const points = [
      { lat: 38.1, lng: 23.7, recorded_at: '2026-03-25T08:00:00.000Z', speed_kmh: 30 },
      { lat: 38.11, lng: 23.71, recorded_at: '2026-03-25T08:10:00.000Z', speed_kmh: 35 },
      // 45 min gap → new map appearance
      { lat: 38.2, lng: 23.8, recorded_at: '2026-03-25T08:55:00.000Z', speed_kmh: 20 },
      { lat: 38.21, lng: 23.81, recorded_at: '2026-03-25T09:00:00.000Z', speed_kmh: 25 },
    ];
    const sessions = segmentGpsSessions(points, { gapMs: 20 * 60 * 1000, activeWithinMs: 0 });
    expect(sessions).toHaveLength(2);
    expect(sessions[0].enteredAt).toBe('2026-03-25T08:00:00.000Z');
    expect(sessions[0].exitedAt).toBe('2026-03-25T08:10:00.000Z');
    expect(sessions[1].enteredAt).toBe('2026-03-25T08:55:00.000Z');
    expect(sessions[1].exitedAt).toBe('2026-03-25T09:00:00.000Z');
  });
});

describe('pathLengthKm', () => {
  it('returns 0 for fewer than 2 points', () => {
    expect(pathLengthKm([])).toBe(0);
    expect(pathLengthKm([{ lat: 1, lng: 2 }])).toBe(0);
  });
});

describe('vehicleHasActiveExcursion', () => {
  it('is false for rentals and idle pins', () => {
    expect(vehicleHasActiveExcursion({ is_rental: true, trip_id: 9 })).toBe(false);
    expect(vehicleHasActiveExcursion({ bus_plate: 'EEX5670' })).toBe(false);
    expect(vehicleHasActiveExcursion(null)).toBe(false);
  });

  it('is true when trip is bound', () => {
    expect(vehicleHasActiveExcursion({ trip_id: 42, bus_plate: 'AAA1111' })).toBe(true);
    expect(vehicleHasActiveExcursion({ tripTitle: 'Σούνιο', bus_plate: 'AAA1111' })).toBe(true);
  });
});
