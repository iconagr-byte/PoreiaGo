/**
 * Sidebar service zones — buses vs shared vs rent.
 * Used by SortableSidebarNav mode switch + dual-scope badges.
 */

export const NAV_SERVICE_MODE_KEY = 'poreiago_admin_nav_service_mode_v1';

/** Items that apply to both buses and rentals. */
export const SHARED_NAV_IDS = new Set([
  'dashboard',
  'loyalty',
  'fleet_live_map',
  'email',
  'email_templates',
]);

/** Bus / trips-only left-nav ids (plus fleet-ops hub). */
export const BUS_NAV_IDS = new Set([
  'customers',
  'routes',
  'fleet',
  'drivers',
  'bus_setup',
  'lost_found',
  'bookings',
  'driver_scan',
  'fleet_ops',
  'fleet_kpis',
  'driver_chat',
  'fleet_route_playback',
  'fleet_calendar',
  'fleet_availability',
  'fleet_documents',
  'fleet_expenses',
  'fleet_digest',
]);

export const NAV_SERVICE_MODES = [
  {
    id: 'all',
    label: 'Όλα',
    short: 'Όλα',
    icon: 'widgets',
    hint: 'Εκδρομές + Ενοικιάσεις',
  },
  {
    id: 'buses',
    label: 'Εκδρομές',
    short: 'Εκδ.',
    icon: 'directions_bus',
    hint: 'Στόλος, GPS και κρατήσεις',
  },
  {
    id: 'rent',
    label: 'Ενοικιάσεις',
    short: 'Rent',
    icon: 'directions_car',
    hint: 'Υπηρεσία ενοικίασης',
  },
];

export function normalizeNavServiceMode(raw) {
  const id = String(raw || '').trim();
  if (id === 'buses' || id === 'rent' || id === 'all') return id;
  return 'all';
}

export function loadNavServiceMode() {
  try {
    return normalizeNavServiceMode(localStorage.getItem(NAV_SERVICE_MODE_KEY));
  } catch {
    return 'all';
  }
}

export function saveNavServiceMode(mode) {
  try {
    localStorage.setItem(NAV_SERVICE_MODE_KEY, normalizeNavServiceMode(mode));
  } catch {
    /* ignore */
  }
}

export function navItemServiceScope(itemOrId) {
  const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
  if (!id) return 'buses';
  if (id === 'fleet_rental' || String(id).startsWith('fleet_rental_')) return 'rent';
  if (id === 'settings' || String(id).startsWith('settings_')) return 'shared';
  if (SHARED_NAV_IDS.has(id)) return 'shared';
  if (BUS_NAV_IDS.has(id)) return 'buses';
  // Custom / unknown items in main list → treat as bus ops by default.
  return 'buses';
}

export function isSharedNavItem(itemOrId) {
  return navItemServiceScope(itemOrId) === 'shared';
}

export function isBusNavItem(itemOrId) {
  return navItemServiceScope(itemOrId) === 'buses';
}

export function isRentNavItem(itemOrId) {
  return navItemServiceScope(itemOrId) === 'rent';
}

/** Whether an item should appear for the current service mode. */
export function navItemVisibleInServiceMode(itemOrId, mode) {
  const m = normalizeNavServiceMode(mode);
  if (m === 'all') return true;
  const scope = navItemServiceScope(itemOrId);
  if (scope === 'shared') return true;
  if (m === 'buses') return scope === 'buses';
  if (m === 'rent') return scope === 'rent';
  return true;
}

/**
 * If current tab is hidden by the new mode, suggest a landing tab.
 * @returns {string|null} tab id to switch to, or null if ok
 */
export function suggestTabForServiceMode(activeTab, mode, { rentEnabled = true } = {}) {
  const m = normalizeNavServiceMode(mode);
  if (m === 'all') return null;
  if (!activeTab) return null;

  if (m === 'rent') {
    if (activeTab === 'fleet_rental' || activeTab === 'settings' || activeTab === 'email') {
      return null;
    }
    if (SHARED_NAV_IDS.has(activeTab)) return null;
    return rentEnabled ? 'fleet_rental' : 'dashboard';
  }

  if (m === 'buses') {
    if (activeTab === 'fleet_rental' || String(activeTab).startsWith('fleet_rental')) {
      return 'dashboard';
    }
    return null;
  }

  return null;
}
