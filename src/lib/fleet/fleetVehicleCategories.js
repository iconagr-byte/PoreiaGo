/** Fleet bus categories — stable English ids, Greek UI labels. */

export const FLEET_VEHICLE_CATEGORIES = [
  {
    id: 'Luxury Coach',
    label: 'Πολυτελές λεωφορείο',
    shortLabel: 'Πολυτελές',
    seats: 50,
    icon: 'directions_bus',
  },
  {
    id: 'Premium Express',
    label: 'Εξπρές πολυτελείας',
    shortLabel: 'Εξπρές',
    seats: 32,
    icon: 'directions_bus',
  },
  {
    id: 'Standard',
    label: 'Κλασικό λεωφορείο',
    shortLabel: 'Κλασικό',
    seats: 55,
    icon: 'directions_bus',
  },
  {
    id: 'Van',
    label: 'Μικρό λεωφορείο / van',
    shortLabel: 'Μικρό / van',
    seats: 9,
    icon: 'airport_shuttle',
  },
];

const LABEL_BY_ID = Object.fromEntries(
  FLEET_VEHICLE_CATEGORIES.map((c) => [c.id, c.label]),
);

/** @param {string | null | undefined} categoryId */
export function fleetCategoryLabel(categoryId) {
  if (!categoryId) return '—';
  return LABEL_BY_ID[categoryId] || String(categoryId);
}

export function fleetCategoryMeta(categoryId) {
  return (
    FLEET_VEHICLE_CATEGORIES.find((c) => c.id === categoryId) ||
    FLEET_VEHICLE_CATEGORIES[2]
  );
}
