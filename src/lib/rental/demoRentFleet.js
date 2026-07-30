/**
 * Client-side demo rent fleet (compact cars + vans).
 * 2025–2026 generation models with matching Wikimedia Commons exterior photos.
 * Used when the public catalog API is empty/unreachable so storefront still looks real.
 */

const WM = (path) =>
  `https://upload.wikimedia.org/wikipedia/commons/${path}`;

export const DEMO_RENT_FLEET = [
  {
    id: 'demo-rent-car-i10',
    category: 'CAR',
    model: 'Toyota Aygo X',
    seating_capacity: 4,
    daily_rate_eur: 32,
    one_way_surcharge_eur: 25,
    with_driver_daily_eur: 80,
    photo_url: WM('thumb/a/a2/Toyota_Aygo_X_1X7A0063.jpg/1280px-Toyota_Aygo_X_1X7A0063.jpg'),
    description:
      'Μοντέλο 2026 — μικρό city crossover, ιδανικό για πόλη και εύκολο πάρκινγκ. Οικονομικό, με κλιματισμό και άνεση για έως 4 επιβάτες.',
  },
  {
    id: 'demo-rent-car-c3',
    category: 'CAR',
    model: 'Peugeot 208',
    seating_capacity: 5,
    daily_rate_eur: 38,
    one_way_surcharge_eur: 28,
    with_driver_daily_eur: 85,
    photo_url: WM(
      'thumb/d/d8/Peugeot_208_B_facelift_DSC_7227.jpg/1280px-Peugeot_208_B_facelift_DSC_7227.jpg',
    ),
    description:
      'Μοντέλο 2026 — συμπαγές hatchback για καθημερινές διαδρομές και κοντινές αποδράσεις. Άνετη καμπίνα, κλιματισμός και χαμηλή κατανάλωση.',
  },
  {
    id: 'demo-rent-car-yaris',
    category: 'CAR',
    model: 'Renault Clio',
    seating_capacity: 5,
    daily_rate_eur: 42,
    one_way_surcharge_eur: 30,
    with_driver_daily_eur: 90,
    photo_url: WM(
      'thumb/c/c6/Renault_Clio_V_%282023%29_1X7A1577.jpg/1280px-Renault_Clio_V_%282023%29_1X7A1577.jpg',
    ),
    description:
      'Μοντέλο 2026 — συμπαγές και οικονομικό επιβατικό για καθημερινές διαδρομές, πάρκινγκ και κοντινές αποδράσεις. Εύκολο στην οδήγηση, με χαμηλή κατανάλωση και άνεση για έως 5 επιβάτες.',
  },
  {
    id: 'demo-rent-van-transporter',
    category: 'VAN',
    model: 'VW Multivan',
    seating_capacity: 7,
    daily_rate_eur: 95,
    one_way_surcharge_eur: 50,
    with_driver_daily_eur: 140,
    photo_url: WM(
      'thumb/c/c5/Volkswagen_T7_Multivan_1X7A0297.jpg/1280px-Volkswagen_T7_Multivan_1X7A0297.jpg',
    ),
    description:
      'Μοντέλο 2026 — ευρύχωρο Multivan για οικογένειες, εκδρομές και μεταφορές με αποσκευές. Άνετη καμπίνα και χώρος για επιβάτες και εξοπλισμό.',
  },
  {
    id: 'demo-rent-van-vito',
    category: 'VAN',
    model: 'Mercedes Vito',
    seating_capacity: 8,
    daily_rate_eur: 110,
    one_way_surcharge_eur: 55,
    with_driver_daily_eur: 150,
    photo_url: WM(
      'thumb/5/5c/MERCEDES-BENZ_VITO_%28W447%29_China.jpg/1280px-MERCEDES-BENZ_VITO_%28W447%29_China.jpg',
    ),
    description:
      'Μοντέλο 2026 — premium van για άνετες μετακινήσεις ομάδας ή VIP transfers. Ήσυχη καμπίνα, άνετα καθίσματα και παρουσία που ταιριάζει σε επαγγελματικές ή τουριστικές μετακινήσεις υψηλής στάθμης.',
  },
  {
    id: 'demo-rent-van-trafic',
    category: 'VAN',
    model: 'Ford Transit Custom',
    seating_capacity: 9,
    daily_rate_eur: 88,
    one_way_surcharge_eur: 45,
    with_driver_daily_eur: 130,
    photo_url: WM(
      'thumb/e/e4/Ford_Transit_Custom_%282023%29_1X7A1605.jpg/1280px-Ford_Transit_Custom_%282023%29_1X7A1605.jpg',
    ),
    description:
      'Μοντέλο 2026 — ευέλικτο van για τουρισμό και εταιρικές μετακινήσεις. Ισορροπία χώρου, οικονομίας και ευελιξίας — ιδανικό για αεροδρόμιο, ξενοδοχεία και ημερήσιες εκδρομές με ομάδα.',
  },
];

export function rentCategoryLabel(category) {
  const c = String(category || '').toUpperCase();
  if (c === 'VAN') return 'Van';
  if (c === 'MINIBUS') return 'Minibus';
  if (c === 'CAR') return 'Επιβατικό';
  return category || '';
}

export function withDemoRentFleet(vehicles) {
  if (Array.isArray(vehicles) && vehicles.length > 0) return vehicles;
  return DEMO_RENT_FLEET;
}

/** True when fleet is the client-only showcase fallback (not office store). */
export function isClientDemoFleetId(id) {
  return /^demo-rent-(car|van)-/i.test(String(id || ''));
}
