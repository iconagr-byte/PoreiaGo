/**
 * Πρότυπα καμπάνιας από Google Stitch export (Horizon Ethos / Voyage).
 * Πηγές: stitch zip (1) marketing · stitch zip (3) gr_1..gr_14
 */

import { compileBlocksToHtml, newBlock } from './campaignBlocks.js';
import { STITCH_GR_EXTRA_CATEGORIES, STITCH_GR_TEMPLATES } from './stitchTemplatesGr.js';
import { STITCH_EXTRA_TEMPLATES } from './stitchTemplatesExtra.js';
import { STITCH_MORE_TEMPLATES } from './stitchTemplatesMore.js';
import {
  STITCH_EUROPE_CITIES_CATEGORY,
  STITCH_EUROPE_CITY_TEMPLATES,
} from './stitchTemplatesEuropeCities.js';
import {
  STITCH_GREECE_PLACES_CATEGORY,
  STITCH_GREECE_PLACE_TEMPLATES,
} from './stitchTemplatesGreecePlaces.js';

const THUMB = {
  santoriniPkg: '/email-templates/gr_1.png',
  home: '/email-templates/gr_2.png',
  promo: '/email-templates/gr_3.png',
  international: '/email-templates/gr_4.png',
  domestic: '/email-templates/gr_5.png',
};

const IMG = {
  promoBeach:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDglX9VvDGm6ZZwhAaoXJ5EjLHSdVWa8sQaTLQbRGABNvUT5q4bdAyUla40R-eFm7Z3Srnm7CyVsgOUO6wTF9zIChKWt2WLe4uqRBBtlYjjs8xlJ40DlgtY4UWGsAEv-XB-mJsJWVdJxcj2HIVWOpIfTXC9MLOWapEot16s_bBj_DdwbtWyumpT0MlHGbXpHlFG1v7Lo3cBO5KQv9-P1kmD04m46K0rdmBOXMUSIJLiiPQievuUGXls6zn5o8oSVigTq4S0M_1g0qK6',
  promoEurope:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuB1nChplOcmwaHvDxV6xX4rB6fRR9ddy8CVSS2rZWbNew24kQZNNLzRr9Cd3vUJj9NyAZTXvwVDAbAqCEMkwrFsGyTwrAmAed4m6sd6fFD1D6BofkGnZwc2jYG4T6G9_ql7yNTYeW--2FonMJGprwnK-ndcVaAOxhfPOdYHnUf3OMPnljzrRWUFmUw9LTNnCPbwHRc-3iPiZQ-lXEXitUSh1Eqte4ic5wvky4H5vTSRMDO57Km1INjQZm4lnJ-diokq7Y-gGrQbmK6-',
  promoFlash:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBWWSZE57W5HK8VtYfnaAHZtU64nJCU1uqbk0uaT9vrllxVn0qCIuDO3SX6t06f1cWduZtRkaWFCdpdLSJhmEVLENNJSxAYUc7Fk8tCDz-slmw9LR8Kg3XXGE1Rw75B4HWxZoChxfSRB9681o1aV0nNJJ3eljKNHQDMMUaxvjjwPqLnr14eH9iX8EyJAAByC6Kp1OI8AdIL8zsN09yrnt72k4zBKTDGc7_5bQUqNbYvrPU1cStdqNO_LBhqhwHHFY0RPpTf5xh8XhWC',
  meteora:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAFvSfwCfeI0oBTQOpHE100qMBGP_nA8HnvwzgAQnu7ajqvLe6wo1KdwaK1gvA-xsBnpw8RFu23J9Csd4Gvg3z2b5M5iywT-lCfM5Xs_-GKj3xUfRSa8fGEDVZRa_mBRNMKaPoaKR9-YwmMoQMvHsN4evqNZ_c6wfiaRFPNzQ2SvikObTnj1MSSDYQ40y1Z_ls3NO5qKl9OKppy-yUdBI01prtBad-bVQW5rqlQ2jP9TpMkAmm4rl3OIaPC_fa-Dc99l9YMuR6Dxx1N',
  paris:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCev_xmkp3N4URDrL46CFzt_DjwBaDXdvBbfL-1Gp91SOQOoscyUyxJNwsigUfzwU9GVCKt28nWnHBom1QRv488g7weZVQb-4zBjU1s7TaL9MX9FdORSGJmkIEdICM_WQ_YE25ZTxhYMITkJmO-KWgnM7h5E2iwo6PuscWX4EpSJcZ18MsxZPKvLDfRrj-J7ozSUxeMJF8DcrQVosqBJNGvC20H-3gF4iLXQ-bD2mdqCnVG--vvhuNDxLpGM3__gToddQvPprGzMhul',
  santorini:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDdNas_atDYFR-1lmm_hSQWtWwPVqvSWIqKFPKPUv0hJE4aHhaadFAFE40MrKkaG740hd1mV7x0I1sjT0c5Zyq1D-lCK8as3EWUiw09dMFtx3vtxIQVktHlAsQhKJ37eP9iyxW7gp6y-bRYuI87291d3Bpmni9cv3YfWNja5CmsLidqb626Mx2NwPlasjq6QknPR7ucPpTdzLjiFAzrf87y_S9dt0Dqxpb8_XR2zu5aELWC0sI-sKeWEVpYC7B_J5CAB7ePa8gn8Bng',
  homeSantorini:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCKTkXo5SSKQL43tI4XhW6nPgTDiAXKnM-Jw-jNs8HV8jhXHreQ6YK95T1McLp6KIUsnd-W4yMuhgo8ZfRx9I49XNSpNO-RfHfLJo55DRRA5fm0KPjZ9Sn0_zc59NWx9M6kfXsMIW7TrZVxYHV3zJUpWMpLv2BfVjXNNEdC_YIuUW024nr9X4CJALkVA8jCL9js1YmFCGeaYyMvwaDSTLWD5pVACPG9u0ukp6vNiqjTF5sAp7_6sZp3RjFrTpQqSidoTRHsS2KgXKU4',
  mykonos:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC_RDipq3mHUkqjJpzIXzNES__uLjFgkm5UEOEnU-2Nvxu8bLG1b0WzuPsipO-yRnFsGMf5R2uSlZUetZ8IIR8_9B-ox0K-8_fBUMU9TMdeUecC0NMW2-pBa8Ufk5Ksu64KN4a4ac3UKm7WMsU4uK-9xsePXrZ_V-y5x35CJj1l7iNvY78XCdqCsXSi_zKZpi6BOD_Jz_cr1tHNgZyT9_0g0QJLlPo9R9JLdNV6E8BpXA3VBmDsDejHO1N9b6L3OKe8eNj_x0I4WRyG',
  chania:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBswKqhVgKKz86kUhDfqgTyZzKwK3LCUSCUhpTAfcztltx5yz7lTVELCqCEmkOHLKPuJcPXg5vRBjrwOMRcFWmnGhhGPT9ulodLor2LZedcxQhA0H2uYsY3H64B6SaIUvWNRjeaT-4JAjd7T-6Oxb_gTbyReAkyRmsCR42BN_lGSyeEnO1uMttkxP18uZdLIkSed9yZ9Lbr6aU_VF0wuEfacF5Bux_6KSHskfVmrok8kD66F5yVR9VJMQk9O6OfbVthJ6B38xqJkeK6',
  pelion:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAkMz7SZDBpVyJdDaZMAk2maZt1qvL9yo1Ll43X3s5PiYL2A_tfTu7iy8KHIsSsen5MpKs9z2gp3buu-7LxOZ4xzu7cWsJpZPljQ6gI7g0krdlRnYwB4V8j2nKfU92EAdw7-B8nVqokJYAzZhhcsk_oyQIF_UZytErKxP8htTBPewdcn_O48-aQjt0zAzePwh20aS8dcdVW4y3nRLL9rpml-ri_ege0QydFDQt7BAbE3_KeJrZHoKN1Rni4KPAg5pYoJ6QgwaDmmRTf',
  rhodes:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBNuG8Y1hIQxh2QiuquK8fMr0VBZHLn2p0D9qEyWmSJVTnwU-AncxYhTnuBBNq9LypOKB4iMcaL2WFClRmLIm_GtUx6Roc1meRSvxZWKI5dotjkyJIJob17a3-MG17zdzbjyqvyHk-32miCz_VrgiOX95pq3uN-HcB7X7CCelnE9QRikHu9oYMc_EraXUaf-B2S5zgQm0ESEsokUOIHfkR_whAMfNzhXURsJZON3GqfKdWS_XJ51JomKl3-3RMji_MITOtS54D-zE5v',
  rome:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuD_rnjeBjqRfpONuaP3wYEoZtnwJKCCRKf_lLsLDcxonjMIB_UDNIjCwguBc0eZKo48Rgi033Ge_wU8OjsGEn8bCWQ2Ha2xui4UkESMU4-ciipAcXqfmRv607kj-kdNB_VHjHMbjjQVhJFRa5hAzl8u1Q8r3_Iixz88dumoJ-slsaSaUNftMnHrWopFZO_YiYNXHV-MBwTSqTlI88fTPEr2e-67L3FcX5mE1MrUPpRaO1Ts966NW0i1Ofuv81jv_-7FOVPeeMPoLyfz',
  london:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDJRKjQFogxX5zZm4p00SgCxRSrLzhB1872hJOGjEQMpVB5YjC3JyqrywrTcJ7ddFxdIyPBALRA5QeSHIRbjZ2vjAb5WrfNFBvdL4V6h-R9wXLHCCJmnKoMmbFT35pMOr5NDjJIJv_wSDe0egdUUnBd-84iHqt19jVvyCt9GdPac_vUswz4QOg9wgHj7CCPMDP57zIQpQKBP6vtalP389I2cTe11YXKPchDbnjA1ylYYp8x-aLvGA831fpswO3feZ1i5g0ZD6EmS221',
  newYork:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBs_C7MsXFrLb4y1gIJ6hjE-ZYC0kVLNys7xs0GKQwC8CH9TJJF_1hl4qx4WJRHgQKfMQ_okW8J_b2WWA-ypJO05mSV7yVe1hv2XJsVmsxvOHJ47K6YwId4DnZoFPh5sfm3oEEq5o21306OriRH_7Z1SqLCeC7AF1oDMNpPGysybkJl6mcrFAR4DAyEnvUh4KiwNCDc6Afazcal712bsZ3sWx40fbmyyHDcYVXwKas7uQPn8h9aMYIrFHmT2RnM0pUn-UnfuM3iEqF0',
  catGreece:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBGZxxbeLhA9N_gh8UGg7ewTTylv2Su124E-VH8r6HohP2cMMVtBa-5BkG1_Q80DIDvjkWuTly_xIRCbNqbAPg5WDhGDC-jykHnz1SnlIxhOWp4_gOkTtumgh8X_vDPxLWUU5VxV2H452Z8ILTcdQM7INweXONhVznbfoJo680RqgqgIvVHlrfIZsZZQSWLEZFAlOsG3-O0jn7v1FOzIZGBNohKmNJyFjF0-sCzflVsA3r2AYLNebmkTzkGAAvysrhF_xmyT0vueX7w',
  catEurope:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDc3ihuWHU74MOiTWxC2Vts_g7BlWjNqbB2gTMzOOztjnbZyNOwTYTMrIJ6agaVxNWC1xvD14IbM4LR08IK-SKZC9LX7wtrBtcxRDVCWC71CnKcPyKSNJakrwtykd9zVnDUG3tQpC7UYnNUAVVssbk1ZfFhtAVsfT708hYJ2iwEBfExf-b87cRGoYD53wG3pvlk4x_Ui8XhRcDsh0eQyKkoSd744glJ3AVzE34_Y-tom4D8BR2MCyBcdWj4oXSsaFoapKAO9Q9mAQYM',
  catExotic:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBssMRmWhZq09YmBqeOwC4GEuZbyBEOku2J5MzlYym7Iu4jrWqodUSUlHFJbY7JikhKZHV-EHmXJXOMAovDcfZvLNEcuMbGfZ1gcFGhEcAMKyOan-hSpHHfd35nqaKmiqnLwLExwNm4_zevER5G9zSQ--ATY0aRBK-Q3ISR3Csaws8qKtT13Y7C4YNnnvf61tBbSbSWao6leKJIKULI8IRsqL5HJekdcGEfjcYyyJc-aGRpeFdEWzmPCED5zlCajnZ26n6_PqXreZgV',
};

const HORIZON_CTA = { bg: '#ffb702', textColor: '#1D1D1F' };
const TRAVEL_BLUE_CTA = { bg: '#0077b6', textColor: '#ffffff' };

function cta(label, href = 'http://localhost:5173/trips', style = HORIZON_CTA) {
  return { ...newBlock('cta'), label, href, ...style };
}

function header(url, alt = 'Voyage Travel') {
  return { ...newBlock('header'), url, alt, theme: 'horizon' };
}

function text(html) {
  return { ...newBlock('text'), content: html };
}

function image(url, alt) {
  return { ...newBlock('image'), url, alt };
}

export const STITCH_TEMPLATE_CATEGORIES = [
  { id: 'all', label: 'Όλα', icon: 'apps' },
  { id: 'promotions', label: 'Προσφορές & Flash', icon: 'local_offer' },
  { id: 'destinations', label: 'Προορισμοί', icon: 'travel_explore' },
  { id: 'packages', label: 'Πακέτα ταξιδιού', icon: 'card_travel' },
  STITCH_EUROPE_CITIES_CATEGORY,
  STITCH_GREECE_PLACES_CATEGORY,
  ...STITCH_GR_EXTRA_CATEGORIES,
];

const STITCH_MARKETING_TEMPLATES = [
  {
    id: 'stitch-promo',
    category: 'promotions',
    name: 'Προσφορές',
    subtitle: 'Early Bird · Last Minute · Flash',
    thumb: THUMB.promo,
    subject: 'Early Bird -20% | Voyage Travel',
    preheader: 'Προλάβετε τις καλύτερες τιμές για καλοκαιρινές διακοπές',
    campaignName: 'Stitch — Προσφορές',
    blocks: () => [
      header(IMG.promoBeach, 'Καλοκαίρι — Voyage'),
      text(`<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7d5800;">Καλοκαίρι</p>
<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#005d90;line-height:1.25;">Early Bird -20%</h1>
<p style="margin:0;font-size:16px;line-height:1.6;color:#404850;">Προλάβετε τις καλύτερες τιμές για τις καλοκαιρινές σας διακοπές στους πιο δημοφιλείς προορισμούς.</p>`),
      cta('Κλείσε τώρα'),
      image(IMG.promoEurope, 'Last Minute Deals'),
      text(`<p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#ba1a1a;">Μόνο 3 θέσεις</p>
<h2 style="margin:0 0 8px 0;font-size:20px;color:#1b1b1d;">Last Minute Deals</h2>
<p style="margin:0;font-size:15px;color:#404850;">Απίστευτες ευκαιρίες για αποδράσεις σε μαγευτικές ευρωπαϊκές πρωτεύουσες.</p>`),
      cta('Δες προσφορές'),
      image(IMG.promoFlash, 'Flash Sale'),
      text(`<p style="margin:0 0 6px 0;font-size:12px;font-weight:700;color:#94ccff;letter-spacing:0.05em;">⏱ FLASH — 24 ΩΡΕΣ</p>
<h2 style="margin:0 0 8px 0;font-size:20px;color:#ffba27;">Flash Sale</h2>
<p style="margin:0;font-size:15px;color:#404850;">Αποκλειστικές τιμές για τις επόμενες 24 ώρες. Μην το χάσεις!</p>`),
      cta('Ανακάλυψέ τες'),
      text(`<h2 style="margin:24px 0 12px 0;font-size:18px;color:#005d90;">Περισσότερες Επιλογές</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="50%" style="padding:12px;text-align:center;background:#f6f3f5;border-radius:12px;">
<p style="margin:0;font-size:13px;font-weight:700;color:#005d90;">✈ Πτήσεις</p></td>
<td width="8"></td>
<td width="50%" style="padding:12px;text-align:center;background:#f6f3f5;border-radius:12px;">
<p style="margin:0;font-size:13px;font-weight:700;color:#266449;">🏨 Ξενοδοχεία</p></td>
</tr></table>`),
    ],
  },
  {
    id: 'stitch-domestic',
    category: 'destinations',
    name: 'Εσωτερικού',
    subtitle: 'Μετέωρα · Χανιά · Πήλιο · Ρόδος',
    thumb: THUMB.domestic,
    subject: 'Ταξίδια Εσωτερικού — Ανακαλύψτε την Ελλάδα',
    preheader: 'Μαγευτικοί προορισμοί από 95€/άτομο',
    campaignName: 'Stitch — Ταξίδια Εσωτερικού',
    blocks: () => [
      header(IMG.meteora, 'Ταξίδια Εσωτερικού — Voyage'),
      text(`<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">Ταξίδια Εσωτερικού</h1>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#404850;">Ανακαλύψτε μαγευτικούς προορισμούς στην Ελλάδα. Από βουνά μέχρι καταγάλανα νερά.</p>
<p style="margin:0 0 12px 0;font-size:12px;color:#707881;">Φίλτρα: Όλα · Δημοφιλή · Βουνό · Θάλασσα · Οικολογικά</p>
<p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#7d5800;">★ 4.9</p>
<h2 style="margin:0 0 8px 0;font-size:20px;color:#1b1b1d;">Μετέωρα</h2>
<p style="margin:0 0 8px 0;font-size:15px;color:#404850;">Επιβλητικοί βράχοι και ιστορικά μοναστήρια σε ένα τοπίο που κόβει την ανάσα.</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#005d90;">Από 120€<span style="font-size:14px;font-weight:400;color:#707881;">/άτομο</span></p>`),
      cta('Δείτε περισσότερα', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
      image(IMG.chania, 'Χανιά'),
      text(`<p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#7d5800;">★ 4.8</p>
<h2 style="margin:0 0 8px 0;font-size:20px;color:#1b1b1d;">Χανιά</h2>
<p style="margin:0 0 8px 0;font-size:15px;color:#404850;">Περιπλανηθείτε στο παλιό ενετικό λιμάνι και απολαύστε την κρητική φιλοξενία.</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#005d90;">Από 150€<span style="font-size:14px;font-weight:400;color:#707881;">/άτομο</span></p>`),
      cta('Χανιά', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
      image(IMG.pelion, 'Πήλιο'),
      text(`<p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#266449;">🌿 Φύση</p>
<h2 style="margin:0 0 8px 0;font-size:20px;color:#1b1b1d;">Πήλιο</h2>
<p style="margin:0 0 8px 0;font-size:15px;color:#404850;">Ο τέλειος συνδυασμός βουνού και θάλασσας με παραδοσιακή αρχιτεκτονική.</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#005d90;">Από 95€<span style="font-size:14px;font-weight:400;color:#707881;">/άτομο</span></p>`),
      cta('Πήλιο', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
      image(IMG.rhodes, 'Ρόδος'),
      text(`<p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#7d5800;">★ 4.7</p>
<h2 style="margin:0 0 8px 0;font-size:20px;color:#1b1b1d;">Ρόδος</h2>
<p style="margin:0 0 8px 0;font-size:15px;color:#404850;">Εξερευνήστε τη μεσαιωνική πόλη και τις ατελείωτες χρυσαφένιες παραλίες.</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#005d90;">Από 180€<span style="font-size:14px;font-weight:400;color:#707881;">/άτομο</span></p>`),
      cta('Ρόδος', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
    ],
  },
  {
    id: 'stitch-international',
    category: 'destinations',
    name: 'Εξωτερικού',
    subtitle: 'Παρίσι · Ρώμη · Λονδίνο · Νέα Υόρκη',
    thumb: THUMB.international,
    subject: 'Ταξίδια Εξωτερικού — Premium προορισμοί',
    preheader: 'Αξέχαστες εμπειρίες σε Ευρώπη & πέρα',
    campaignName: 'Stitch — Ταξίδια Εξωτερικού',
    blocks: () => [
      header(IMG.paris, 'Ταξίδια Εξωτερικού'),
      text(`<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">Ταξίδια Εξωτερικού</h1>
<p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#404850;">Ανακαλύψτε premium προορισμούς για αξέχαστες εμπειρίες.</p>
<p style="margin:0 0 16px 0;font-size:12px;color:#707881;">Ευρώπη · Αμερική · Ασία</p>
<p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#266449;">★ Κορυφαία Επιλογή</p>
<h2 style="margin:0 0 6px 0;font-size:20px;color:#1b1b1d;">Παρίσι, Γαλλία</h2>
<p style="margin:0 0 8px 0;font-size:14px;color:#707881;">5 ημέρες · Πτήσεις περιλαμβάνονται</p>
<p style="margin:0 0 8px 0;font-size:15px;color:#404850;">Ρομαντικές βόλτες στον Σηκουάνα, Λούβρο & θέα στον Άιφελ.</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#005d90;">Από 850€</p>`),
      cta('Κράτηση Παρίσι', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
      image(IMG.rome, 'Ρώμη'),
      text(`<h2 style="margin:0 0 6px 0;font-size:20px;color:#1b1b1d;">Ρώμη, Ιταλία</h2>
<p style="margin:0 0 8px 0;font-size:14px;color:#707881;">4 ημέρες · 4 αστέρια</p>
<p style="margin:0 0 8px 0;font-size:15px;color:#404850;">Ανακαλύψτε την Αιώνια Πόλη. Κολοσσαίο, Βατικανό & γραφικές πλατείες.</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#005d90;">Από 620€</p>`),
      cta('Κράτηση Ρώμη', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
      image(IMG.london, 'Λονδίνο'),
      text(`<h2 style="margin:0 0 6px 0;font-size:20px;color:#1b1b1d;">Λονδίνο, ΗΒ</h2>
<p style="margin:0 0 8px 0;font-size:14px;color:#707881;">5 ημέρες · Ξεναγήσεις</p>
<p style="margin:0 0 8px 0;font-size:15px;color:#404850;">Βρετανικό Μουσείο, West End & Oxford Street.</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#005d90;">Από 790€</p>`),
      cta('Κράτηση Λονδίνο', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
      image(IMG.newYork, 'Νέα Υόρκη'),
      text(`<p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#266449;">📈 Δημοφιλές</p>
<h2 style="margin:0 0 6px 0;font-size:20px;color:#1b1b1d;">Νέα Υόρκη, ΗΠΑ</h2>
<p style="margin:0 0 8px 0;font-size:14px;color:#707881;">8 ημέρες · Broadway</p>
<p style="margin:0 0 8px 0;font-size:15px;color:#404850;">Central Park, Times Square & Top of the Rock.</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#005d90;">Από 1.450€</p>`),
      cta('Κράτηση Νέα Υόρκη', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
    ],
  },
  {
    id: 'stitch-home',
    category: 'destinations',
    name: 'Ανακάλυψη',
    subtitle: 'Κατηγορίες · Δημοφιλείς προορισμοί',
    thumb: THUMB.home,
    subject: 'Ανακαλύψτε τον επόμενο προορισμό σας',
    preheader: 'Ελλάδα · Ευρώπη · Εξωτικά — Σαντορίνη & Μύκονος',
    campaignName: 'Stitch — Ανακάλυψη',
    blocks: () => [
      header(IMG.homeSantorini, 'Voyage — Ανακάλυψη'),
      text(`<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#005d90;">Ανακαλύψτε τον επόμενο προορισμό σας</h1>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#404850;">Premium ταξιδιωτική εμπειρία — άνεση, ασφάλεια & θέση εξασφαλισμένη.</p>
<h2 style="margin:0 0 12px 0;font-size:16px;color:#005d90;">Κατηγορίες</h2>`),
      image(IMG.catGreece, 'Ελλάδα'),
      text(`<p style="margin:-8px 0 16px 0;font-size:14px;font-weight:600;color:#005d90;">🇬🇷 Ελλάδα</p>`),
      image(IMG.catEurope, 'Ευρώπη'),
      text(`<p style="margin:-8px 0 16px 0;font-size:14px;font-weight:600;color:#005d90;">🇪🇺 Ευρώπη</p>`),
      image(IMG.catExotic, 'Εξωτικά'),
      text(`<p style="margin:-8px 0 16px 0;font-size:14px;font-weight:600;color:#005d90;">🌴 Εξωτικά</p>
<h2 style="margin:0 0 12px 0;font-size:18px;color:#005d90;">Δημοφιλείς Προορισμοί</h2>`),
      image(IMG.homeSantorini, 'Σαντορίνη'),
      text(`<p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#266449;">📈 Δημοφιλές</p>
<h2 style="margin:0 0 6px 0;font-size:20px;color:#1b1b1d;">Σαντορίνη</h2>
<p style="margin:0 0 4px 0;font-size:14px;color:#707881;">📍 Ελλάδα</p>
<p style="margin:0;font-size:20px;font-weight:700;color:#005d90;">Από 450€</p>`),
      cta('Σαντορίνη'),
      image(IMG.mykonos, 'Μύκονος'),
      text(`<h2 style="margin:0 0 6px 0;font-size:20px;color:#1b1b1d;">Μύκονος</h2>
<p style="margin:0 0 4px 0;font-size:14px;color:#707881;">📍 Ελλάδα</p>
<p style="margin:0;font-size:20px;font-weight:700;color:#005d90;">Από 520€</p>`),
      cta('Μύκονος'),
    ],
  },
  {
    id: 'stitch-santorini',
    category: 'packages',
    name: 'Πακέτο Σαντορίνη',
    subtitle: '4 ημέρες στην Οία · Premium',
    thumb: THUMB.santoriniPkg,
    subject: 'Απόδραση στη Σαντορίνη — 4 Ημέρες στην Οία',
    preheader: 'Premium πακέτο από €1.250/άτομο · VIP μεταφορές',
    campaignName: 'Stitch — Πακέτο Σαντορίνη',
    blocks: () => [
      header(IMG.santorini, 'Santorini Package — Oia'),
      text(`<p style="margin:0 0 8px 0;font-size:12px;color:#266449;font-weight:600;">✓ Premium Επιλογή · ★ 4.9 (128)</p>
<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#005d90;">Απόδραση στη Σαντορίνη: 4 Ημέρες στην Οία</h1>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#404850;">Βυθιστείτε στην εκπληκτική ομορφιά του Αιγαίου με αυτό το επιμελημένο 4ήμερο.</p>
<h2 style="margin:0 0 12px 0;font-size:18px;color:#1b1b1d;">Σημαντικά Στοιχεία</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
<tr><td width="48%" style="padding:12px;background:#f6f3f5;border-radius:12px;vertical-align:top;">
<p style="margin:0 0 4px 0;font-size:11px;color:#707881;">Διάρκεια</p>
<p style="margin:0;font-size:14px;font-weight:600;color:#1b1b1d;">4 Ημέρες, 3 Νύχτες</p></td>
<td width="4%"></td>
<td width="48%" style="padding:12px;background:#f6f3f5;border-radius:12px;vertical-align:top;">
<p style="margin:0 0 4px 0;font-size:11px;color:#707881;">Τοποθεσία</p>
<p style="margin:0;font-size:14px;font-weight:600;color:#1b1b1d;">Οία, Σαντορίνη</p></td></tr>
<tr><td colspan="3" height="8"></td></tr>
<tr><td colspan="3" style="padding:12px;background:#f6f3f5;border-radius:12px;">
<p style="margin:0 0 4px 0;font-size:11px;color:#707881;">Μεταφορικά</p>
<p style="margin:0;font-size:14px;font-weight:600;color:#1b1b1d;">VIP Μεταφορές από/προς Αεροδρόμιο</p></td></tr>
</table>`),
      text(`<h2 style="margin:0 0 12px 0;font-size:18px;color:#1b1b1d;">Το Πρόγραμμά σας</h2>
<p style="margin:0 0 12px 0;padding:12px;background:#fff;border:1px solid #e4e2e4;border-radius:12px;">
<strong style="color:#0077b6;">Ημέρα 1</strong> — Άφιξη &amp; Δείπνο στο Ηλιοβασίλεμα<br/>
<span style="font-size:14px;color:#404850;">Ιδιωτική μεταφορά στη σουίτα στην καλντέρα.</span></p>
<p style="margin:0 0 12px 0;padding:12px;background:#fff;border:1px solid #e4e2e4;border-radius:12px;">
<strong style="color:#0077b6;">Ημέρα 2</strong> — Κρουαζιέρα με Καταμαράν<br/>
<span style="font-size:14px;color:#404850;">Ηφαίστειο, θερμές πηγές &amp; Κόκκινη Παραλία.</span></p>
<p style="margin:0 0 16px 0;padding:12px;background:#fff;border:1px solid #e4e2e4;border-radius:12px;">
<strong style="color:#0077b6;">Ημέρα 3</strong> — Γευσιγνωσία Κρασιού<br/>
<span style="font-size:14px;color:#404850;">Οινοποιείο &amp; ελεύθερο απόγευμα στην Οία.</span></p>
<h2 style="margin:0 0 8px 0;font-size:18px;color:#1b1b1d;">Τι Περιλαμβάνεται</h2>
<ul style="margin:0;padding:0 0 0 18px;font-size:15px;color:#404850;line-height:1.8;">
<li>3 νύχτες σε πολυτελή σουίτα</li>
<li>Καθημερινό a la carte πρωινό</li>
<li>Μεταφορές αεροδρομίου</li>
<li>Εμπειρία ιστιοπλοΐας με καταμαράν</li>
</ul>
<p style="margin:16px 0 0 0;font-size:22px;font-weight:700;color:#005d90;">€1.250 <span style="font-size:14px;font-weight:400;color:#707881;">/ άτομο</span></p>`),
      cta('Κράτηση πακέτου'),
    ],
  },
];

export const STITCH_CAMPAIGN_TEMPLATES = [
  ...STITCH_MARKETING_TEMPLATES,
  ...STITCH_GR_TEMPLATES,
  ...STITCH_EXTRA_TEMPLATES,
  ...STITCH_MORE_TEMPLATES,
  ...STITCH_EUROPE_CITY_TEMPLATES,
  ...STITCH_GREECE_PLACE_TEMPLATES,
];

export function getStitchTemplatesByCategory(categoryId) {
  if (!categoryId || categoryId === 'all') return STITCH_CAMPAIGN_TEMPLATES;
  return STITCH_CAMPAIGN_TEMPLATES.filter((t) => t.category === categoryId);
}

export function getStitchTemplateById(id) {
  return STITCH_CAMPAIGN_TEMPLATES.find((t) => t.id === id) || null;
}

export function getStitchTemplatePreviewHtml(template, baseUrl = '') {
  const draft = applyStitchTemplate(template);
  return compileBlocksToHtml(draft.blocks, { preheader: draft.preheader, baseUrl });
}

export function applyStitchTemplate(template) {
  const raw = typeof template.blocks === 'function' ? template.blocks() : template.blocks;
  const blocks = raw.map((b) => ({
    ...b,
    id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  }));
  return {
    name: template.campaignName || template.name,
    subject: template.subject || '',
    preheader: template.preheader || '',
    blocks,
  };
}
