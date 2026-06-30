import { API_BASE } from '../config/api.js';
import { mockFleet } from '../data/mockData.js';

const AMENITY_DEFAULTS = {
  'Luxury Coach': [
    'Wi-Fi onboard',
    'USB & 220V',
    'Κλιματισμός',
    'Ανακλινόμενα leather seats',
    'WC onboard',
    'Mini bar',
  ],
  'Premium Express': [
    'Wi-Fi onboard',
    'USB θύρες',
    'Κλιματισμός',
    'Ανακλινόμενα καθίσματα',
    'Ψυγείο',
  ],
  Standard: [
    'Κλιματισμός',
    'USB θύρες',
    'Θέρμανση',
    'Μεγάλοι αποθηκευτικοί χώροι',
  ],
};

function mockPublicFleet() {
  return mockFleet
    .filter((b) => b.status === 'Ενεργό')
    .map((bus) => ({
      id: bus.id,
      name: bus.name,
      make: bus.name.split(' ')[0] || 'Coach',
      model: bus.type || 'Coach',
      category: bus.type,
      year: 2022,
      seat_count: bus.seats,
      amenities: AMENITY_DEFAULTS[bus.type] || AMENITY_DEFAULTS.Standard,
      summary: `${bus.engineType} · ${bus.fuelConsumption}`,
      image_url: '/images/hero-bus-achillio.png',
      status_label: 'Διαθέσιμο',
    }));
}

export async function fetchPublicFleet() {
  try {
    const res = await fetch(`${API_BASE}/api/site/fleet`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) return data;
    }
  } catch {
    /* offline */
  }
  return mockPublicFleet();
}

export const AMENITY_ICONS = {
  'Wi-Fi onboard': 'wifi',
  'Wi-Fi': 'wifi',
  'USB & 220V': 'electrical_services',
  'USB θύρες': 'usb',
  'Κλιματισμός': 'ac_unit',
  'Ανακλινόμενα leather seats': 'airline_seat_recline_extra',
  'Ανακλινόμενα καθίσματα': 'airline_seat_recline_extra',
  'WC onboard': 'wc',
  'Mini bar': 'local_bar',
  'Ψυγείο': 'kitchen',
  'Θέρμανση': 'mode_heat',
  'Μεγάλοι αποθηκευτικοί χώροι': 'luggage',
};

export function amenityIcon(label) {
  if (AMENITY_ICONS[label]) return AMENITY_ICONS[label];
  const lower = String(label).toLowerCase();
  if (lower.includes('wifi') || lower.includes('wi-fi')) return 'wifi';
  if (lower.includes('usb') || lower.includes('220')) return 'usb';
  if (lower.includes('κλιμα') || lower.includes('ac')) return 'ac_unit';
  if (lower.includes('wc')) return 'wc';
  if (lower.includes('bar') || lower.includes('ψυγ')) return 'local_bar';
  if (lower.includes('καθίσ')) return 'airline_seat_recline_extra';
  return 'check_circle';
}
