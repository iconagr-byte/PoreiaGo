import { API_BASE } from '../config/api.js';

export async function fetchPublicFleet() {
  try {
    const host = typeof window !== 'undefined' ? window.location.host : '';
    const qs = host ? `?host=${encodeURIComponent(host)}` : '';
    const res = await fetch(`${API_BASE}/api/site/fleet${qs}`);
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch {
    /* offline / API down — show empty, never demo coaches */
  }
  return [];
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
