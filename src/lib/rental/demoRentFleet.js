/**
 * Rent fleet category labels (shared by storefront + enrichment).
 * Demo showcase fleet was removed — offices show only real vehicles.
 */

export function rentCategoryLabel(category) {
  const c = String(category || '').toUpperCase();
  if (c === 'VAN') return 'Van';
  if (c === 'MINIBUS') return 'Minibus';
  if (c === 'CAR') return 'Επιβατικό';
  return category || '';
}

/** @deprecated No-op — demo rent fleet removed. */
export function withDemoRentFleet(vehicles) {
  return Array.isArray(vehicles) ? vehicles : [];
}

/** @deprecated Demo fleet ids are no longer injected. */
export function isClientDemoFleetId() {
  return false;
}
