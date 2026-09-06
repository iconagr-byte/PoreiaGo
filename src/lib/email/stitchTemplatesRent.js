/**
 * Rent marketing email campaign templates.
 * Unlocked when the office buys Rent contract or Rent add-on (rent_enabled).
 */

import { newBlock } from './campaignBlocks.js';

const THUMB = {
  promo: '/email-templates/gr_3.png',
  home: '/email-templates/gr_2.png',
  domestic: '/email-templates/gr_5.png',
};

const RENT_CTA = { bg: '#0f766e', textColor: '#ffffff' };

function cta(label, href = 'https://www.poreiago.com/rent', style = RENT_CTA) {
  return { ...newBlock('cta'), label, href, ...style };
}
function header(url, alt = 'Rent') {
  return { ...newBlock('header'), url, alt, theme: 'horizon' };
}
function text(html) {
  return { ...newBlock('text'), content: html };
}
function image(url, alt) {
  return { ...newBlock('image'), url, alt };
}

const IMG = {
  car:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuB1nChplOcmwaHvDxV6xX4rB6fRR9ddy8CVSS2rZWbNew24kQZNNLzRr9Cd3vUJj9NyAZTXvwVDAbAqCEMkwrFsGyTwrAmAed4m6sd6fFD1D6BofkGnZwc2jYG4T6G9_ql7yNTYeW--2FonMJGprwnK-ndcVaAOxhfPOdYHnUf3OMPnljzrRWUFmUw9LTNnCPbwHRc-3iPiZQ-lXEXitUSh1Eqte4ic5wvky4H5vTSRMDO57Km1INjQZm4lnJ-diokq7Y-gGrQbmK6-',
  road:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDglX9VvDGm6ZZwhAaoXJ5EjLHSdVWa8sQaTLQbRGABNvUT5q4bdAyUla40R-eFm7Z3Srnm7CyVsgOUO6wTF9zIChKWt2WLe4uqRBBtlYjjs8xlJ40DlgtY4UWGsAEv-XB-mJsJWVdJxcj2HIVWOpIfTXC9MLOWapEot16s_bBj_DdwbtWyumpT0MlHGbXpHlFG1v7Lo3cBO5KQv9-P1kmD04m46K0rdmBOXMUSIJLiiPQievuUGXls6zn5o8oSVigTq4S0M_1g0qK6',
  keys:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCKTkXo5SSKQL43tI4XhW6nPgTDiAXKnM-Jw-jNs8HV8jhXHreQ6YK95T1McLp6KIUsnd-W4yMuhgo8ZfRx9I49XNSpNO-RfHfLJo55DRRA5fm0KPjZ9Sn0_zc59NWx9M6kfXsMIW7TrZVxYHV3zJUpWMpLv2BfVjXNNEdC_YIuUW024nr9X4CJALkVA8jCL9js1YmFCGeaYyMvwaDSTLWD5pVACPG9u0ukp6vNiqjTF5sAp7_6sZp3RjFrTpQqSidoTRHsS2KgXKU4',
};

export const STITCH_RENT_CATEGORY = {
  id: 'rent',
  label: 'Ενοικιάσεις',
  icon: 'directions_car',
  requiresModule: 'rent',
};

export const STITCH_RENT_TEMPLATES = [
  {
    id: 'rent-weekend-deal',
    category: 'rent',
    requiresModule: 'rent',
    name: 'Weekend Deal /rent',
    subtitle: 'Προσφορά Σαββατοκύριακου για ενοικίαση',
    thumb: THUMB.promo,
    subject: 'Weekend deal — όχημα με έκπτωση για το Σαββατοκύριακο',
    preheader: 'Κλείστε από το Rent Wallet σε λίγα βήματα',
    campaignName: 'Rent — Weekend Deal',
    blocks: () => [
      header(IMG.car, 'Rent Weekend'),
      text(`<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#0f766e;">Rent</p>
<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#134e4a;line-height:1.25;">Weekend Deal</h1>
<p style="margin:0;font-size:16px;line-height:1.6;color:#404850;">Κλείστε όχημα για το Σαββατοκύριακο με ειδική τιμή. Online check-in και QR παραλαβής στο Rent Wallet.</p>`),
      cta('Βρες όχημα'),
      image(IMG.road, 'Οδήγηση'),
      text(`<p style="margin:0;font-size:15px;color:#404850;">Παραλαβή στο γραφείο ή σε σημείο που επιλέγετε — χωρίς χαρτιά.</p>`),
    ],
  },
  {
    id: 'rent-fleet-launch',
    category: 'rent',
    requiresModule: 'rent',
    name: 'Νέος στόλος /rent',
    subtitle: 'Ανακοίνωση νέων οχημάτων στο στόλο',
    thumb: THUMB.home,
    subject: 'Νέα οχήματα διαθέσιμα για ενοικίαση',
    preheader: 'Δείτε τον ενημερωμένο στόλο στο /rent',
    campaignName: 'Rent — Νέος στόλος',
    blocks: () => [
      header(IMG.keys, 'Νέος στόλος'),
      text(`<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#134e4a;">Νέα οχήματα στο στόλο</h1>
<p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#404850;">Προσθέσαμε επιλογές για κάθε ανάγκη — επιβατικά, van και οικογενειακά. Δείτε διαθεσιμότητα και τιμές online.</p>`),
      cta('Δες τον στόλο'),
    ],
  },
  {
    id: 'rent-return-reminder',
    category: 'rent',
    requiresModule: 'rent',
    name: 'Υπενθύμιση επιστροφής',
    subtitle: 'Marketing nudge πριν την επιστροφή οχήματος',
    thumb: THUMB.domestic,
    subject: 'Υπενθύμιση — σύντομα η επιστροφή του οχήματος',
    preheader: 'Ελέγξτε ώρα & σημείο επιστροφής στο Rent Wallet',
    campaignName: 'Rent — Υπενθύμιση επιστροφής',
    blocks: () => [
      header(IMG.road, 'Επιστροφή'),
      text(`<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#134e4a;">Υπενθύμιση επιστροφής</h1>
<p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#404850;">Η περίοδος ενοικίασής σας ολοκληρώνεται σύντομα. Ανοίξτε το Rent Wallet για ώρα, σημείο επιστροφής και checklist.</p>
<ul style="margin:0;padding:0 0 0 18px;font-size:15px;color:#404850;line-height:1.8;">
<li>Ελέγξτε καύσιμα &amp; οδόμετρο</li>
<li>Έχετε έτοιμο το QR της κράτησης</li>
<li>Χρειάζεστε παράταση; Επικοινωνήστε μαζί μας</li>
</ul>`),
      cta('Άνοιξε Rent Wallet', 'https://www.poreiago.com/rent/wallet'),
    ],
  },
  {
    id: 'rent-loyalty-offer',
    category: 'rent',
    requiresModule: 'rent',
    hidden: true,
    name: 'Επαναλαμβανόμενοι πελάτες',
    subtitle: 'Έκπτωση για την επόμενη κράτηση /rent',
    thumb: THUMB.promo,
    subject: 'Ευχαριστούμε — έκπτωση στην επόμενη ενοικίαση',
    preheader: 'Ειδική τιμή για πελάτες που μας εμπιστεύτηκαν ξανά',
    campaignName: 'Rent — Loyalty',
    blocks: () => [
      header(IMG.car, 'Loyalty Rent'),
      text(`<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#0f766e;">Για εσάς</p>
<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#134e4a;">Ευχαριστούμε που μας επιλέξατε</h1>
<p style="margin:0;font-size:16px;line-height:1.6;color:#404850;">Ως πελάτης ενοικίασης, έχετε ειδική τιμή στην επόμενη κράτηση. Κλείστε online από το /rent σε λίγα λεπτά.</p>`),
      cta('Κλείσε ξανά'),
    ],
  },
];
