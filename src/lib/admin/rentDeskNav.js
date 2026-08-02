/**
 * Rent desk tabs — one BackOffice panel (`fleet_rental`) + hub card rail.
 * Labels stay distinct from bus left-nav (Στόλος, Πελάτες λεωφορείων, …).
 */

export const RENT_DESK_TABS = [
  {
    id: 'clients',
    label: 'Πελάτες /rent',
    icon: 'groups',
    description: 'CRM πελατών ενοικίασης',
    accent: 'teal',
    group: 'desk',
  },
  {
    id: 'bookings',
    label: 'Κρατήσεις /rent',
    icon: 'event_note',
    description: 'Λίστα & κατάσταση κρατήσεων',
    accent: 'teal',
    group: 'desk',
  },
  {
    id: 'paperwork',
    label: 'Χαρτούρα',
    icon: 'description',
    description: 'Συμβάσεις & υπογραφές',
    accent: 'emerald',
    group: 'desk',
  },
  {
    id: 'wizard',
    label: 'Νέα κράτηση /rent',
    icon: 'add_circle',
    description: 'Κράτηση από το γραφείο',
    accent: 'teal',
    group: 'desk',
  },
  {
    id: 'vehicles',
    label: 'Οχήματα ενοικίασης',
    icon: 'directions_car',
    description: 'Στόλος rent & κατηγορίες',
    accent: 'sky',
    group: 'fleet',
  },
  {
    id: 'availability',
    label: 'Διαθεσιμότητα /rent',
    icon: 'event_available',
    description: 'Ποια οχήματα δέχονται κράτηση',
    accent: 'emerald',
    group: 'fleet',
  },
  {
    id: 'calendar',
    label: 'Ημερολόγιο /rent',
    icon: 'calendar_month',
    description: 'Παραλαβές & επιστροφές',
    accent: 'sky',
    group: 'fleet',
  },
  {
    id: 'inspections',
    label: 'Check-in / out',
    icon: 'fact_check',
    description: 'Έλεγχος οχήματος',
    accent: 'amber',
    group: 'fleet',
  },
  {
    id: 'live_gps',
    label: 'GPS ενοικίασης',
    icon: 'my_location',
    description: 'Συσκευή στο όχημα',
    accent: 'sky',
    group: 'fleet',
  },
  {
    id: 'services',
    label: 'Υπηρεσίες',
    icon: 'health_and_safety',
    description: 'Extras & ασφάλειες',
    accent: 'violet',
    group: 'ops',
  },
  {
    id: 'pickups',
    label: 'Σημεία παραλαβής',
    icon: 'location_on',
    description: 'Τοποθεσίες παράδοσης',
    accent: 'emerald',
    group: 'ops',
  },
  {
    id: 'documents',
    label: 'Έγγραφα /rent',
    icon: 'folder_managed',
    description: 'Αρχεία οχημάτων & συμβάσεων',
    accent: 'slate',
    group: 'ops',
  },
  {
    id: 'expenses',
    label: 'Έξοδα /rent',
    icon: 'local_gas_station',
    description: 'Κόστη στόλου ενοικίασης',
    accent: 'amber',
    group: 'ops',
  },
  {
    id: 'notifications',
    label: 'Ειδοποιήσεις /rent',
    icon: 'notifications_active',
    description: 'Alerts & υπενθυμίσεις',
    accent: 'rose',
    group: 'ops',
  },
  {
    id: 'overview',
    label: 'Επισκόπηση /rent',
    icon: 'dashboard',
    description: 'Σύνοψη desk & KPIs',
    accent: 'teal',
    group: 'setup',
  },
  {
    id: 'branding',
    label: 'Εμφάνιση /rent',
    icon: 'palette',
    description: 'Hero, χρώματα & brand /rent',
    accent: 'violet',
    group: 'setup',
  },
  {
    id: 'plans',
    label: 'Κάρτες τιμών',
    icon: 'sell',
    description: 'Τιμοκατάλογοι & πακέτα',
    accent: 'amber',
    group: 'setup',
  },
];

export const RENT_DESK_GROUPS = [
  { id: 'desk', label: 'Γραφείο' },
  { id: 'fleet', label: 'Στόλος rent' },
  { id: 'ops', label: 'Λειτουργίες' },
  { id: 'setup', label: 'Ρύθμιση' },
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
        accent: t.accent || 'teal',
      },
    ]),
  );
}
