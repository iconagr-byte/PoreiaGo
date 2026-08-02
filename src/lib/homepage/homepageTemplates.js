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
    tags: ['Featured', 'Premium'],
  },
  {
    id: 'featured_plus_grid',
    label: 'Featured + grid',
    description: 'Η πρώτη εκδρομή σε μεγάλη κάρτα · οι υπόλοιπες σε πλέγμα δίπλα.',
    icon: 'dashboard_customize',
    tags: ['Premium', 'Featured'],
  },
  {
    id: 'bento_showcase',
    label: 'Bento showcase',
    description: 'Ασύμμετρο premium πλέγμα — μία ηρωική κάρτα και δορυφόροι.',
    icon: 'widgets',
    tags: ['Premium', 'Creative'],
  },
  {
    id: 'grid_four',
    label: 'Πλέγμα 4 στήλες',
    description: 'Πυκνό gallery σε μεγάλες οθόνες — ιδανικό για πλούσιο κατάλογο.',
    icon: 'apps',
    tags: ['Catalog'],
  },
  {
    id: 'editorial_stack',
    label: 'Editorial stack',
    description: 'Μεγάλες κάρτες σε στήλη στο κέντρο — περιοδικό look.',
    icon: 'view_day',
    tags: ['Premium', 'Editorial'],
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
    tags: ['Storytelling', 'Premium'],
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
    id: 'soft_apple',
    label: 'Soft Apple',
    description: 'Ήσυχη κάρτα SF-style — απαλό γκρι, καθαρή τυπογραφία, χωρίς ένταση.',
    icon: 'phone_iphone',
    tags: ['Premium', 'Minimal'],
  },
  {
    id: 'luxe_noir',
    label: 'Luxe Noir',
    description: 'Σκούρα premium κάρτα με χρυσές λεπτομέρειες — luxury coach vibe.',
    icon: 'dark_mode',
    tags: ['Premium', 'Luxury'],
  },
  {
    id: 'spotlight',
    label: 'Spotlight',
    description: 'Μεγάλη φωτογραφία, τιμή σε badge και CTA — μεγιστοποιεί τη μετατροπή.',
    icon: 'highlight',
    tags: ['Premium', 'Conversion'],
  },
  {
    id: 'ticket_stub',
    label: 'Ticket Stub',
    description: 'Κάρτα-εισιτήριο με διάτρηση — παιχνιδιάρικο και λειτουργικό.',
    icon: 'confirmation_number',
    tags: ['Premium', 'Playful'],
  },
  {
    id: 'compact_horizontal',
    label: 'Compact Horizontal',
    description: 'Οριζόντια διάταξη — εικόνα αριστερά, λεπτομέρειες δεξιά.',
    icon: 'view_agenda',
    tags: ['Συμπαγές'],
  },
  {
    id: 'abroad_horizontal',
    label: 'Abroad Horizontal',
    description:
      'Οριζόντια κάρτα εκδρομής εξωτερικού — προορισμός, ημερομηνίες και τιμή θέσης λεωφορείου (όχι αεροπλάνο).',
    icon: 'public',
    tags: ['Εξωτερικό', 'Horizontal', 'Λεωφορείο'],
  },
  {
    id: 'image_overlay',
    label: 'Image Overlay',
    description: 'Όλα πάνω στην εικόνα — cinematic look.',
    icon: 'layers',
    tags: ['Cinematic', 'Premium'],
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
    tags: ['Editorial', 'Premium'],
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

/** Rent homepage /rent fleet discovery — layout of vehicle cards. */
export const RENT_FLEET_LAYOUT_TEMPLATES = [
  {
    id: 'rent_grid_three',
    label: 'Πλέγμα 3 στήλες',
    description: 'Κλασικό grid για στόλο ενοικίασης — ισορροπημένο σε desktop & mobile.',
    icon: 'grid_view',
    tags: ['Κλασικό'],
  },
  {
    id: 'rent_grid_two',
    label: '2 μεγάλες κάρτες',
    description: 'Φαρδιές κάρτες — ιδανικό όταν έχετε λίγα premium οχήματα.',
    icon: 'view_column',
    tags: ['Premium', 'Featured'],
  },
  {
    id: 'rent_featured',
    label: 'Featured showroom',
    description: 'Το πρώτο όχημα σε μεγάλη κάρτα · τα υπόλοιπα σε πλέγμα.',
    icon: 'garage_home',
    tags: ['Premium', 'Showroom'],
  },
  {
    id: 'rent_scroll',
    label: 'Οριζόντιο scroll',
    description: 'Swipe καρουζέλ — γρήγορη περιήγηση στόλου στο κινητό.',
    icon: 'swipe',
    tags: ['Mobile'],
  },
  {
    id: 'rent_list',
    label: 'Λίστα σύγκρισης',
    description: 'Συμπαγείς οριζόντιες σειρές — εύκολη σύγκριση τιμής & παροχών.',
    icon: 'table_rows',
    tags: ['Σύγκριση'],
  },
];

/** Rent vehicle card visual style. */
export const RENT_FLEET_CARD_TEMPLATES = [
  {
    id: 'rent_premium',
    label: 'Premium Rent',
    description: 'Μεγάλη φωτογραφία, κατηγορία, τιμή/ημέρα — καθαρό showroom.',
    icon: 'directions_car',
    tags: ['Premium'],
  },
  {
    id: 'rent_soft',
    label: 'Soft Showroom',
    description: 'Απαλό Apple-style — ήσυχα χρώματα, λεπτά περιγράμματα.',
    icon: 'phone_iphone',
    tags: ['Premium', 'Minimal'],
  },
  {
    id: 'rent_overlay',
    label: 'Photo Overlay',
    description: 'Όνομα & τιμή πάνω στη φωτογραφία — cinematic fleet look.',
    icon: 'layers',
    tags: ['Premium', 'Cinematic'],
  },
  {
    id: 'rent_compact',
    label: 'Compact Row',
    description: 'Οριζόντια κάρτα — γρήγορη σάρωση πολλών οχημάτων.',
    icon: 'view_agenda',
    tags: ['Συμπαγές'],
  },
  {
    id: 'rent_spec',
    label: 'Spec Sheet',
    description: 'Έμφαση σε θέσεις, κιβώτιο, καύσιμο και ημερήσια τιμή.',
    icon: 'fact_check',
    tags: ['Λειτουργικό'],
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
  rent_fleet_layout_template: 'rent_grid_three',
  rent_fleet_card_template: 'rent_premium',
  /** International section — independent of Greece layout/card. */
  intl_trips_layout_template: 'horizontal_scroll',
  intl_trip_card_template: 'abroad_horizontal',
  trips_section_eyebrow: 'Ανακαλύψτε',
  trips_section_title: 'Εκδρομές στην Ελλάδα',
  trips_section_subtitle:
    'Ημερήσιες και πολυήμερες διαδρομές με premium στόλο — κράτηση θέσης online.',
  intl_section_eyebrow: 'Διεθνή δρομολόγια',
  intl_section_title: 'Ταξίδια προς το Εξωτερικό',
  intl_section_subtitle:
    'Οριζόντια προβολή διεθνών εκδρομών με λεωφορείο — σύρετε για να δείτε όλες.',
};

export function getTemplateById(list, id) {
  return list.find((t) => t.id === id) || list[0];
}

export function tripsGridClass(layoutId, tripCount = 0) {
  // One trip (typical new office) — keep the card narrow/centered, not full-bleed.
  if (tripCount === 1) {
    switch (layoutId) {
      case 'compact_list':
        return 'flex flex-col gap-3 max-w-sm sm:max-w-md mx-auto w-full';
      case 'horizontal_scroll':
        return 'flex justify-center gap-6';
      case 'alternating_rows':
      case 'editorial_stack':
        return 'flex flex-col gap-8 max-w-lg sm:max-w-xl mx-auto w-full';
      default:
        return 'grid grid-cols-1 max-w-[300px] sm:max-w-[340px] md:max-w-[380px] mx-auto gap-6 w-full';
    }
  }

  // Two trips: avoid ultra-wide 50/50 stretch on large screens.
  if (
    tripCount === 2 &&
    (layoutId === 'grid_two_large' ||
      layoutId === 'grid_three' ||
      layoutId === 'masonry_two' ||
      layoutId === 'featured_plus_grid' ||
      layoutId === 'grid_four')
  ) {
    return 'grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto w-full';
  }

  switch (layoutId) {
    case 'grid_two_large':
      return 'grid grid-cols-1 lg:grid-cols-2 gap-10';
    case 'featured_plus_grid':
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 items-stretch';
    case 'bento_showcase':
      return 'grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-5 items-stretch';
    case 'grid_four':
      return 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6';
    case 'editorial_stack':
      return 'flex flex-col gap-10 max-w-3xl mx-auto w-full';
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

export function tripCardWrapperClass(layoutId, tripCount = 0, index = 0, cardTemplateId = '') {
  if (layoutId === 'horizontal_scroll') {
    const abroad = cardTemplateId === 'abroad_horizontal';
    if (tripCount === 1) {
      return abroad
        ? 'w-full max-w-[420px] sm:max-w-[460px] h-full'
        : 'w-full max-w-[320px] sm:max-w-[360px] h-full';
    }
    return abroad
      ? 'snap-start shrink-0 w-[min(92vw,420px)] h-full'
      : 'snap-start shrink-0 w-[min(88vw,300px)] h-full';
  }
  if (layoutId === 'masonry_two') {
    return 'break-inside-avoid mb-6';
  }
  if (layoutId === 'featured_plus_grid' && index === 0 && tripCount > 1) {
    return 'h-full md:col-span-2';
  }
  if (layoutId === 'bento_showcase') {
    if (index === 0) return 'h-full md:col-span-4 md:row-span-2 min-h-[280px]';
    if (index === 1) return 'h-full md:col-span-2';
    return 'h-full md:col-span-2';
  }
  // Equal-height cards in CSS grids (items stretch; children fill).
  return 'h-full';
}

export function rentFleetGridClass(layoutId) {
  switch (layoutId) {
    case 'rent_grid_two':
      return 'grid grid-cols-1 md:grid-cols-2 gap-6 list-none p-0 m-0';
    case 'rent_featured':
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0';
    case 'rent_scroll':
      return 'flex gap-5 overflow-x-auto pb-3 snap-x snap-mandatory list-none p-0 m-0';
    case 'rent_list':
      return 'flex flex-col gap-3 max-w-3xl list-none p-0 m-0';
    case 'rent_grid_three':
    default:
      return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0';
  }
}

export function rentFleetCardWrapperClass(layoutId, index = 0) {
  if (layoutId === 'rent_scroll') {
    return 'snap-start shrink-0 w-[min(86vw,300px)]';
  }
  if (layoutId === 'rent_featured' && index === 0) {
    return 'md:col-span-2';
  }
  if (layoutId === 'rent_list') {
    return 'w-full';
  }
  return '';
}
