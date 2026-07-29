/**
 * Marketing copy + display specs for rent fleet cards (guest + home).
 * Matches known demo models; falls back gracefully for custom vehicles.
 */

import { rentCategoryLabel } from './demoRentFleet.js';

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
    headline: 'Premium van',
    blurb:
      'Premium van για άνετες μετακινήσεις ομάδας ή VIP transfers. Ήσυχη καμπίνα, άνετα καθίσματα και παρουσία που ταιριάζει σε επαγγελματικές ή τουριστικές μετακινήσεις υψηλής στάθμης.',
    transmission: 'Αυτόματο',
    fuel: 'Ντίζελ',
    doors: 4,
    luggage: 'Μεγάλος χώρος φόρτωσης',
    highlights: ['Premium άνεση', '8 θέσεις', 'Ήσυχη καμπίνα'],
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

  return {
    ...v,
    category_label: category,
    display_headline: known?.headline || category || 'Όχημα',
    display_blurb: description,
    transmission: known?.transmission || '',
    fuel: known?.fuel || '',
    doors: known?.doors || null,
    luggage: known?.luggage || '',
    highlights: known?.highlights || [],
    seats_label: seats ? `${seats} θέσεις` : '',
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
    copy: 'Όρισε παραλαβή/επιστροφή στο γραφείο ή one-way — με ή χωρίς οδηγό.',
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
