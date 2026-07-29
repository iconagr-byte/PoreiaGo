/**
 * Client-side demo rent fleet (3 cars + 3 vans).
 * Used when the public catalog API is empty/unreachable so storefront still looks real.
 */
export const DEMO_RENT_FLEET = [
  {
    id: 'demo-rent-car-yaris',
    category: 'CAR',
    model: 'Toyota Yaris',
    seating_capacity: 5,
    daily_rate_eur: 35,
    one_way_surcharge_eur: 25,
    with_driver_daily_eur: 80,
    photo_url:
      'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=80',
    description:
      'Συμπαγές και οικονομικό επιβατικό για καθημερινές διαδρομές, πάρκινγκ και κοντινές αποδράσεις. Εύκολο στην οδήγηση, με χαμηλή κατανάλωση και άνεση για έως 5 επιβάτες.',
  },
  {
    id: 'demo-rent-car-corolla',
    category: 'CAR',
    model: 'Toyota Corolla',
    seating_capacity: 5,
    daily_rate_eur: 48,
    one_way_surcharge_eur: 30,
    with_driver_daily_eur: 90,
    photo_url:
      'https://images.unsplash.com/photo-1623869675781-80aa31012a5a?auto=format&fit=crop&w=1200&q=80',
    description:
      'Άνετο οικογενειακό sedan με χώρο για αποσκευές και σταθερή οδήγηση στον αυτοκινητόδρομο. Ιδανικό για πολυήμερες διακοπές ή επαγγελματικά ταξίδια με άνεση και οικονομία.',
  },
  {
    id: 'demo-rent-car-tucson',
    category: 'CAR',
    model: 'Hyundai Tucson',
    seating_capacity: 5,
    daily_rate_eur: 65,
    one_way_surcharge_eur: 40,
    with_driver_daily_eur: 110,
    photo_url:
      'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80',
    description:
      'SUV με ψηλή ορατότητα, χώρο για οικοσκευή και άνεση σε μεγαλύτερες αποστάσεις. Κατάλληλο για οικογένειες, ορεινές διαδρομές και ταξίδια με περισσότερες αποσκευές.',
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
