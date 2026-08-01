/**
 * Newsletter email campaign templates.
 * Unlocked when the office has an active bus/agency (or Rent) contract.
 */

import { newBlock } from './campaignBlocks.js';

const THUMB = {
  home: '/email-templates/gr_2.png',
  promo: '/email-templates/gr_3.png',
  domestic: '/email-templates/gr_5.png',
};

const HORIZON_CTA = { bg: '#ffb702', textColor: '#1D1D1F' };

function cta(label, href = 'https://www.poreiago.com', style = HORIZON_CTA) {
  return { ...newBlock('cta'), label, href, ...style };
}
function header(url, alt = 'Newsletter') {
  return { ...newBlock('header'), url, alt, theme: 'horizon' };
}
function text(html) {
  return { ...newBlock('text'), content: html };
}
function image(url, alt) {
  return { ...newBlock('image'), url, alt };
}

const IMG = {
  beach:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDglX9VvDGm6ZZwhAaoXJ5EjLHSdVWa8sQaTLQbRGABNvUT5q4bdAyUla40R-eFm7Z3Srnm7CyVsgOUO6wTF9zIChKWt2WLe4uqRBBtlYjjs8xlJ40DlgtY4UWGsAEv-XB-mJsJWVdJxcj2HIVWOpIfTXC9MLOWapEot16s_bBj_DdwbtWyumpT0MlHGbXpHlFG1v7Lo3cBO5KQv9-P1kmD04m46K0rdmBOXMUSIJLiiPQievuUGXls6zn5o8oSVigTq4S0M_1g0qK6',
  europe:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuB1nChplOcmwaHvDxV6xX4rB6fRR9ddy8CVSS2rZWbNew24kQZNNLzRr9Cd3vUJj9NyAZTXvwVDAbAqCEMkwrFsGyTwrAmAed4m6sd6fFD1D6BofkGnZwc2jYG4T6G9_ql7yNTYeW--2FonMJGprwnK-ndcVaAOxhfPOdYHnUf3OMPnljzrRWUFmUw9LTNnCPbwHRc-3iPiZQ-lXEXitUSh1Eqte4ic5wvky4H5vTSRMDO57Km1INjQZm4lnJ-diokq7Y-gGrQbmK6-',
  home:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCKTkXo5SSKQL43tI4XhW6nPgTDiAXKnM-Jw-jNs8HV8jhXHreQ6YK95T1McLp6KIUsnd-W4yMuhgo8ZfRx9I49XNSpNO-RfHfLJo55DRRA5fm0KPjZ9Sn0_zc59NWx9M6kfXsMIW7TrZVxYHV3zJUpWMpLv2BfVjXNNEdC_YIuUW024nr9X4CJALkVA8jCL9js1YmFCGeaYyMvwaDSTLWD5pVACPG9u0ukp6vNiqjTF5sAp7_6sZp3RjFrTpQqSidoTRHsS2KgXKU4',
};

export const STITCH_NEWSLETTER_CATEGORY = {
  id: 'newsletter',
  label: 'Newsletter',
  icon: 'newspaper',
  requiresModule: 'newsletter',
};

export const STITCH_NEWSLETTER_TEMPLATES = [
  {
    id: 'nl-monthly-digest',
    category: 'newsletter',
    requiresModule: 'newsletter',
    audienceHint: 'subscribed_only',
    name: 'Μηνιαίο Newsletter',
    subtitle: 'Νέα, προσφορές & προορισμοί του μήνα',
    thumb: THUMB.home,
    subject: 'Το newsletter του μήνα — νέες διαδρομές & προσφορές',
    preheader: 'Ό,τι πρέπει να ξέρετε πριν το επόμενο ταξίδι σας',
    campaignName: 'Newsletter — Μηνιαίο',
    blocks: () => [
      header(IMG.home, 'Newsletter'),
      text(`<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#005d90;">Newsletter</p>
<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#1b1b1d;line-height:1.25;">Νέα του μήνα</h1>
<p style="margin:0;font-size:16px;line-height:1.6;color:#404850;">Καλώς ήρθατε στο μηνιαίο μας newsletter — επιλεγμένες διαδρομές, προσφορές και συμβουλές για το επόμενο ταξίδι σας.</p>`),
      cta('Δες τις προτάσεις'),
      image(IMG.beach, 'Προορισμοί'),
      text(`<h2 style="margin:0 0 8px 0;font-size:20px;color:#005d90;">3 προτάσεις για εσάς</h2>
<ul style="margin:0;padding:0 0 0 18px;font-size:15px;color:#404850;line-height:1.8;">
<li>Νέα δρομολόγια για το Σαββατοκύριακο</li>
<li>Early bird προσφορές για το καλοκαίρι</li>
<li>Οδηγός για άνετη επιβίβαση με QR</li>
</ul>`),
      cta('Άνοιξε το My Wallet'),
    ],
  },
  {
    id: 'nl-welcome-series',
    category: 'newsletter',
    requiresModule: 'newsletter',
    audienceHint: 'subscribed_only',
    name: 'Καλωσόρισμα συνδρομητή',
    subtitle: 'Welcome email μετά την εγγραφή στο newsletter',
    thumb: THUMB.promo,
    subject: 'Καλώς ήρθατε — είστε μέσα στη λίστα μας',
    preheader: 'Ευχαριστούμε που εγγραφήκατε στο newsletter',
    campaignName: 'Newsletter — Welcome',
    blocks: () => [
      header(IMG.europe, 'Καλώς ήρθατε'),
      text(`<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#005d90;">Καλώς ήρθατε</h1>
<p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#404850;">Ευχαριστούμε που εγγραφήκατε. Από εδώ και πέρα θα λαμβάνετε επιλεγμένες προσφορές και νέα — χωρίς spam.</p>
<p style="margin:0;font-size:15px;color:#404850;">Μπορείτε να διαγραφείτε οποιαδήποτε στιγμή από το τέλος κάθε email.</p>`),
      cta('Εξερευνήστε προορισμούς'),
    ],
  },
  {
    id: 'nl-seasonal',
    category: 'newsletter',
    requiresModule: 'newsletter',
    audienceHint: 'subscribed_only',
    name: 'Εποχιακό Newsletter',
    subtitle: 'Άνοιξη / Καλοκαίρι / Χειμώνας — seasonal digest',
    thumb: THUMB.domestic,
    subject: 'Η σεζόν ξεκινά — ιδέες για το επόμενο ταξίδι',
    preheader: 'Εποχιακές προτάσεις από το γραφείο μας',
    campaignName: 'Newsletter — Seasonal',
    blocks: () => [
      header(IMG.beach, 'Εποχιακό'),
      text(`<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7d5800;">Seasonal</p>
<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#1b1b1d;">Η σεζόν ξεκινά</h1>
<p style="margin:0;font-size:16px;line-height:1.6;color:#404850;">Συγκεντρώσαμε τις καλύτερες ιδέες για αυτή την περίοδο — κοντινές αποδράσεις και εκδρομές με άνετη επιβίβαση.</p>`),
      cta('Κλείσε θέση'),
      image(IMG.europe, 'Ευρώπη'),
      text(`<p style="margin:0;font-size:15px;color:#404850;">Ακολουθήστε μας και στο newsletter για early-bird τιμές πριν γεμίσουν τα λεωφορεία.</p>`),
    ],
  },
];
