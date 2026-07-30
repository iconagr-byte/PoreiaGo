/**
 * Rent desk tabs surfaced in the main PoreiaGo sidebar under «Ενοικιάσεις».
 * One BackOffice panel (`fleet_rental`) + controlled sub-tab.
 */

/**
 * Labels must stay distinct from bus left-nav (Στόλος λεωφορείων, Πελάτες,
 * Κρατήσεις, Ημερολόγιο στόλου) — always read as Rent desk items.
 */
export const RENT_DESK_TABS = [
  { id: 'clients', label: 'Πελάτες /rent', icon: 'groups' },
  { id: 'bookings', label: 'Κρατήσεις /rent', icon: 'event_note' },
  { id: 'paperwork', label: 'Χαρτούρα', icon: 'description' },
  { id: 'services', label: 'Υπηρεσίες', icon: 'health_and_safety' },
  { id: 'notifications', label: 'Ειδοποιήσεις /rent', icon: 'notifications_active' },
  { id: 'pickups', label: 'Σημεία παραλαβής', icon: 'location_on' },
  { id: 'branding', label: 'Εμφάνιση /rent', icon: 'palette' },
  { id: 'overview', label: 'Επισκόπηση /rent', icon: 'dashboard' },
  { id: 'vehicles', label: 'Οχήματα ενοικίασης', icon: 'directions_car' },
  { id: 'wizard', label: 'Νέα κράτηση /rent', icon: 'add_circle' },
  { id: 'calendar', label: 'Ημερολόγιο /rent', icon: 'calendar_month' },
  { id: 'inspections', label: 'Check-in / out', icon: 'fact_check' },
  { id: 'live_gps', label: 'GPS ενοικίασης', icon: 'my_location' },
  { id: 'plans', label: 'Κάρτες τιμών', icon: 'sell' },
];

export const DEFAULT_RENT_DESK_TAB = 'clients';

export const RENT_DESK_TAB_IDS = RENT_DESK_TABS.map((t) => t.id);

/** Sidebar nav ids: fleet_rental_clients, … */
export const RENT_DESK_NAV_IDS = RENT_DESK_TABS.map((t) => `fleet_rental_${t.id}`);

export function rentDeskNavId(tabId) {
  return `fleet_rental_${tabId}`;
}

export function sanitizeRentDeskTab(tabId) {
  if (typeof tabId === 'string' && RENT_DESK_TAB_IDS.includes(tabId)) return tabId;
  return DEFAULT_RENT_DESK_TAB;
}

export function rentDeskTabFromNavId(navId) {
  if (typeof navId !== 'string' || !navId.startsWith('fleet_rental_')) return null;
  return sanitizeRentDeskTab(navId.slice('fleet_rental_'.length));
}

export function buildRentDeskNavItems() {
  return Object.fromEntries(
    RENT_DESK_TABS.map((t) => [
      rentDeskNavId(t.id),
      {
        id: rentDeskNavId(t.id),
        label: t.label,
        icon: t.icon,
        filled: true,
        type: 'fleet_rental_subtab',
        tab: 'fleet_rental',
        fleetRentalTab: t.id,
        navGroup: 'rent',
        accent: 'teal',
      },
    ]),
  );
}
