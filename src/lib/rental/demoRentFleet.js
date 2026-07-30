/**
 * Client-side demo rent fleet (Hertz-like pick cards: compact cars + vans).
 * Used when the public catalog API is empty/unreachable so storefront still looks real.
 */
export const DEMO_RENT_FLEET = [
  {
    id: 'demo-rent-car-i10',
    category: 'CAR',
    model: 'Hyundai i10',
    seating_capacity: 4,
    daily_rate_eur: 32,
    one_way_surcharge_eur: 25,
    with_driver_daily_eur: 80,
    photo_url:
      'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80',
    description:
      'Μικρό city car — ιδανικό για πόλη και εύκολο πάρκινγκ. Οικονομικό, με κλιματισμό και άνεση για έως 4 επιβάτες.',
  },
  {
    id: 'demo-rent-car-c3',
    category: 'CAR',
    model: 'Citroen C3',
    seating_capacity: 5,
    daily_rate_eur: 38,
    one_way_surcharge_eur: 28,
    with_driver_daily_eur: 85,
    photo_url:
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80',
    description:
      'Συμπαγές hatchback για καθημερινές διαδρομές και κοντινές αποδράσεις. Άνετη καμπίνα, κλιματισμός και χαμηλή κατανάλωση.',
  },
  {
    id: 'demo-rent-car-yaris',
    category: 'CAR',
    model: 'Toyota Yaris',
    seating_capacity: 5,
    daily_rate_eur: 42,
    one_way_surcharge_eur: 30,
    with_driver_daily_eur: 90,
    photo_url:
      'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=80',
    description:
      'Συμπαγές και οικονομικό επιβατικό για καθημερινές διαδρομές, πάρκινγκ και κοντινές αποδράσεις. Εύκολο στην οδήγηση, με χαμηλή κατανάλωση και άνεση για έως 5 επιβάτες.',
  },
  {
    id: 'demo-rent-van-transporter',
    category: 'VAN',
    model: 'VW Transporter',
    seating_capacity: 9,
    daily_rate_eur: 95,
    one_way_surcharge_eur: 50,
    with_driver_daily_eur: 140,
    photo_url:
      'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1200&q=80',
    description:
      'Ευρύχωρο van 9 θέσεων για ομάδες, εκδρομές και μεταφορές με αποσκευές. Σταθερό στον δρόμο, με χώρο για επιβάτες και εξοπλισμό — ιδανικό για τουριστικά ή εταιρικά γκρουπ.',
  },
  {
    id: 'demo-rent-van-vito',
    category: 'VAN',
    model: 'Mercedes Vito',
    seating_capacity: 8,
    daily_rate_eur: 110,
    one_way_surcharge_eur: 55,
    with_driver_daily_eur: 150,
    photo_url:
      'https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=1200&q=80',
    description:
      'Premium van για άνετες μετακινήσεις ομάδας ή VIP transfers. Ήσυχη καμπίνα, άνετα καθίσματα και παρουσία που ταιριάζει σε επαγγελματικές ή τουριστικές μετακινήσεις υψηλής στάθμης.',
  },
  {
    id: 'demo-rent-van-trafic',
    category: 'VAN',
    model: 'Renault Trafic',
    seating_capacity: 9,
    daily_rate_eur: 88,
    one_way_surcharge_eur: 45,
    with_driver_daily_eur: 130,
    photo_url:
      'https://images.unsplash.com/photo-1544620341-1adc1baa16c2?auto=format&fit=crop&w=1200&q=80',
    description:
      'Ευέλικτο van για τουρισμό και εταιρικές μετακινήσεις. Ισορροπία χώρου, οικονομίας και ευελιξίας — ιδανικό για αεροδρόμιο, ξενοδοχεία και ημερήσιες εκδρομές με ομάδα.',
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
