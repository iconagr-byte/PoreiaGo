/**
 * Public marketing catalog for Rent services (guest landing + /rent/services).
 * Used for advertising — not gated behind an active booking.
 */

export const RENT_SERVICE_FEATURES = [
  {
    id: 'sos',
    icon: 'sos',
    titleEl: 'Emergency / SOS',
    titleEn: 'Emergency / SOS',
    copyEl: 'Κουμπί κλήσης γραφείου και αποστολή live τοποθεσίας στο Rent Wallet.',
    copyEn: 'One-tap office call and live location send from Rent Wallet.',
    detailEl: [
      'Άμεση κλήση στο γραφείο από το pass της ενοικίασης',
      'Αποστολή live pin ώστε να σε βρουν γρήγορα',
      'Διαθέσιμο όσο η κράτηση είναι ενεργή',
    ],
    detailEn: [
      'Call the office instantly from your rental pass',
      'Send a live pin so help can find you fast',
      'Available while your booking is active',
    ],
  },
  {
    id: 'roadside',
    icon: 'car_crash',
    titleEl: 'Οδική βοήθεια 24/7',
    titleEn: '24/7 roadside assistance',
    copyEl: 'Τηλέφωνο οδικής βοήθειας και QR κάρτα πάνω στο pass της ενοικίασης.',
    copyEn: 'Roadside phone plus a QR card on the rental pass.',
    detailEl: [
      'Αριθμός οδικής βοθείας πάντα στο κινητό σου',
      'QR κάρτα στο Wallet για γρήγορη πρόσβαση',
      'Υποστήριξη βλάβης / ακινητοποίησης όλο το 24ωρο',
    ],
    detailEn: [
      'Roadside number always on your phone',
      'QR card in the Wallet for quick access',
      'Breakdown support around the clock',
    ],
  },
  {
    id: 'insurance',
    icon: 'verified_user',
    titleEl: 'Ασφάλεια CDW / SCDW',
    titleEn: 'CDW / SCDW cover',
    copyEl: 'Καθαρή εξήγηση franchise — τι καλύπτει και τι όχι, πριν την υπογραφή.',
    copyEn: 'Clear franchise terms — what is and isn’t covered before you sign.',
    detailEl: [
      'CDW και SCDW με απλά λόγια πριν κλείσεις',
      'Φαίνεται τι πληρώνεις και τι μένει ως απαλλαγή',
      'Επιβεβαίωση όρων μέσα στη ροή κράτησης',
    ],
    detailEn: [
      'CDW and SCDW explained in plain language before you book',
      'See what you pay and what remains as excess',
      'Terms acknowledged inside the booking flow',
    ],
  },
  {
    id: 'share',
    icon: 'share_location',
    titleEl: 'Share trip',
    titleEn: 'Share trip',
    copyEl: 'Στείλε link στην οικογένεια με ETA και live pin, όπως στα εισιτήρια.',
    copyEn: 'Send family a link with ETA and a live pin, like passenger track.',
    detailEl: [
      'Κοινοποίηση διαδρομής με ένα tap',
      'Live pin και ETA για όσους σε περιμένουν',
      'Ίδια λογική με το tracking επιβατών στις εκδρομές',
    ],
    detailEn: [
      'Share your trip with one tap',
      'Live pin and ETA for people waiting for you',
      'Same idea as passenger trip tracking',
    ],
  },
  {
    id: 'checklist',
    icon: 'checklist',
    titleEl: 'Έλεγχος πριν την αναχώρηση',
    titleEn: 'Pre-departure checklist',
    copyEl: 'Checklist στο mobile check-in: λάστιχα, φώτα, λάδια, έγγραφα.',
    copyEn: 'Mobile check-in checklist: tires, lights, fluids, documents.',
    detailEl: [
      'Checklist στο κινητό: ελαστικά, φώτα, υγρά, έγγραφα',
      'Καταγραφή ζημιών πριν φύγεις',
      'Λιγότερη αναμονή και χαρτί στο desk παραλαβής',
    ],
    detailEn: [
      'Phone checklist: tires, lights, fluids, documents',
      'Log damages before you leave',
      'Less waiting and paperwork at pickup',
    ],
  },
];

export function rentServiceCopy(feature, lang = 'el') {
  const en = lang === 'en';
  return {
    title: en ? feature.titleEn : feature.titleEl,
    copy: en ? feature.copyEn : feature.copyEl,
    details: en
      ? feature.detailEn || []
      : feature.detailEl || [],
  };
}
