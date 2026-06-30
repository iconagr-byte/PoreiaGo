/** Πρότυπα διάταξης αρχικής σελίδας B2C storefront. */

export const HEADER_TEMPLATES = [
  {
    id: 'glass_dark',
    label: 'Glass Dark',
    description: 'Διαφανές σκούρο header με blur — κλασικό premium look.',
    icon: 'blur_on',
    tags: ['Δημοφιλές', 'Premium'],
  },
  {
    id: 'solid_light',
    label: 'Solid Light',
    description: 'Λευκό header, σκούρα γράμματα — καθαρό και επαγγελματικό.',
    icon: 'light_mode',
    tags: ['Καθαρό'],
  },
  {
    id: 'transparent_minimal',
    label: 'Minimal',
    description: 'Λεπτή γραμμή, μόνο λογότυπο και σύνδεσμοι.',
    icon: 'horizontal_rule',
    tags: ['Minimal'],
  },
  {
    id: 'bordered_elegant',
    label: 'Elegant Border',
    description: 'Λευκό με λεπτό περίγραμμα — editorial αίσθηση.',
    icon: 'border_style',
    tags: ['Editorial'],
  },
  {
    id: 'floating_pill',
    label: 'Floating Pill',
    description: 'Στρογγυλεμένο header που «αιωρείται» πάνω από το hero.',
    icon: 'rounded_corner',
    tags: ['Μοντέρνο'],
  },
  {
    id: 'gradient_bar',
    label: 'Gradient Bar',
    description: 'Έντονο gradient strip — δυναμικό και νεανικό.',
    icon: 'gradient',
    tags: ['Έντονο'],
  },
];

export const HERO_TEMPLATES = [
  {
    id: 'fullscreen_overlay',
    label: 'Fullscreen Overlay',
    description: 'Πλήρους οθόνης φωτογραφία με σκούρο overlay και κείμενα αριστερά.',
    icon: 'panorama',
    tags: ['Κλασικό'],
  },
  {
    id: 'split_left',
    label: 'Split 50/50',
    description: 'Κείμενα αριστερά, εικόνα δεξιά — ισορροπημένη διάταξη.',
    icon: 'view_sidebar',
    tags: ['Ισορροπία'],
  },
  {
    id: 'centered_compact',
    label: 'Centered Compact',
    description: 'Κεντραρισμένος τίτλος, μικρότερο ύψος — γρήγορη πρόσβαση στις εκδρομές.',
    icon: 'format_align_center',
    tags: ['Συμπαγές'],
  },
  {
    id: 'bottom_search',
    label: 'Bottom Search',
    description: 'Μεγάλη εικόνα, φόρμα αναζήτησης στο κάτω μέρος του hero.',
    icon: 'search',
    tags: ['Conversion'],
  },
  {
    id: 'gradient_mesh',
    label: 'Gradient Mesh',
    description: 'Χωρίς έντονη φωτογραφία — χρωματικό mesh background.',
    icon: 'palette',
    tags: ['Μοντέρνο'],
  },
  {
    id: 'card_inset',
    label: 'Card Inset',
    description: 'Hero μέσα σε κάρτα με σκιά — Apple-style framing.',
    icon: 'crop_square',
    tags: ['Apple-style'],
  },
];

export const TRIPS_LAYOUT_TEMPLATES = [
  {
    id: 'grid_three',
    label: 'Πλέγμα 3 στήλες',
    description: 'Κλασικό grid 1→2→3 στήλες — ιδανικό για πολλές εκδρομές.',
    icon: 'grid_view',
    tags: ['Κλασικό'],
  },
  {
    id: 'grid_two_large',
    label: '2 μεγάλες κάρτες',
    description: 'Δύο φαρδιές κάρτες ανά σειρά — έμφαση σε λιγότερες εκδρομές.',
    icon: 'view_column',
    tags: ['Featured'],
  },
  {
    id: 'horizontal_scroll',
    label: 'Οριζόντιο scroll',
    description: 'Καρουζέλ με swipe — mobile-first εμπειρία.',
    icon: 'swipe',
    tags: ['Mobile'],
  },
  {
    id: 'alternating_rows',
    label: 'Εναλλασσόμενες σειρές',
    description: 'Εικόνα αριστερά/δεξιά εναλλάξ — storytelling layout.',
    icon: 'sync_alt',
    tags: ['Storytelling'],
  },
  {
    id: 'compact_list',
    label: 'Συμπαγής λίστα',
    description: 'Πυκνή λίστα με μικρές εικόνες — πολλές εκδρομές σε λίγο χώρο.',
    icon: 'format_list_bulleted',
    tags: ['Πυκνό'],
  },
  {
    id: 'masonry_two',
    label: 'Masonry 2 στήλες',
    description: 'Ασύμμετρο πλέγμα με διαφορετικά ύψη καρτών.',
    icon: 'dashboard',
    tags: ['Creative'],
  },
];

export const TRIP_CARD_TEMPLATES = [
  {
    id: 'premium',
    label: 'Premium Gradient',
    description: 'Μεγάλη εικόνα, gradient accents, πλούσια πληροφορία.',
    icon: 'diamond',
    tags: ['Premium'],
  },
  {
    id: 'compact_horizontal',
    label: 'Compact Horizontal',
    description: 'Οριζόντια διάταξη — εικόνα αριστερά, λεπτομέρειες δεξιά.',
    icon: 'view_agenda',
    tags: ['Συμπαγές'],
  },
  {
    id: 'image_overlay',
    label: 'Image Overlay',
    description: 'Όλα πάνω στην εικόνα — cinematic look.',
    icon: 'layers',
    tags: ['Cinematic'],
  },
  {
    id: 'minimal_clean',
    label: 'Minimal Clean',
    description: 'Λευκή κάρτα, μικρή εικόνα, καθαρή τυπογραφία.',
    icon: 'crop_portrait',
    tags: ['Minimal'],
  },
  {
    id: 'magazine',
    label: 'Magazine',
    description: 'Μεγάλοι τίτλοι, editorial spacing — ταξιδιωτικό περιοδικό.',
    icon: 'newspaper',
    tags: ['Editorial'],
  },
  {
    id: 'bordered_sharp',
    label: 'Bordered Sharp',
    description: 'Οξείες γωνίες, έντονα περιγράμματα — structured look.',
    icon: 'crop_16_9',
    tags: ['Structured'],
  },
  {
    id: 'glass_card',
    label: 'Glass Card',
    description: 'Glassmorphism με blur και ημιδιαφανές φόντο.',
    icon: 'blur_circular',
    tags: ['Glass'],
  },
];

export const FOOTER_TEMPLATES = [
  {
    id: 'classic_columns',
    label: 'Classic Columns',
    description: 'Brand αριστερά, σύνδεσμοι δεξιά — τυπικό B2C footer.',
    icon: 'view_week',
    tags: ['Κλασικό'],
  },
  {
    id: 'minimal_center',
    label: 'Minimal Center',
    description: 'Κεντραρισμένο brand και links — απλό και κομψό.',
    icon: 'format_align_center',
    tags: ['Minimal'],
  },
  {
    id: 'dark_band',
    label: 'Dark Band',
    description: 'Σκούρο full-width footer — έντονο contrast.',
    icon: 'dark_mode',
    tags: ['Έντονο'],
  },
  {
    id: 'split_contact',
    label: 'Split Contact',
    description: 'Επικοινωνία σε ξεχωριστή στήλη με εικονίδια.',
    icon: 'contact_phone',
    tags: ['Επικοινωνία'],
  },
  {
    id: 'newsletter_cta',
    label: 'Newsletter CTA',
    description: 'Περιλαμβάνει περιοχή εγγραφής newsletter.',
    icon: 'mail',
    tags: ['Marketing'],
  },
  {
    id: 'compact_inline',
    label: 'Compact Inline',
    description: 'Μία γραμμή — copyright και links σε σειρά.',
    icon: 'horizontal_rule',
    tags: ['Συμπαγές'],
  },
];

export const HOMEPAGE_LAYOUT_DEFAULTS = {
  homepage_theme_id: 'aegean_classic',
  accent_color: '#0ea5e9',
  secondary_color: '#1e3a5f',
  surface_color: '#f8fafc',
  show_fleet_section: true,
  show_why_us_section: true,
  header_template: 'glass_dark',
  hero_template: 'fullscreen_overlay',
  trips_layout_template: 'grid_three',
  trip_card_template: 'premium',
  footer_template: 'classic_columns',
  trips_section_eyebrow: 'Ανακαλύψτε',
  trips_section_title: 'Εκδρομές στην Ελλάδα',
  trips_section_subtitle:
    'Ημερήσιες και πολυήμερες διαδρομές με premium στόλο — κράτηση θέσης online.',
  intl_section_eyebrow: 'Διεθνή δρομολόγια',
  intl_section_title: 'Ταξίδια προς το Εξωτερικό',
  intl_section_subtitle:
    'Αναχωρήσεις από Ελλάδα με Premium & Luxury coach — κράτηση θέσης online σε λίγα δευτερόλεπτα.',
};

export function getTemplateById(list, id) {
  return list.find((t) => t.id === id) || list[0];
}

export function tripsGridClass(layoutId) {
  switch (layoutId) {
    case 'grid_two_large':
      return 'grid grid-cols-1 lg:grid-cols-2 gap-10';
    case 'horizontal_scroll':
      return 'flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin';
    case 'alternating_rows':
      return 'flex flex-col gap-12';
    case 'compact_list':
      return 'flex flex-col gap-3 max-w-4xl mx-auto';
    case 'masonry_two':
      return 'columns-1 md:columns-2 gap-6 space-y-6';
    case 'grid_three':
    default:
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8';
  }
}

export function tripCardWrapperClass(layoutId) {
  if (layoutId === 'horizontal_scroll') {
    return 'snap-start shrink-0 w-[min(88vw,340px)]';
  }
  if (layoutId === 'masonry_two') {
    return 'break-inside-avoid mb-6';
  }
  return '';
}
