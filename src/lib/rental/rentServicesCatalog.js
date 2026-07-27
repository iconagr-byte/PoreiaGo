/**
 * Public marketing bullets for Rent services (guest + /rent/services).
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
  },
  {
    id: 'roadside',
    icon: 'car_crash',
    titleEl: 'Οδική βοήθεια 24/7',
    titleEn: '24/7 roadside assistance',
    copyEl: 'Τηλέφωνο οδικής βοήθειας και QR κάρτα πάνω στο pass της ενοικίασης.',
    copyEn: 'Roadside phone plus a QR card on the rental pass.',
  },
  {
    id: 'insurance',
    icon: 'verified_user',
    titleEl: 'Ασφάλεια CDW / SCDW',
    titleEn: 'CDW / SCDW cover',
    copyEl: 'Καθαρή εξήγηση franchise — τι καλύπτει και τι όχι, πριν την υπογραφή.',
    copyEn: 'Clear franchise terms — what is and isn’t covered before you sign.',
  },
  {
    id: 'share',
    icon: 'share_location',
    titleEl: 'Share trip',
    titleEn: 'Share trip',
    copyEl: 'Στείλε link στην οικογένεια με ETA και live pin, όπως στα εισιτήρια.',
    copyEn: 'Send family a link with ETA and a live pin, like passenger track.',
  },
  {
    id: 'checklist',
    icon: 'checklist',
    titleEl: 'Έλεγχος πριν την αναχώρηση',
    titleEn: 'Pre-departure checklist',
    copyEl: 'Checklist στο mobile check-in: λάστιχα, φώτα, λάδια, έγγραφα.',
    copyEn: 'Mobile check-in checklist: tires, lights, fluids, documents.',
  },
];

export function rentServiceCopy(feature, lang = 'el') {
  const en = lang === 'en';
  return {
    title: en ? feature.titleEn : feature.titleEl,
    copy: en ? feature.copyEn : feature.copyEl,
  };
}
