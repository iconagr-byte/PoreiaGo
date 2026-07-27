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
    photo_url:
      'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=80',
    description: 'Οικονομικό επιβατικό για πόλη και κοντινές αποδράσεις.',
  },
  {
    id: 'demo-rent-car-corolla',
    category: 'CAR',
    model: 'Toyota Corolla',
    seating_capacity: 5,
    daily_rate_eur: 48,
    photo_url:
      'https://images.unsplash.com/photo-1623869675781-80aa31012a5a?auto=format&fit=crop&w=1200&q=80',
    description: 'Άνετο οικογενειακό sedan με χαμηλή κατανάλωση.',
  },
  {
    id: 'demo-rent-car-tucson',
    category: 'CAR',
    model: 'Hyundai Tucson',
    seating_capacity: 5,
    daily_rate_eur: 65,
    photo_url:
      'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80',
    description: 'SUV επιβατικό για μεγαλύτερα ταξίδια και αποσκευές.',
  },
  {
    id: 'demo-rent-van-transporter',
    category: 'VAN',
    model: 'VW Transporter',
    seating_capacity: 9,
    daily_rate_eur: 95,
    photo_url:
      'https://images.unsplash.com/photo-1527786356903-a4b4c4f0ad83?auto=format&fit=crop&w=1200&q=80',
    description: 'Van 9 θέσεων για ομάδες και μεταφορές.',
  },
  {
    id: 'demo-rent-van-vito',
    category: 'VAN',
    model: 'Mercedes Vito',
    seating_capacity: 8,
    daily_rate_eur: 110,
    photo_url:
      'https://images.unsplash.com/photo-1464219789935-c2d9d9aba644?auto=format&fit=crop&w=1200&q=80',
    description: 'Premium van για άνετες μετακινήσεις ομάδας.',
  },
  {
    id: 'demo-rent-van-trafic',
    category: 'VAN',
    model: 'Renault Trafic',
    seating_capacity: 9,
    daily_rate_eur: 88,
    photo_url:
      'https://images.unsplash.com/photo-1544620341-1adc1baa16c2?auto=format&fit=crop&w=1200&q=80',
    description: 'Ευέλικτο van για τουρισμό και εταιρικές μετακινήσεις.',
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
