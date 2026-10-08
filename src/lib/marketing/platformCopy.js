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

/** Homepage hub — δύο πόρτες (λεωφορεία / ενοικιάσεις), όχι κατευθείαν στα buses. */
export const SERVICE_HUB = {
  headline: 'Επιλέξτε υπηρεσία',
  support: 'Εκδρομές με λεωφορεία ή ενοικιάσεις οχημάτων — ίδια πλατφόρμα, δύο ξεχωριστές πόρτες.',
  busesLabel: 'Εκδρομές & λεωφορεία',
  busesHint: 'Κρατήσεις · GPS · στόλος',
  rentLabel: 'Ενοικιάσεις',
  rentHint: 'Αυτοκίνητα · βοήθεια · συμβόλαιο',
};

/** Below-hub sessions — ένα καθαρό block ανά υπηρεσία. */
export const BUSES_SESSION = {
  id: 'session-buses',
  kicker: 'Λεωφορεία',
  hook: 'Από την κράτηση μέχρι το GPS — όλη η εκδρομή σε μία ροή',
  support:
    'Ο πελάτης κλείνει θέση online με QR. Εσείς βλέπετε στόλο, πληρότητα και ζωντανή διαδρομή — χωρίς Excel και χωρίς τηλέφωνα την ώρα της αναχώρησης.',
  points: [
    { icon: 'confirmation_number', label: 'Online κράτηση & QR εισιτήριο' },
    { icon: 'map', label: 'Ζωντανό GPS στο λεωφορείο' },
    { icon: 'event_seat', label: 'Θέσεις & πληρότητα σε πραγματικό χρόνο' },
  ],
  ctaLabel: 'Δείτε εκδρομές & στόλο',
  ctaHref: '#platform-trips',
};

export const RENT_SESSION = {
  id: 'session-rent',
  kicker: 'Ενοικιάσεις',
  hook: 'Νοίκιασε αυτοκίνητο όπως κλείνεις εκδρομή — καθαρά, με ασφάλεια και οδική βοήθεια',
  support:
    'Ξεχωριστή πόρτα για ενοικιάσεις: στόλος, ημερομηνίες, ασφάλειες και ψηφιακή υπογραφή. Μπορεί να είναι add-on στο πλάνο λεωφορείων ή αυτόνομο συμβόλαιο.',
  points: [
    { icon: 'health_and_safety', label: 'Οδική βοήθεια 24/7' },
    { icon: 'shield', label: 'CDW / SCDW πριν την υπογραφή' },
    { icon: 'draw', label: 'Ψηφιακό συμβόλαιο & checklist' },
  ],
  ctaLabel: 'Άνοιγμα σελίδας ενοικιάσεων',
  ctaTo: '/rent',
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

/** Feature grid — still used where a flat list is needed. */
export const FEATURES = [
  {
    id: 'bookings',
    icon: 'confirmation_number',
    accent: 'sky',
    visual: 'qr',
    lane: 'buses',
    title: 'Online κρατήσεις & QR',
    body: 'Ο πελάτης κλείνει θέση online. Ο οδηγός σκανάρει QR — χωρίς χαρτί, χωρίς λίστες στο χέρι.',
    hook: 'Γρηγορότερο check-in στην αναχώρηση',
  },
  {
    id: 'gps',
    icon: 'map',
    accent: 'sky',
    visual: 'gps',
    lane: 'buses',
    title: 'Ζωντανό GPS λεωφορείου',
    body: 'Στόλος στον χάρτη, εκτιμώμενη άφιξη, ειδοποιήσεις ζώνης και ιστορικό διαδρομών.',
    hook: 'Ελέγχετε τη διαδρομή σε πραγματικό χρόνο',
  },
  {
    id: 'fleet',
    icon: 'directions_bus',
    accent: 'sky',
    visual: 'panel',
    lane: 'buses',
    title: 'Στόλος & θέσεις',
    body: 'Λεωφορεία, πληρότητα και εκδρομές στο ίδιο πίσω γραφείο — έτοιμα για το site σας.',
    hook: 'Λιγότερα τηλέφωνα την ώρα της αναχώρησης',
  },
  {
    id: 'rent',
    icon: 'car_rental',
    accent: 'teal',
    visual: 'rent',
    lane: 'rent',
    title: 'Σελίδα ενοικιάσεων',
    body: 'Ξεχωριστή πόρτα /rent: στόλος αυτοκινήτων, ημερομηνίες, τιμές — χωρίς να μπερδεύεται με τις εκδρομές.',
    hook: 'Ίδια πλατφόρμα · ξεχωριστή εμπειρία πελάτη',
  },
  {
    id: 'rent-safety',
    icon: 'health_and_safety',
    accent: 'teal',
    visual: 'gps',
    lane: 'rent',
    title: 'Οδική βοήθεια & ασφάλειες',
    body: 'Οδική βοήθεια 24/7, CDW/SCDW πριν την υπογραφή και live τοποθεσία όταν χρειάζεται.',
    hook: 'Καθαρή ασφάλεια πριν φύγει το όχημα',
  },
  {
    id: 'rent-sign',
    icon: 'draw',
    accent: 'teal',
    visual: 'billing',
    lane: 'rent',
    title: 'Ψηφιακό συμβόλαιο',
    body: 'Υπογραφή, checklist και έγγραφα στην ίδια ροή — χωρίς χαρτιά στο γραφείο.',
    hook: 'Παραλαβή σε λίγα λεπτά',
  },
  {
    id: 'brand',
    icon: 'palette',
    accent: 'sky',
    visual: 'brand',
    lane: 'shared',
    title: 'Δική σας βιτρίνα',
    body: 'Λογότυπο, χρώματα και αρχική με το brand του γραφείου σας — όχι γενική πύλη.',
    hook: 'Ο πελάτης βλέπει εσάς',
  },
  {
    id: 'email',
    icon: 'campaign',
    accent: 'sky',
    visual: 'email',
    lane: 'shared',
    title: 'Email καμπάνιες',
    body: `${CAMPAIGN_TEMPLATE_COUNT}+ έτοιμα πρότυπα για προσφορές εκδρομών και ενοικιάσεων.`,
    hook: 'Χωρίς Word και χωρίς εξωτερικό εργαλείο',
  },
  {
    id: 'billing',
    icon: 'payments',
    accent: 'teal',
    visual: 'billing',
    lane: 'shared',
    title: 'Συμβόλαιο ανά υπηρεσία',
    body: 'Πλάνο λεωφορείων, add-on Rent ή μόνο Ενοικιάσεις — μηνιαίο ή ετήσιο.',
    hook: 'Πληρώνετε ό,τι ανοίγετε',
  },
];

export const FEATURE_LANES = {
  buses: {
    kicker: 'Λεωφορεία',
    title: 'Εκδρομές από κράτηση έως GPS',
    href: '#session-buses',
  },
  rent: {
    kicker: 'Ενοικιάσεις',
    title: 'Αυτοκίνητα με βοήθεια και συμβόλαιο',
    href: '#session-rent',
  },
  shared: {
    kicker: 'Κοινά',
    title: 'Ό,τι μοιράζονται και οι δύο πόρτες',
    href: '#pricing',
  },
};

export const STEPS = [
  {
    step: '01',
    title: 'Επιλέγετε πόρτες',
    body: 'Λεωφορεία, Ενοικιάσεις, ή και τα δύο — με το συμβόλαιο που σας ταιριάζει.',
  },
  {
    step: '02',
    title: 'Βάζετε το brand σας',
    body: 'Site, χρώματα, στόλος και εκδρομές ή οχήματα — μέσα σε ώρες, όχι μήνες.',
  },
  {
    step: '03',
    title: 'Πουλάτε online',
    body: 'Ο πελάτης κλείνει εκδρομή ή ενοικίαση · εσείς δουλεύετε από έναν πίνακα.',
  },
];

/** Audience — δύο στήλες, μία ανά υπηρεσία (όχι 6 ίδια cards). */
export const AUDIENCE = {
  kicker: 'Για ποιον είναι',
  title: 'Αναγνωρίζετε τον εαυτό σας;',
  support: 'Ίδια πλατφόρμα · δύο πόρτες. Διαλέξτε ό,τι τρέχει το γραφείο σας σήμερα.',
  close:
    'Αν απαντήσατε «ναι» σε κάτι — ανοίγετε λεωφορεία, ενοικιάσεις, ή και τα δύο, με το δικό σας brand.',
  buses: {
    kicker: 'Λεωφορεία',
    title: 'Τρέχετε εκδρομές και θέλετε τάξη στην αναχώρηση',
    href: '#session-buses',
    points: [
      { icon: 'language', text: 'Έχετε site, αλλά οι κρατήσεις έρχονται ακόμα στο τηλέφωνο' },
      { icon: 'table_chart', text: 'Excel για λίστες επιβατών και πληρότητα' },
      { icon: 'my_location', text: 'Θέλετε GPS χωρίς δεύτερο συνδρομητικό' },
    ],
  },
  rent: {
    kicker: 'Ενοικιάσεις',
    title: 'Θέλετε αυτοκίνητα δίπλα στα λεωφορεία — καθαρά',
    href: '#session-rent',
    points: [
      { icon: 'car_rental', text: 'Ενοικιάσεις χωρίς να μπερδεύονται με τις εκδρομές' },
      { icon: 'shield', text: 'Ασφάλειες και υπογραφή πριν φύγει το όχημα' },
      { icon: 'health_and_safety', text: 'Οδική βοήθεια όταν ο πελάτης είναι στον δρόμο' },
    ],
  },
};

/** @deprecated Prefer AUDIENCE — kept for older imports/tests. */
export const AUDIENCE_HOOKS = [
  ...AUDIENCE.buses.points.map((p) => ({ text: p.text, icon: p.icon, accent: 'sky' })),
  ...AUDIENCE.rent.points.map((p) => ({ text: p.text, icon: p.icon, accent: 'teal' })),
];
