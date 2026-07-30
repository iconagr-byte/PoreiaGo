/**
 * Marketing copy + display specs for rent fleet cards (guest + home).
 * Matches known demo models; falls back gracefully for custom vehicles.
 */

import { DEMO_RENT_FLEET, rentCategoryLabel } from './demoRentFleet.js';

const DEMO_PHOTO_BY_MODEL = Object.fromEntries(
  DEMO_RENT_FLEET.map((v) => [String(v.model || '').trim().toLowerCase(), v.photo_url]),
);

/** @typedef {{
 *   headline: string,
 *   blurb: string,
 *   transmission: string,
 *   fuel: string,
 *   doors: number,
 *   luggage: string,
 *   highlights: string[],
 * }} RentFleetCopy */

/** @type {Record<string, RentFleetCopy>} */
const BY_MODEL = {
  'toyota aygo x': {
    headline: 'City crossover 2026',
    blurb:
      'Μοντέλο 2026 — μικρό city crossover, ιδανικό για πόλη και εύκολο πάρκινγκ. Οικονομικό, με κλιματισμό και άνεση για έως 4 επιβάτες.',
    transmission: 'Χειροκίνητο',
    fuel: 'Βενζίνη',
    doors: 5,
    luggage: '1 βαλίτσα',
    highlights: ['Εύκολο πάρκινγκ', 'Χαμηλή κατανάλωση', 'A/C'],
  },
  'peugeot 208': {
    headline: 'Συμπαγές hatchback 2026',
    blurb:
      'Μοντέλο 2026 — συμπαγές hatchback για καθημερινές διαδρομές και κοντινές αποδράσεις. Άνετη καμπίνα, κλιματισμός και χαμηλή κατανάλωση.',
    transmission: 'Χειροκίνητο',
    fuel: 'Βενζίνη',
    doors: 5,
    luggage: '2 βαλίτσες',
    highlights: ['A/C', 'Bluetooth', 'Οικονομικό'],
  },
  'renault clio': {
    headline: 'Ιδανικό για πόλη 2026',
    blurb:
      'Μοντέλο 2026 — συμπαγές και οικονομικό επιβατικό για καθημερινές διαδρομές, πάρκινγκ και κοντινές αποδράσεις. Εύκολο στην οδήγηση, με χαμηλή κατανάλωση και άνεση για έως 5 επιβάτες.',
    transmission: 'Χειροκίνητο',
    fuel: 'Βενζίνη',
    doors: 5,
    luggage: '2 βαλίτσες',
    highlights: ['Χαμηλή κατανάλωση', 'Εύκολο πάρκινγκ', 'A/C'],
  },
  'hyundai i10': {
    headline: 'City car',
    blurb:
      'Μικρό city car — ιδανικό για πόλη και εύκολο πάρκινγκ. Οικονομικό, με κλιματισμό και άνεση για έως 4 επιβάτες.',
    transmission: 'Χειροκίνητο',
    fuel: 'Βενζίνη',
    doors: 5,
    luggage: '2 βαλίτσες',
    highlights: ['Εύκολο πάρκινγκ', 'Χαμηλή κατανάλωση', 'A/C'],
  },
  'citroen c3': {
    headline: 'Συμπαγές hatchback',
    blurb:
      'Συμπαγές hatchback για καθημερινές διαδρομές και κοντινές αποδράσεις. Άνετη καμπίνα, κλιματισμός και χαμηλή κατανάλωση.',
    transmission: 'Χειροκίνητο',
    fuel: 'Βενζίνη',
    doors: 5,
    luggage: '2 βαλίτσες',
    highlights: ['A/C', 'Bluetooth', 'Οικονομικό'],
  },
  'toyota yaris': {
    headline: 'Ιδανικό για πόλη',
    blurb:
      'Συμπαγές και οικονομικό επιβατικό για καθημερινές διαδρομές, πάρκινγκ και κοντινές αποδράσεις. Εύκολο στην οδήγηση, με χαμηλή κατανάλωση και άνεση για έως 5 επιβάτες.',
    transmission: 'Χειροκίνητο',
    fuel: 'Βενζίνη',
    doors: 5,
    luggage: '2 βαλίτσες',
    highlights: ['Χαμηλή κατανάλωση', 'Εύκολο πάρκινγκ', 'A/C'],
  },
  'toyota corolla': {
    headline: 'Οικογενειακό sedan',
    blurb:
      'Άνετο οικογενειακό sedan με χώρο για αποσκευές και σταθερή οδήγηση στον αυτοκινητόδρομο. Ιδανικό για πολυήμερες διακοπές ή επαγγελματικά ταξίδια με άνεση και οικονομία.',
    transmission: 'Αυτόματο',
    fuel: 'Υβριδικό',
    doors: 4,
    luggage: '3 βαλίτσες',
    highlights: ['Υβριδική οικονομία', 'Άνεση ταξιδιού', 'Bluetooth'],
  },
  'hyundai tucson': {
    headline: 'SUV για αποδράσεις',
    blurb:
      'SUV με ψηλή ορατότητα, χώρο για οικοσκευή και άνεση σε μεγαλύτερες αποστάσεις. Κατάλληλο για οικογένειες, ορεινές διαδρομές και ταξίδια με περισσότερες αποσκευές.',
    transmission: 'Αυτόματο',
    fuel: 'Βενζίνη',
    doors: 5,
    luggage: '4 βαλίτσες',
    highlights: ['Υψηλή θέση οδήγησης', 'Μεγάλος χώρος', 'Cruise control'],
  },
  'vw multivan': {
    headline: 'Multivan 2026',
    blurb:
      'Μοντέλο 2026 — ευρύχωρο Multivan για οικογένειες, εκδρομές και μεταφορές με αποσκευές. Άνετη καμπίνα και χώρος για επιβάτες και εξοπλισμό.',
    transmission: 'Αυτόματο',
    fuel: 'Ντίζελ',
    doors: 5,
    luggage: '4 βαλίτσες',
    highlights: ['7 θέσεις', 'Οικογενειακό', 'Ευρύχωρο'],
  },
  'volkswagen multivan': {
    headline: 'Multivan 2026',
    blurb:
      'Μοντέλο 2026 — ευρύχωρο Multivan για οικογένειες, εκδρομές και μεταφορές με αποσκευές. Άνετη καμπίνα και χώρος για επιβάτες και εξοπλισμό.',
    transmission: 'Αυτόματο',
    fuel: 'Ντίζελ',
    doors: 5,
    luggage: '4 βαλίτσες',
    highlights: ['7 θέσεις', 'Οικογενειακό', 'Ευρύχωρο'],
  },
  'vw transporter': {
    headline: 'Van 9 θέσεων',
    blurb:
      'Ευρύχωρο van 9 θέσεων για ομάδες, εκδρομές και μεταφορές με αποσκευές. Σταθερό στον δρόμο, με χώρο για επιβάτες και εξοπλισμό — ιδανικό για τουριστικά ή εταιρικά γκρουπ.',
    transmission: 'Χειροκίνητο',
    fuel: 'Ντίζελ',
    doors: 4,
    luggage: 'Μεγάλος χώρος φόρτωσης',
    highlights: ['9 θέσεις', 'Ομαδικές μετακινήσεις', 'Ευρύχωρο'],
  },
  'mercedes vito': {
    headline: 'Premium van 2026',
    blurb:
      'Μοντέλο 2026 — premium van για άνετες μετακινήσεις ομάδας ή VIP transfers. Ήσυχη καμπίνα, άνετα καθίσματα και παρουσία που ταιριάζει σε επαγγελματικές ή τουριστικές μετακινήσεις υψηλής στάθμης.',
    transmission: 'Αυτόματο',
    fuel: 'Ντίζελ',
    doors: 4,
    luggage: 'Μεγάλος χώρος φόρτωσης',
    highlights: ['Premium άνεση', '8 θέσεις', 'Ήσυχη καμπίνα'],
  },
  'ford transit custom': {
    headline: 'Tour van 2026',
    blurb:
      'Μοντέλο 2026 — ευέλικτο van για τουρισμό και εταιρικές μετακινήσεις. Ισορροπία χώρου, οικονομίας και ευελιξίας — ιδανικό για αεροδρόμιο, ξενοδοχεία και ημερήσιες εκδρομές με ομάδα.',
    transmission: 'Χειροκίνητο',
    fuel: 'Ντίζελ',
    doors: 4,
    luggage: 'Μεγάλος χώρος φόρτωσης',
    highlights: ['9 θέσεις', 'Airport transfers', 'Οικονομικό van'],
  },
  'renault trafic': {
    headline: 'Ευέλικτο tour van',
    blurb:
      'Ευέλικτο van για τουρισμό και εταιρικές μετακινήσεις. Ισορροπία χώρου, οικονομίας και ευελιξίας — ιδανικό για αεροδρόμιο, ξενοδοχεία και ημερήσιες εκδρομές με ομάδα.',
    transmission: 'Χειροκίνητο',
    fuel: 'Ντίζελ',
    doors: 4,
    luggage: 'Μεγάλος χώρος φόρτωσης',
    highlights: ['9 θέσεις', 'Airport transfers', 'Οικονομικό van'],
  },
};

function modelKey(model) {
  return String(model || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function luggageCount(luggage) {
  const m = String(luggage || '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function sizeAndGroup(category, seats, model, known) {
  const cat = String(category || '').toUpperCase();
  const name = modelKey(model);
  if (cat === 'VAN' || cat === 'MINIBUS' || (seats && seats >= 8)) {
    return {
      group_code: cat === 'MINIBUS' ? 'Ομάδα M' : 'Ομάδα V',
      size_label: cat === 'MINIBUS' ? 'Minibus' : 'Van',
    };
  }
  if (name.includes('tucson') || known?.headline?.toLowerCase().includes('suv')) {
    return { group_code: 'Ομάδα D', size_label: 'SUV' };
  }
  if (seats && seats <= 4) {
    return { group_code: 'Ομάδα A', size_label: 'Μικρά' };
  }
  if (name.includes('corolla') || (seats && seats >= 5 && known?.doors === 4)) {
    return { group_code: 'Ομάδα C', size_label: 'Μεσαία' };
  }
  return { group_code: 'Ομάδα B', size_label: 'Συμπαγή' };
}

function transmissionLabel(raw) {
  const t = String(raw || '').trim();
  if (!t) return 'Με ταχύτητες';
  if (/αυτόματο|automatic/i.test(t)) return 'Αυτόματο';
  return 'Με ταχύτητες';
}

/**
 * @param {object} vehicle
 * @returns {object} vehicle + display enrichment fields
 */
export function enrichRentVehicle(vehicle) {
  const v = vehicle && typeof vehicle === 'object' ? vehicle : {};
  const known = BY_MODEL[modelKey(v.model)] || null;
  const seats = Number(v.seating_capacity) || null;
  const category = rentCategoryLabel(v.category);
  const description =
    (known && String(v.description || '').trim().length < 40 ? known.blurb : null) ||
    String(v.description || '').trim() ||
    known?.blurb ||
    `${category || 'Όχημα'} έτοιμο για ενοικίαση — κράτηση online σε λίγα βήματα.`;

  const fallbackPhoto = DEMO_PHOTO_BY_MODEL[modelKey(v.model)] || '';
  const rawPhoto = String(v.photo_url || v.photo_urls?.[0] || '').trim();
  // Prefer accurate model photo when catalog still has mismatched Unsplash stock.
  const photoUrl =
    fallbackPhoto && (!rawPhoto || /images\.unsplash\.com/i.test(rawPhoto))
      ? fallbackPhoto
      : rawPhoto || fallbackPhoto;
  const photoUrls = Array.isArray(v.photo_urls) && v.photo_urls.length && !/images\.unsplash\.com/i.test(rawPhoto)
    ? v.photo_urls
    : photoUrl
      ? [photoUrl]
      : [];

  const luggage = known?.luggage || '';
  const bags = luggageCount(luggage);
  const { group_code, size_label } = sizeAndGroup(v.category, seats, v.model, known);
  const transmission = transmissionLabel(known?.transmission);

  return {
    ...v,
    photo_url: photoUrl,
    photo_urls: photoUrls,
    category_label: category,
    display_headline: known?.headline || category || 'Όχημα',
    display_blurb: description,
    transmission,
    fuel: known?.fuel || '',
    doors: known?.doors || null,
    luggage,
    luggage_label: bags ? `x${bags}` : luggage || 'Αποσκευές',
    highlights: known?.highlights || [],
    seats_label: seats ? `${seats} επιβάτες` : '',
    group_code,
    size_label,
    ac_label: 'Με κλιματισμό',
    similar_label: 'ή παρόμοιο',
    price_label:
      v.daily_rate_eur != null && v.daily_rate_eur !== ''
        ? `από €${Number(v.daily_rate_eur).toFixed(0)}/ημέρα`
        : '',
  };
}

export function enrichRentFleet(vehicles) {
  return (Array.isArray(vehicles) ? vehicles : []).map(enrichRentVehicle);
}

export const RENT_HOME_STEPS = [
  {
    id: 'pick',
    icon: 'directions_car',
    title: 'Διάλεξε όχημα',
    copy: 'Επιβατικά και van με θέσεις, τιμή/ημέρα και περιγραφή — πριν συνδεθείς.',
  },
  {
    id: 'dates',
    icon: 'calendar_month',
    title: 'Ημερομηνίες & παραλαβή',
    copy: 'Όρισε ημερομηνίες και σημείο παραλαβής από τα σημεία του γραφείου — ίδια επιστροφή ή one-way.',
  },
  {
    id: 'wallet',
    icon: 'account_balance_wallet',
    title: 'Κράτηση στο Wallet',
    copy: 'Η κράτηση περνάει στο Rent Wallet με έγγραφα, SOS και οδική βοήθεια.',
  },
];

export const RENT_HOME_TRUST = [
  { icon: 'verified_user', label: 'Ασφάλεια CDW' },
  { icon: 'support_agent', label: 'Υποστήριξη γραφείου' },
  { icon: 'tire_repair', label: 'Οδική βοήθεια 24/7' },
  { icon: 'no_crash', label: 'Έλεγχος πριν την αναχώρηση' },
];

export function homeCategoryLabel(code) {
  if (!code) return 'Όλα';
  return rentCategoryLabel(code) || code;
}
