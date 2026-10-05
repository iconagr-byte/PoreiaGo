/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { RENT_DESK_TABS, buildRentDeskNavItems } from './rentDeskNav.js';
import { ADMIN_NAV_ITEMS } from './sidebarNav.js';

describe('rent desk nav vs bus fleet', () => {
  it('does not reuse plain bus labels for rent desk items', () => {
    const labels = RENT_DESK_TABS.map((t) => t.label);
    expect(labels).not.toContain('Στόλος');
    expect(labels).not.toContain('Πελάτες');
    expect(labels).not.toContain('Κρατήσεις');
    expect(labels).not.toContain('Ημερολόγιο');
    expect(labels).toContain('Οχήματα ενοικίασης');
  });

  it('keeps bus Στόλος λεωφορείων separate from rent vehicles', () => {
    expect(ADMIN_NAV_ITEMS.fleet.label).toBe('Στόλος λεωφορείων');
    expect(ADMIN_NAV_ITEMS.fleet.icon).toBe('directions_bus');
    const rentVehicles = buildRentDeskNavItems().fleet_rental_vehicles;
    expect(rentVehicles.label).toBe('Οχήματα ενοικίασης');
    expect(rentVehicles.icon).toBe('directions_car');
    expect(rentVehicles.type).toBe('fleet_rental_subtab');
    expect(rentVehicles.tab).toBe('fleet_rental');
  });

  it('does not duplicate office Πληρωμές inside the rent desk nav', () => {
    expect(RENT_DESK_TABS.map((t) => t.id)).not.toContain('payments');
    expect(buildRentDeskNavItems().fleet_rental_payments).toBeUndefined();
  });

  it('wires Γραφείο desk items to stable tab ids', () => {
    const desk = RENT_DESK_TABS.filter((t) => t.group === 'desk');
    expect(desk.map((t) => t.id)).toEqual(['clients', 'bookings', 'paperwork', 'wizard']);
    expect(desk.map((t) => t.label)).toEqual([
      'Πελάτες ενοικιάσεων',
      'Κρατήσεις /rent',
      'Χαρτούρα',
      'Νέα κράτηση /rent',
    ]);
    for (const t of desk) {
      const nav = buildRentDeskNavItems()[`fleet_rental_${t.id}`];
      expect(nav.tab).toBe('fleet_rental');
      expect(nav.fleetRentalTab).toBe(t.id);
      expect(nav.type).toBe('fleet_rental_subtab');
    }
  });
});
