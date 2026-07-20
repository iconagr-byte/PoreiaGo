/** B2B landing copy — platform for travel agencies (not a single agency brand). */

export const PLATFORM_NAME = 'PoreiaGo';
export const PLATFORM_TAGLINE = 'Η πλατφόρμα που τρέχει το ταξιδιωτικό σας γραφείο';

export const HERO = {
  badge: 'Cloud SaaS · Multi-tenant · Ελλάδα & EU',
  title: 'Μία πλατφόρμα για',
  titleAccent: 'όλο το ταξιδιωτικό σας γραφείο',
  subtitle:
    'Κρατήσεις, QR εισιτήρια, live GPS, email καμπάνιες, billing και Control Panel — χωρίς Excel, χωρίς 5 διαφορετικά εργαλεία. ' +
    'Το γραφείο σας με δικό του brand, δικό του site και δικό του συμβόλαιο.',
};

/** Hero background — πλήρες cover, χωρίς demo εκδρομή */
export const HERO_BACKGROUND_IMAGE =
  'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?auto=format&fit=crop&w=2000&q=85';

/** Έτοιμα πρότυπα email καμπάνιας στο panel (Horizon Ethos / Stitch) */
import { STITCH_CAMPAIGN_TEMPLATES } from '../email/stitchTemplates.js';
export const CAMPAIGN_TEMPLATE_COUNT = STITCH_CAMPAIGN_TEMPLATES.length;

export const STATS = [
  { value: '1 panel', label: 'Αντί για 5+ εργαλεία' },
  { value: 'Live GPS', label: 'Στόλος σε πραγματικό χρόνο' },
  { value: `${CAMPAIGN_TEMPLATE_COUNT}+`, label: 'Έτοιμα email πρότυπα' },
  { value: 'GDPR', label: 'Έτοιμο compliance' },
];

export const FEATURES = [
  {
    icon: 'campaign',
    accent: 'violet',
    title: 'Καμπάνιες email & έτοιμα πρότυπα',
    body: `${CAMPAIGN_TEMPLATE_COUNT} σχεδιασμένα πρότυπα (προσφορές, εκδρομές, πακέτα, lifecycle) — επιλέγετε, προσαρμόζετε brand και στέλνετε σε λίστες πελατών.`,
    hook: 'Newsletter & promo χωρίς designer ή external Mailchimp',
  },
  {
    icon: 'confirmation_number',
    accent: 'sky',
    title: 'Online κρατήσεις & QR',
    body: 'Ο πελάτης κλείνει θέση online. Ο οδηγός σκανάρει QR — χωρίς χαρτί, χωρίς λίστες στο χέρι.',
    hook: 'Λιγότερες ακυρώσεις, γρηγορότερο check-in',
  },
  {
    icon: 'map',
    accent: 'emerald',
    title: 'Live GPS & telematics',
    body: 'Βλέπετε όλο τον στόλο σε χάρτη, ETA για επιβάτες, geofence alerts και ιστορικό διαδρομών.',
    hook: 'Ο πελάτης εμπιστεύεται — εσείς ελέγχετε',
  },
  {
    icon: 'dashboard',
    accent: 'indigo',
    title: 'Control Panel για το γραφείο',
    body: 'Εκδρομές, πελάτες, στόλος, καμπάνιες email, lost & found — όλα σε ένα back office.',
    hook: 'Η ομάδα σας δουλεύει από ένα σημείο',
  },
  {
    icon: 'payments',
    accent: 'amber',
    title: 'Συμβόλαιο μηνιαίο ή ετήσιο',
    body: 'Stripe billing, metered χρέωση για λεωφορεία & εκδρομές. Επιλέγετε πλάνο — ξεκινάτε σε λίγα λεπτά.',
    hook: 'Προβλέψιμο κόστος, κλιμάκωση χωρίς πόνο',
  },
  {
    icon: 'palette',
    accent: 'rose',
    title: 'White-label storefront',
    body: 'Το δικό σας logo, χρώματα και αρχική σελίδα. Ο επιβάτης βλέπει το brand σας — όχι generic portal.',
    hook: 'Επαγγελματική εικόνα από την πρώτη μέρα',
  },
];

export const STEPS = [
  {
    step: '01',
    title: 'Επιλέγετε συμβόλαιο',
    body: 'Μηνιαίο ή ετήσιο · Starter, Professional ή Enterprise.',
  },
  {
    step: '02',
    title: 'Ρυθμίζετε το γραφείο',
    body: 'Branding, εκδρομές, στόλος, οδηγοί, καμπάνιες — μέσα σε ώρες, όχι μήνες.',
  },
  {
    step: '03',
    title: 'Πουλάτε & εκτελείτε',
    body: 'Οι πελάτες κλείνουν online · εσείς διαχειρίζεστε από το panel.',
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
    text: 'Στέλνετε newsletters με copy-paste από Word ή χωρίς πρότυπα;',
    icon: 'campaign',
    accent: 'amber',
  },
  {
    text: 'Χρειάζεστε GDPR-ready εργαλεία για B2C πελάτες;',
    icon: 'verified_user',
    accent: 'indigo',
  },
];
