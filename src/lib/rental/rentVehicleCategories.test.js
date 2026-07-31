/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  countRentFleetByBody,
  groupVehiclesByRentCategory,
  normalizeRentVehicleCategory,
  rentCategoryLabel,
  rentHomeCategoryFilters,
} from './rentVehicleCategories.js';

describe('rentVehicleCategories', () => {
  it('maps legacy CAR demo models to ACRISS-style groups', () => {
    expect(
      normalizeRentVehicleCategory('CAR', { seats: 4, model: 'Toyota Aygo X' }),
    ).toBe('MINI');
    expect(
      normalizeRentVehicleCategory('CAR', { seats: 5, model: 'Peugeot 208' }),
    ).toBe('COMPACT');
    expect(normalizeRentVehicleCategory('SUV')).toBe('SUV');
    expect(
      normalizeRentVehicleCategory('VAN', { seats: 9, model: 'Ford Transit Custom' }),
    ).toBe('MINIBUS');
  });

  it('groups fleet into non-empty category sections', () => {
    const groups = groupVehiclesByRentCategory([
      { id: '1', category: 'CAR', model: 'Toyota Aygo X', seating_capacity: 4 },
      { id: '2', category: 'CAR', model: 'Peugeot 208', seating_capacity: 5 },
      { id: '3', category: 'VAN', model: 'VW Multivan', seating_capacity: 7 },
      { id: '4', category: 'VAN', model: 'Ford Transit Custom', seating_capacity: 9 },
    ]);
    expect(groups.map((g) => g.id)).toEqual(['MINI', 'COMPACT', 'VAN', 'MINIBUS']);
    expect(groups[0].count).toBe(1);
    expect(rentCategoryLabel('MINI')).toBe('Mini');
    expect(rentCategoryLabel('COMPACT')).toBe('Compact');
    expect(rentCategoryLabel('MINIBUS')).toBe('Minibus');
  });

  it('counts passenger vs van-like and builds home filters', () => {
    const fleet = [
      { category: 'MINI', model: 'Aygo', seating_capacity: 4 },
      { category: 'COMPACT', model: '208', seating_capacity: 5 },
      { category: 'VAN', model: 'Multivan', seating_capacity: 7 },
      { category: 'MINIBUS', model: 'Transit', seating_capacity: 9 },
    ];
    expect(countRentFleetByBody(fleet)).toEqual({ cars: 2, vans: 2 });
    expect(rentHomeCategoryFilters(fleet)).toEqual(['', 'MINI', 'COMPACT', 'VAN', 'MINIBUS']);
  });
});
