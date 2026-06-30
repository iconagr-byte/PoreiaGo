/** Διαμορφώσεις θέσεων ανά τύπο οχήματος εκδρομής */

export const VEHICLE_LAYOUTS = {
  'Luxury Coach': {
    id: 'luxury-coach',
    label: 'Luxury Coach',
    tagline: '50 θέσεις',
    rows: 13,
    cols: ['A', 'B', 'C', 'D'],
    aisleAfter: 'B',
    vipRows: [1, 2],
  },
  'Premium Express': {
    id: 'premium-express',
    label: 'Premium Express',
    tagline: '30 θέσεις',
    rows: 8,
    cols: ['A', 'B', 'C', 'D'],
    aisleAfter: 'B',
    vipRows: [1],
  },
  'VIP Minibus': {
    id: 'vip-minibus',
    label: 'VIP Minibus',
    tagline: '15 θέσεις',
    rows: 5,
    cols: ['A', 'B', 'C'],
    aisleAfter: 'B',
    vipRows: [1],
  },
};

export function getLayoutForVehicle(vehicleType) {
  return VEHICLE_LAYOUTS[vehicleType] || VEHICLE_LAYOUTS['Luxury Coach'];
}
