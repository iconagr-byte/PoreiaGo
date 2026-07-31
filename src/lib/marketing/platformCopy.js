/** B2B landing copy — πλατφόρμα για ταξιδιωτικά γραφεία (όχι brand ενός γραφείου). */

export const PLATFORM_NAME = 'PoreiaGo';
export const PLATFORM_TAGLINE = 'Η πλατφόρμα που τρέχει το ταξιδιωτικό σας γραφείο';

export const HERO = {
  title: 'Μία πλατφόρμα για',
  titleAccent: 'όλο το ταξιδιωτικό σας γραφείο',
  subtitle:
    'Κρατήσεις, QR εισιτήρια, ζωντανό GPS, ενοικιάσεις οχημάτων, καμπάνιες email, χρεώσεις και πίνακας ελέγχου — χωρίς Excel, χωρίς 5 διαφορετικά εργαλεία. ' +
    'Το γραφείο σας με δική του επωνυμία, δικό του ιστότοπο και δικό του συμβόλαιο.',
};

/** Hero background — πλήρες cover, χωρίς demo εκδρομή */
export const HERO_BACKGROUND_IMAGE =
  'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?auto=format&fit=crop&w=2000&q=85';

/** Features section background — Aegean coastal dusk (local asset) */
export const FEATURES_BACKGROUND_IMAGE = '/images/platform-features-aegean.png';

/** Έτοιμα πρότυπα email καμπάνιας στο panel (Horizon Ethos / Stitch) */
import { STITCH_CAMPAIGN_TEMPLATES } from '../email/stitchTemplates.js';
export const CAMPAIGN_TEMPLATE_COUNT = STITCH_CAMPAIGN_TEMPLATES.length;

export const STATS = [
  { value: '1 πίνακας', label: 'Αντί για 5+ εργαλεία' },
  { value: 'Ζωντανό GPS', label: 'Στόλος σε πραγματικό χρόνο' },
  { value: 'Ενοικιάσεις', label: 'Αυτόνομο ή πρόσθετο' },
  { value: `${CAMPAIGN_TEMPLATE_COUNT}+`, label: 'Έτοιμα πρότυπα email' },
];

export const FEATURES = [
  {
    id: 'email',
    icon: 'campaign',
    accent: 'violet',
    visual: 'email',
    title: 'Καμπάνιες email & έτοιμα πρότυπα',
    body: `${CAMPAIGN_TEMPLATE_COUNT} σχεδιασμένα πρότυπα (προσφορές, εκδρομές, πακέτα, κύκλος ζωής πελάτη) — επιλέγετε, προσαρμόζετε το brand και στέλνετε σε λίστες πελατών.`,
    hook: 'Ενημερωτικά & προσφορές χωρίς σχεδιαστή ή εξωτερικό εργαλείο',
  },
  {
    id: 'bookings',
    icon: 'confirmation_number',
    accent: 'sky',
    visual: 'qr',
    title: 'Online κρατήσεις & QR',
    body: 'Ο πελάτης κλείνει θέση online. Ο οδηγός σκανάρει QR — χωρίς χαρτί, χωρίς λίστες στο χέρι.',
    hook: 'Λιγότερες ακυρώσεις, γρηγορότερο check-in',
  },
  {
    id: 'gps',
    icon: 'map',
    accent: 'emerald',
    visual: 'gps',
    title: 'Ζωντανό GPS & τηλεματική',
    body: 'Βλέπετε όλο τον στόλο σε χάρτη, εκτιμώμενη άφιξη για επιβάτες, ειδοποιήσεις ζώνης και ιστορικό διαδρομών.',
    hook: 'Ο πελάτης εμπιστεύεται — εσείς ελέγχετε',
  },
  {
    id: 'panel',
    icon: 'dashboard',
    accent: 'indigo',
    visual: 'panel',
    title: 'Πίνακας ελέγχου για το γραφείο',
    body: 'Εκδρομές, πελάτες, στόλος, καμπάνιες email, απωλεσθέντα — όλα σε ένα πίσω γραφείο.',
    hook: 'Η ομάδα σας δουλεύει από ένα σημείο',
  },
  {
    id: 'rent',
    icon: 'car_rental',
    accent: 'teal',
    visual: 'rent',
    title: 'Ενοικιάσεις οχημάτων',
    body: 'Ξεχωριστό συμβόλαιο ή πρόσθετο: εφαρμογή ενοικιάσεων, SOS, οδική βοήθεια 24/7, ασφάλειες, κοινή χρήση διαδρομής και λίστα ελέγχου — για πελάτες που νοικιάζουν.',
    hook: 'Ίδια πλατφόρμα · ξεχωριστή υπηρεσία & τιμολόγηση',
  },
  {
    id: 'billing',
    icon: 'payments',
    accent: 'amber',
    visual: 'billing',
    title: 'Συμβόλαιο μηνιαίο ή ετήσιο',
    body: 'Ηλεκτρονικές χρεώσεις με μέτρηση χρήσης για λεωφορεία & εκδρομές. Επιλέγετε πλάνο — ξεκινάτε σε λίγα λεπτά.',
    hook: 'Προβλέψιμο κόστος, κλιμάκωση χωρίς πόνο',
  },
  {
    id: 'brand',
    icon: 'palette',
    accent: 'rose',
    visual: 'brand',
    title: 'Δική σας βιτρίνα με το brand σας',
    body: 'Το δικό σας λογότυπο, χρώματα και αρχική σελίδα. Ο επιβάτης βλέπει το brand σας — όχι γενική πύλη.',
    hook: 'Επαγγελματική εικόνα από την πρώτη μέρα',
  },
];

export const STEPS = [
  {
    step: '01',
    title: 'Επιλέγετε συμβόλαιο',
    body: 'Μηνιαίο ή ετήσιο · Starter, Professional, Enterprise ή μόνο Ενοικιάσεις.',
  },
  {
    step: '02',
    title: 'Ρυθμίζετε το γραφείο',
    body: 'Εμφάνιση brand, εκδρομές, στόλος, οδηγοί, καμπάνιες — μέσα σε ώρες, όχι μήνες.',
  },
  {
    step: '03',
    title: 'Πουλάτε & εκτελείτε',
    body: 'Οι πελάτες κλείνουν online · εσείς διαχειρίζεστε από τον πίνακα ελέγχου.',
  },
];

export const AUDIENCE_HOOKS = [
  {
    text: 'Έχετε ήδη site αλλά κρατήσεις στο τηλέφωνο;',
    icon: 'language',
    accent: 'violet',
  },
  {
    text: 'Χρησιμοποιείτε Excel για εκδρομές και λίστες επιβατών;',
    icon: 'table_chart',
    accent: 'sky',
  },
  {
    text: 'Θέλετε GPS χωρίς ξεχωριστό συνδρομητικό;',
    icon: 'my_location',
    accent: 'emerald',
  },
  {
    text: 'Στέλνετε ενημερωτικά με αντιγραφή από Word ή χωρίς πρότυπα;',
    icon: 'campaign',
    accent: 'amber',
  },
  {
    text: 'Χρειάζεστε εργαλεία έτοιμα για προστασία δεδομένων πελατών;',
    icon: 'verified_user',
    accent: 'indigo',
  },
  {
    text: 'Θέλετε και ενοικιάσεις οχημάτων δίπλα στα λεωφορεία;',
    icon: 'car_rental',
    accent: 'emerald',
  },
];
