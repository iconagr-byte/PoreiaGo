/**
 * 15 επιπλέον πρότυπα καμπάνιας — Horizon Ethos / Voyage (ελληνικά)
 */

import { newBlock } from './campaignBlocks.js';

const THUMB = {
  promo: '/email-templates/gr_3.png',
  domestic: '/email-templates/gr_5.png',
  international: '/email-templates/gr_4.png',
  home: '/email-templates/gr_2.png',
  santorini: '/email-templates/gr_1.png',
};

const HORIZON_CTA = { bg: '#ffb702', textColor: '#1D1D1F' };
const TRAVEL_BLUE_CTA = { bg: '#0077b6', textColor: '#ffffff' };
const FLASH_CTA = { bg: '#1b1b1d', textColor: '#ffba27' };

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

const IMG = {
  promoBeach:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDglX9VvDGm6ZZwhAaoXJ5EjLHSdVWa8sQaTLQbRGABNvUT5q4bdAyUla40R-eFm7Z3Srnm7CyVsgOUO6wTF9zIChKWt2WLe4uqRBBtlYjjs8xlJ40DlgtY4UWGsAEv-XB-mJsJWVdJxcj2HIVWOpIfTXC9MLOWapEot16s_bBj_DdwbtWyumpT0MlHGbXpHlFG1v7Lo3cBO5KQv9-P1kmD04m46K0rdmBOXMUSIJLiiPQievuUGXls6zn5o8oSVigTq4S0M_1g0qK6',
  promoFlash:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBWWSZE57W5HK8VtYfnaAHZtU64nJCU1uqbk0uaT9vrllxVn0qCIuDO3SX6t06f1cWduZtRkaWFCdpdLSJhmEVLENNJSxAYUc7Fk8tCDz-slmw9LR8Kg3XXGE1Rw75B4HWxZoChxfSRB9681o1aV0nNJJ3eljKNHQDMMUaxvjjwPqLnr14eH9iX8EyJAAByC6Kp1OI8AdIL8zsN09yrnt72k4zBKTDGc7_5bQUqNbYvrPU1cStdqNO_LBhqhwHHFY0RPpTf5xh8XhWC',
  promoEurope:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuB1nChplOcmwaHvDxV6xX4rB6fRR9ddy8CVSS2rZWbNew24kQZNNLzRr9Cd3vUJj9NyAZTXvwVDAbAqCEMkwrFsGyTwrAmAed4m6sd6fFD1D6BofkGnZwc2jYG4T6G9_ql7yNTYeW--2FonMJGprwnK-ndcVaAOxhfPOdYHnUf3OMPnljzrRWUFmUw9LTNnCPbwHRc-3iPiZQ-lXEXitUSh1Eqte4ic5wvky4H5vTSRMDO57Km1INjQZm4lnJ-diokq7Y-gGrQbmK6-',
  meteora:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAFvSfwCfeI0oBTQOpHE100qMBGP_nA8HnvwzgAQnu7ajqvLe6wo1KdwaK1gvA-xsBnpw8RFu23J9Csd4Gvg3z2b5M5iywT-lCfM5Xs_-GKj3xUfRSa8fGEDVZRa_mBRNMKaPoaKR9-YwmMoQMvHsN4evqNZ_c6wfiaRFPNzQ2SvikObTnj1MSSDYQ40y1Z_ls3NO5qKl9OKppy-yUdBI01prtBad-bVQW5rqlQ2jP9TpMkAmm4rl3OIaPC_fa-Dc99l9YMuR6Dxx1N',
  santorini:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDdNas_atDYFR-1lmm_hSQWtWwPVqvSWIqKFPKPUv0hJE4aHhaadFAFE40MrKkaG740hd1mV7x0I1sjT0c5Zyq1D-lCK8as3EWUiw09dMFtx3vtxIQVktHlAsQhKJ37eP9iyxW7gp6y-bRYuI87291d3Bpmni9cv3YfWNja5CmsLidqb626Mx2NwPlasjq6QknPR7ucPpTdzLjiFAzrf87y_S9dt0Dqxpb8_XR2zu5aELWC0sI-sKeWEVpYC7B_J5CAB7ePa8gn8Bng',
  mykonos:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC_RDipq3mHUkqjJpzIXzNES__uLjFgkm5UEOEnU-2Nvxu8bLG1b0WzuPsipO-yRnFsGMf5R2uSlZUetZ8IIR8_9B-ox0K-8_fBUMU9TMdeUecC0NMW2-pBa8Ufk5Ksu64KN4a4ac3UKm7WMsU4uK-9xsePXrZ_V-y5x35CJj1l7iNvY78XCdqCsXSi_zKZpi6BOD_Jz_cr1tHNgZyT9_0g0QJLlPo9R9JLdNV6E8BpXA3VBmDsDejHO1N9b6L3OKe8eNj_x0I4WRyG',
  paris:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCev_xmkp3N4URDrL46CFzt_DjwBaDXdvBbfL-1Gp91SOQOoscyUyxJNwsigUfzwU9GVCKt28nWnHBom1QRv488g7weZVQb-4zBjU1s7TaL9MX9FdORSGJmkIEdICM_WQ_YE25ZTxhYMITkJmO-KWgnM7h5E2iwo6PuscWX4EpSJcZ18MsxZPKvLDfRrj-J7ozSUxeMJF8DcrQVosqBJNGvC20H-3gF4iLXQ-bD2mdqCnVG--vvhuNDxLpGM3__gToddQvPprGzMhul',
  rome:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuD_rnjeBjqRfpONuaP3wYEoZtnwJKCCRKf_lLsLDcxonjMIB_UDNIjCwguBc0eZKo48Rgi033Ge_wU8OjsGEn8bCWQ2Ha2xui4UkESMU4-ciipAcXqfmRv607kj-kdNB_VHjHMbjjQVhJFRa5hAzl8u1Q8r3_Iixz88dumoJ-slsaSaUNftMnHrWopFZO_YiYNXHV-MBwTSqTlI88fTPEr2e-67L3FcX5mE1MrUPpRaO1Ts966NW0i1Ofuv81jv_-7FOVPeeMPoLyfz',
  rhodes:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBNuG8Y1hIQxh2QiuquK8fMr0VBZHLn2p0D9qEyWmSJVTnwU-AncxYhTnuBBNq9LypOKB4iMcaL2WFClRmLIm_GtUx6Roc1meRSvxZWKI5dotjkyJIJob17a3-MG17zdzbjyqvyHk-32miCz_VrgiOX95pq3uN-HcB7X7CCelnE9QRikHu9oYMc_EraXUaf-B2S5zgQm0ESEsokUOIHfkR_whAMfNzhXURsJZON3GqfKdWS_XJ51JomKl3-3RMji_MITOtS54D-zE5v',
  maldives:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC7cEQZIR5AUyxKRTz9w48pzL-yZDfSvY655NVnKHxL-l_LW9jfY1MOXDsYRlhYdLjNqqNx_ZlcrxYd7rZNHhEspGbZuWa5ZMwKw2g_JyWtCcGqOiBQsAlpA_a7wpBEdYzbK0S2GQoZhrNttSwG8eSpanPI-ac2BEbsSfW8GmNrQQzxrfN4lNFtapFGuv51f7or_iTzzpBuUN8wd40IbNF7MKQTKvKbf_OK-epUCTF96TmBbRMrLWLq9xJIC3QkSYE8Pod3XKD3y9wu',
  tuscany:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCn53bbGkMZC2xrXWyDlWuZK3oCNQ-HEsPI5E2KYzD6-7bPxUuDbM3hUNXULCYeFaNlCVic8N7wpTrkvl3p5sxIavAiAWrExexsU9peUiUEjf0tgr4iNezrY93m2EfwIajZ3sSUIrgVVVMSoXYbgV1ZAaBKqbeseON1CTd8QvDUlZIXUxYQOJ9mDoqDPF9HKbqgqAzX2ScNrWmuSd9KPROzVPV2SGJWx8l8haa-T65wRN3ZWZRb0jO8xkK7HoTfgtf5JUGJkXaQCFht',
  chania:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBswKqhVgKKz86kUhDfqgTyZzKwK3LCUSCUhpTAfcztltx5yz7lTVELCqCEmkOHLKPuJcPXg5vRBjrwOMRcFWmnGhhGPT9ulodLor2LZedcxQhA0H2uYsY3H64B6SaIUvWNRjeaT-4JAjd7T-6Oxb_gTbyReAkyRmsCR42BN_lGSyeEnO1uMttkxP18uZdLIkSed9yZ9Lbr6aU_VF0wuEfacF5Bux_6KSHskfVmrok8kD66F5yVR9VJMQk9O6OfbVthJ6B38xqJkeK6',
  pelion:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAkMz7SZDBpVyJdDaZMAk2maZt1qvL9yo1Ll43X3s5PiYL2A_tfTu7iy8KHIsSsen5MpKs9z2gp3buu-7LxOZ4xzu7cWsJpZPljQ6gI7g0krdlRnYwB4V8j2nKfU92EAdw7-B8nVqokJYAzZhhcsk_oyQIF_UZytErKxP8htTBPewdcn_O48-aQjt0zAzePwh20aS8dcdVW4y3nRLL9rpml-ri_ege0QydFDQt7BAbE3_KeJrZHoKN1Rni4KPAg5pYoJ6QgwaDmmRTf',
  london:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDJRKjQFogxX5zZm4p00SgCxRSrLzhB1872hJOGjEQMpVB5YjC3JyqrywrTcJ7ddFxdIyPBALRA5QeSHIRbjZ2vjAb5WrfNFBvdL4V6h-R9wXLHCCJmnKoMmbFT35pMOr5NDjJIJv_wSDe0egdUUnBd-84iHqt19jVvyCt9GdPac_vUswz4QOg9wgHj7CCPMDP57zIQpQKBP6vtalP389I2cTe11YXKPchDbnjA1ylYYp8x-aLvGA831fpswO3feZ1i5g0ZD6EmS221',
  homeSantorini:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCKTkXo5SSKQL43tI4XhW6nPgTDiAXKnM-Jw-jNs8HV8jhXHreQ6YK95T1McLp6KIUsnd-W4yMuhgo8ZfRx9I49XNSpNO-RfHfLJo55DRRA5fm0KPjZ9Sn0_zc59NWx9M6kfXsMIW7TrZVxYHV3zJUpWMpLv2BfVjXNNEdC_YIuUW024nr9X4CJALkVA8jCL9js1YmFCGeaYyMvwaDSTLWD5pVACPG9u0ukp6vNiqjTF5sAp7_6sZp3RjFrTpQqSidoTRHsS2KgXKU4',
};

export const STITCH_EXTRA_TEMPLATES = [
  {
    id: 'stitch-extra-black-friday',
    category: 'promotions',
    name: 'Black Friday',
    subtitle: 'Έως -40% · 48 ώρες μόνο',
    thumb: THUMB.promo,
    subject: 'Black Friday — Έως -40% σε επιλεγμένες εκδρομές',
    preheader: 'Αποκλειστικές τιμές Voyage · Μην το χάσεις',
    campaignName: 'Stitch — Black Friday',
    blocks: () => [
      header(IMG.promoFlash, 'Black Friday — Voyage'),
      text(`<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#1b1b1d;">Black Friday</p>
<h1 style="margin:0 0 12px 0;font-size:28px;font-weight:700;color:#ba1a1a;line-height:1.2;">Έως -40%</h1>
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#404850;">Μόνο για 48 ώρες — premium εκδρομές σε τιμές που δεν θα ξαναδείτε.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="33%" style="padding:12px;text-align:center;background:#1b1b1d;border-radius:12px;">
<p style="margin:0;font-size:22px;font-weight:700;color:#ffba27;">-40%</p>
<p style="margin:4px 0 0 0;font-size:11px;color:#94ccff;">Ελλάδα</p></td>
<td width="4%"></td>
<td width="33%" style="padding:12px;text-align:center;background:#1b1b1d;border-radius:12px;">
<p style="margin:0;font-size:22px;font-weight:700;color:#ffba27;">-30%</p>
<p style="margin:4px 0 0 0;font-size:11px;color:#94ccff;">Ευρώπη</p></td>
<td width="4%"></td>
<td width="33%" style="padding:12px;text-align:center;background:#1b1b1d;border-radius:12px;">
<p style="margin:0;font-size:22px;font-weight:700;color:#ffba27;">-25%</p>
<p style="margin:4px 0 0 0;font-size:11px;color:#94ccff;">Πακέτα</p></td>
</tr></table>`),
      cta('Ανακάλυψε προσφορές', 'http://localhost:5173/trips', FLASH_CTA),
      image(IMG.promoEurope, 'Ευρωπαϊκές προσφορές'),
      text(`<p style="margin:0 0 6px 0;font-size:12px;font-weight:700;color:#ba1a1a;">⏱ Λήγει σε 48 ώρες</p>
<p style="margin:0;font-size:15px;color:#404850;">Παρίσι από 595€ · Ρώμη από 434€ · Λονδίνο από 553€</p>`),
      cta('Κλείσε τώρα'),
    ],
  },
  {
    id: 'stitch-extra-cyber-monday',
    category: 'promotions',
    name: 'Cyber Monday',
    subtitle: 'Online αποκλειστικά · -35%',
    thumb: THUMB.promo,
    subject: 'Cyber Monday — Online αποκλειστικές προσφορές',
    preheader: 'Μόνο μέσω web · Flash deals για 24 ώρες',
    campaignName: 'Stitch — Cyber Monday',
    blocks: () => [
      header(IMG.promoBeach, 'Cyber Monday'),
      text(`<p style="margin:0 0 8px 0;font-size:12px;font-weight:700;color:#005d90;letter-spacing:0.08em;">💻 CYBER MONDAY</p>
<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#005d90;">Online αποκλειστικά -35%</h1>
<p style="margin:0;font-size:16px;line-height:1.6;color:#404850;">Κλείστε από τον υπολογιστή ή το κινητό σας — bonus πόντοι loyalty για κάθε κράτηση.</p>`),
      cta('Δες online deals', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
      image(IMG.promoFlash, 'Flash online'),
      text(`<p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#7d5800;">🎁 +500 πόντοι loyalty</p>
<p style="margin:0;font-size:15px;color:#404850;">Ισχύει για όλες τις online κρατήσεις μέχρι τα μεσάνυχτα.</p>`),
      cta('Κράτηση τώρα', 'http://localhost:5173/trips', FLASH_CTA),
    ],
  },
  {
    id: 'stitch-extra-summer-weekend',
    category: 'promotions',
    name: 'Καλοκαιρινό Weekend',
    subtitle: '2 ημέρες · από 89€',
    thumb: THUMB.domestic,
    subject: 'Καλοκαιρινό Weekend — Απόδραση από 89€',
    preheader: 'Χανιά · Ρόδος · Πήλιο · Παραλία & φύση',
    campaignName: 'Stitch — Summer Weekend',
    blocks: () => [
      header(IMG.chania, 'Καλοκαιρινό Weekend'),
      text(`<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">Καλοκαιρινό Weekend</h1>
<p style="margin:0 0 16px 0;font-size:16px;color:#404850;">2 ημέρες απόδρασης — ιδανικό για γρήγορη ανανέωση.</p>`),
      image(IMG.rhodes, 'Ρόδος'),
      text(`<h2 style="margin:0 0 6px 0;font-size:18px;color:#1b1b1d;">Ρόδος Weekend</h2>
<p style="margin:0 0 8px 0;font-size:15px;color:#404850;">Παραλία, μεσαιωνική πόλη &amp; ηλιοβασίλεμα.</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#005d90;">Από 129€</p>`),
      cta('Ρόδος'),
      image(IMG.pelion, 'Πήλιο'),
      text(`<h2 style="margin:0 0 6px 0;font-size:18px;color:#1b1b1d;">Πήλιο Nature</h2>
<p style="margin:0 0 8px 0;font-size:15px;color:#404850;">Βουνό, θάλασσα &amp; παραδοσιακά χωριά.</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#005d90;">Από 89€</p>`),
      cta('Πήλιο'),
    ],
  },
  {
    id: 'stitch-extra-winter-early-bird',
    category: 'promotions',
    name: 'Early Bird Χειμώνας',
    subtitle: 'Κράτηση νωρίς · -25%',
    thumb: THUMB.international,
    subject: 'Early Bird Χειμώνας — Κλείστε νωρίς, εξοικονομήστε',
    preheader: 'Αλπικά · Πόλεις · Θερμές προορισμοί — έκπτωση έως 25%',
    campaignName: 'Stitch — Winter Early Bird',
    blocks: () => [
      header(IMG.paris, 'Early Bird Χειμώνας'),
      text(`<p style="margin:0 0 8px 0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#7d5800;">Early Bird</p>
<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#005d90;">Χειμερινές διακοπές -25%</h1>
<p style="margin:0;font-size:16px;line-height:1.6;color:#404850;">Κλείστε τώρα για Δεκέμβριο–Φεβρουάριο και κερδίστε έκπτωση early bird.</p>`),
      cta('Δες χειμερινούς προορισμούς'),
      image(IMG.london, 'Λονδίνο Χειμώνας'),
      text(`<h2 style="margin:0 0 8px 0;font-size:20px;color:#1b1b1d;">City Break Λονδίνο</h2>
<p style="margin:0 0 8px 0;font-size:15px;color:#404850;">Christmas markets, West End &amp; museums.</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#005d90;">Από 592€ <span style="font-size:14px;font-weight:400;text-decoration:line-through;color:#707881;">790€</span></p>`),
      cta('Κράτηση Λονδίνο', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
    ],
  },
  {
    id: 'stitch-extra-last-minute-gr',
    category: 'promotions',
    name: 'Last Minute Ελλάδα',
    subtitle: 'Αναχώρηση εντός 7 ημερών',
    thumb: THUMB.domestic,
    subject: 'Last Minute — Εκδρομές Ελλάδας εντός εβδομάδας',
    preheader: 'Μετέωρα · Σαντορίνη · Μύκονος · Περιορισμένες θέσεις',
    campaignName: 'Stitch — Last Minute GR',
    blocks: () => [
      header(IMG.meteora, 'Last Minute Ελλάδα'),
      text(`<p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#ba1a1a;">🔥 LAST MINUTE</p>
<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">Αναχώρηση εντός 7 ημερών</h1>
<p style="margin:0;font-size:16px;color:#404850;">Τελευταίες διαθέσιμες θέσεις σε δημοφιλείς ελληνικούς προορισμούς.</p>`),
      image(IMG.santorini, 'Σαντορίνη'),
      text(`<p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#ba1a1a;">Μόνο 2 θέσεις</p>
<h2 style="margin:0 0 6px 0;font-size:18px;color:#1b1b1d;">Σαντορίνη Express</h2>
<p style="margin:0;font-size:18px;font-weight:700;color:#005d90;">Από 380€</p>`),
      cta('Κλείσε τώρα'),
      image(IMG.mykonos, 'Μύκονος'),
      text(`<p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#ba1a1a;">Μόνο 4 θέσεις</p>
<h2 style="margin:0 0 6px 0;font-size:18px;color:#1b1b1d;">Μύκονος Weekend</h2>
<p style="margin:0;font-size:18px;font-weight:700;color:#005d90;">Από 420€</p>`),
      cta('Μύκονος'),
    ],
  },
  {
    id: 'stitch-extra-easter',
    category: 'promotions',
    name: 'Πασχαλινές Αποδράσεις',
    subtitle: 'Οικογενειακά πακέτα · Απρίλιος',
    thumb: THUMB.home,
    subject: 'Πασχαλινές Αποδράσεις — Οικογενειακές εκδρομές',
    preheader: 'Πήλιο · Χανιά · Μετέωρα · Ειδικές τιμές για παιδιά',
    campaignName: 'Stitch — Πάσχα',
    blocks: () => [
      header(IMG.pelion, 'Πασχαλινές Αποδράσεις'),
      text(`<p style="margin:0 0 8px 0;font-size:12px;font-weight:700;color:#266449;">🐣 ΠΑΣΧΑ 2026</p>
<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">Οικογενειακές αποδράσεις</h1>
<p style="margin:0;font-size:16px;color:#404850;">Ειδικές τιμές για παιδιά έως 12 ετών — θέση εξασφαλισμένη στο λεωφορείο.</p>`),
      image(IMG.meteora, 'Μετέωρα'),
      text(`<h2 style="margin:0 0 8px 0;font-size:18px;color:#1b1b1d;">Μετέωρα &amp; Μοναστήρια</h2>
<p style="margin:0 0 8px 0;font-size:15px;color:#404850;">4 ημέρες · Παιδί -50%</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#005d90;">Από 99€/ενήλικας</p>`),
      cta('Κράτηση Πάσχα'),
    ],
  },
  {
    id: 'stitch-extra-member-flash',
    category: 'promotions',
    name: 'VIP Flash Access',
    subtitle: 'Μόνο για μέλη · 12 ώρες',
    thumb: THUMB.promo,
    subject: 'VIP Flash — Αποκλειστική πρόσβαση για μέλη',
    preheader: '12 ώρες early access σε flash deals πριν το κοινό',
    campaignName: 'Stitch — VIP Flash',
    blocks: () => [
      text(`<p style="margin:0 0 8px 0;font-size:12px;font-weight:700;color:#7d5800;text-align:center;">⭐ GOLD MEMBERS ONLY</p>
<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#005d90;text-align:center;">VIP Flash Access</h1>
<p style="margin:0 0 20px 0;font-size:16px;color:#404850;text-align:center;">12 ώρες αποκλειστικής πρόσβασης πριν ανοίξουν οι προσφορές στο κοινό.</p>`),
      image(IMG.promoFlash, 'VIP Flash'),
      text(`<p style="margin:0 0 6px 0;font-size:12px;font-weight:700;color:#94ccff;letter-spacing:0.05em;">⏱ 12 ΩΡΕΣ</p>
<h2 style="margin:0 0 8px 0;font-size:20px;color:#ffba27;">Flash για μέλη</h2>
<p style="margin:0;font-size:15px;color:#404850;">Σαντορίνη -30% · Μαλδίβες -15% · Παρίσι -20%</p>`),
      cta('Δες VIP deals', 'http://localhost:5173/trips', FLASH_CTA),
    ],
  },
  {
    id: 'stitch-extra-price-drop',
    category: 'promotions',
    name: 'Πτώση Τιμής',
    subtitle: 'Alert · οι τιμές έπεσαν',
    thumb: THUMB.international,
    subject: 'Ειδοποίηση: Οι τιμές έπεσαν για τους αγαπημένους σας προορισμούς',
    preheader: 'Παρίσι -140€ · Ρώμη -95€ · Κλείστε πριν ανέβουν ξανά',
    campaignName: 'Stitch — Price Drop Alert',
    blocks: () => [
      text(`<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">📉 Πτώση τιμής</h1>
<p style="margin:0 0 16px 0;font-size:16px;color:#404850;">Οι τιμές για τους αποθηκευμένους προορισμούς σας μόλις έπεσαν.</p>`),
      image(IMG.paris, 'Παρίσι'),
      text(`<h2 style="margin:0 0 6px 0;font-size:18px;color:#1b1b1d;">Παρίσι</h2>
<p style="margin:0 0 8px 0;font-size:15px;color:#404850;">Ήταν 850€ — <strong style="color:#266449;">τώρα 710€</strong> (-140€)</p>`),
      cta('Κράτηση Παρίσι'),
      image(IMG.rome, 'Ρώμη'),
      text(`<h2 style="margin:0 0 6px 0;font-size:18px;color:#1b1b1d;">Ρώμη</h2>
<p style="margin:0;font-size:15px;color:#404850;">Ήταν 620€ — <strong style="color:#266449;">τώρα 525€</strong> (-95€)</p>`),
      cta('Κράτηση Ρώμη'),
    ],
  },
  {
    id: 'stitch-extra-family-pack',
    category: 'packages',
    name: 'Οικογενειακό Πακέτο',
    subtitle: '2+2 παιδιά · all-inclusive μεταφορά',
    thumb: THUMB.santorini,
    subject: 'Οικογενειακό Πακέτο — 2 ενήλικες + 2 παιδιά',
    preheader: 'Ρόδος 5 ημέρες · Θέσεις &amp; ξενοδοχείο · από 1.890€ οικογένεια',
    campaignName: 'Stitch — Family Pack',
    blocks: () => [
      header(IMG.rhodes, 'Οικογενειακό Πακέτο'),
      text(`<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">Οικογενειακό Πακέτο</h1>
<p style="margin:0 0 16px 0;font-size:16px;color:#404850;">2 ενήλικες + 2 παιδιά — μεταφορά, διαμονή &amp; ξεναγήσεις σε ένα πακέτο.</p>
<ul style="margin:0;padding:0 0 0 18px;font-size:15px;color:#404850;line-height:1.8;">
<li>Θέσεις εξασφαλισμένες στο λεωφορείο</li>
<li>4* ξενοδοχείο με πρωινό</li>
<li>Παιδικές δραστηριότητες &amp; πισίνα</li>
</ul>
<p style="margin:16px 0 0 0;font-size:22px;font-weight:700;color:#005d90;">Από 1.890€ <span style="font-size:14px;font-weight:400;color:#707881;">/ οικογένεια</span></p>`),
      cta('Δείτε πακέτο'),
    ],
  },
  {
    id: 'stitch-extra-romantic',
    category: 'packages',
    name: 'Ρομαντικό για Ζευγάρια',
    subtitle: 'Σαντορίνη · δείπνο ηλιοβασιλέματος',
    thumb: THUMB.santorini,
    subject: 'Ρομαντική απόδραση — Σαντορίνη για δύο',
    preheader: '3 νύχτες · σουίτα με θέα καλντέρα · VIP μεταφορές',
    campaignName: 'Stitch — Romantic Getaway',
    blocks: () => [
      header(IMG.santorini, 'Ρομαντικό Σαντορίνη'),
      text(`<p style="margin:0 0 8px 0;font-size:12px;font-weight:700;color:#ba1a1a;">💕 ΓΙΑ ΔΥΟ</p>
<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#005d90;">Ρομαντική Σαντορίνη</h1>
<p style="margin:0 0 16px 0;font-size:16px;color:#404850;">3 νύχτες σε σουίτα με θέα καλντέρα, δείπνο ηλιοβασιλέματος &amp; κρουαζιέρα.</p>
<p style="margin:0;font-size:22px;font-weight:700;color:#005d90;">€1.580 <span style="font-size:14px;font-weight:400;color:#707881;">/ ζευγάρι</span></p>`),
      cta('Κράτηση για δύο'),
      image(IMG.homeSantorini, 'Ηλιοβασίλεμα Οία'),
      text(`<p style="margin:0;font-size:15px;color:#404850;">Περιλαμβάνει: μεταφορές αεροδρομίου, κρουαζιέρα καταμαράν, δείπνο 5 αστέρων.</p>`),
    ],
  },
  {
    id: 'stitch-extra-cruise-aegean',
    category: 'packages',
    name: 'Κρουαζιέρα Αιγαίου',
    subtitle: '5 νησιά · 7 ημέρες',
    thumb: THUMB.home,
    subject: 'Κρουαζιέρα Αιγαίου — 5 νησιά σε 7 ημέρες',
    preheader: 'Μύκονος · Σαντορίνη · Πάρος · Νάξος · Σύρος',
    campaignName: 'Stitch — Aegean Cruise',
    blocks: () => [
      header(IMG.mykonos, 'Κρουαζιέρα Αιγαίου'),
      text(`<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">Κρουαζιέρα Αιγαίου</h1>
<p style="margin:0 0 16px 0;font-size:16px;color:#404850;">7 ημέρες · 5 ελληνικά νησιά · πλήρης διατροφή στο πλοίο.</p>
<p style="margin:0 0 8px 0;padding:10px;background:#f6f3f5;border-radius:10px;font-size:14px;">📍 Μύκονος → Σαντορίνη → Πάρος → Νάξος → Σύρος</p>
<p style="margin:0;font-size:22px;font-weight:700;color:#005d90;">Από 890€/άτομο</p>`),
      cta('Δείτε δρομολόγιο'),
      image(IMG.santorini, 'Σαντορίνη στάση'),
    ],
  },
  {
    id: 'stitch-extra-barcelona',
    category: 'destinations',
    name: 'City Break Βαρκελώνη',
    subtitle: '4 ημέρες · Gaudí &amp; παραλία',
    thumb: THUMB.international,
    subject: 'City Break Βαρκελώνη — 4 ημέρες στην Καταλονία',
    preheader: 'Sagrada Familia · Las Ramblas · Barceloneta · από 520€',
    campaignName: 'Stitch — Barcelona',
    blocks: () => [
      header(IMG.promoEurope, 'Βαρκελώνη'),
      text(`<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">City Break Βαρκελώνη</h1>
<p style="margin:0 0 12px 0;font-size:16px;color:#404850;">4 ημέρες · πτήσεις &amp; 4* ξενοδοχείο κέντρο.</p>
<p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#266449;">★ 4.8 · Δημοφιλές</p>
<p style="margin:0;font-size:18px;font-weight:700;color:#005d90;">Από 520€</p>`),
      cta('Κράτηση Βαρκελώνη', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
      text(`<p style="margin:16px 0 0 0;font-size:15px;color:#404850;">Gaudí, γαστρονομία tapas &amp; παραλία Barceloneta — όλα σε ένα ταξίδι.</p>`),
    ],
  },
  {
    id: 'stitch-extra-exotic-maldives',
    category: 'destinations',
    name: 'Εξωτικά — Μαλδίβες',
    subtitle: 'Premium resort · 7 νύχτες',
    thumb: THUMB.international,
    subject: 'Μαλδίβες — Premium απόδραση 7 νυχτών',
    preheader: 'Overwater villa · all-inclusive · από 2.490€',
    campaignName: 'Stitch — Maldives',
    blocks: () => [
      header(IMG.maldives, 'Μαλδίβες'),
      text(`<p style="margin:0 0 8px 0;font-size:12px;font-weight:700;color:#266449;">🌴 PREMIUM</p>
<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#005d90;">Μαλδίβες Retreat</h1>
<p style="margin:0 0 16px 0;font-size:16px;color:#404850;">7 νύχτες σε overwater villa — all-inclusive, μεταφορές seaplane &amp; spa.</p>
<p style="margin:0;font-size:22px;font-weight:700;color:#005d90;">Από 2.490€</p>`),
      cta('Ανακάλυψε Μαλδίβες'),
      image(IMG.tuscany, 'Luxury experience'),
      text(`<p style="margin:0;font-size:14px;color:#707881;">Περιλαμβάνει: πτήσεις, seaplane transfer, all-inclusive premium.</p>`),
    ],
  },
  {
    id: 'stitch-extra-abandoned-cart',
    category: 'transactional',
    name: 'Ημιτελής Κράτηση',
    subtitle: 'Abandoned cart reminder',
    thumb: THUMB.santorini,
    subject: 'Ξεχάσατε κάτι; Η κράτησή σας περιμένει',
    preheader: 'Σαντορίνη Villa · 2 επισκέπτες · ολοκληρώστε σε 2 λεπτά',
    campaignName: 'Stitch — Abandoned Cart',
    blocks: () => [
      text(`<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">Η κράτησή σας περιμένει</h1>
<p style="margin:0 0 20px 0;font-size:16px;color:#404850;">Ξεκινήσατε μια κράτηση αλλά δεν την ολοκληρώσατε. Οι θέσεις είναι ακόμα διαθέσιμες — προσωρινά.</p>`),
      image(IMG.santorini, 'Σαντορίνη Villa'),
      text(`<h2 style="margin:0 0 8px 0;font-size:18px;color:#1b1b1d;">Santorini Villa</h2>
<p style="margin:0 0 4px 0;font-size:14px;color:#707881;">2 επισκέπτες · 15–20 Οκτ</p>
<p style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#005d90;">€2.450</p>
<p style="margin:0;padding:12px;background:#fff8e6;border-radius:10px;font-size:13px;color:#7d5800;">⏱ Η προσφορά ισχύει για 24 ώρες</p>`),
      cta('Ολοκλήρωση κράτησης', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
    ],
  },
  {
    id: 'stitch-extra-refer-friend',
    category: 'lifecycle',
    name: 'Φέρτε έναν Φίλο',
    subtitle: 'Referral · 50€ για εσάς &amp; φίλο',
    thumb: THUMB.home,
    subject: 'Φέρτε έναν φίλο — Κερδίστε 50€ ο καθένας',
    preheader: 'Μοιραστείτε τον σύνδεσμό σας · bonus με την πρώτη κράτηση',
    campaignName: 'Stitch — Refer a Friend',
    blocks: () => [
      text(`<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#005d90;text-align:center;">Φέρτε έναν Φίλο</h1>
<p style="margin:0 0 20px 0;font-size:16px;color:#404850;text-align:center;">Μοιραστείτε τον προσωπικό σας σύνδεσμο. Όταν κλείσει ο φίλος σας, κερδίζετε <strong>50€</strong> και εκείνος <strong>50€</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="padding:16px;background:#f6f3f5;border-radius:12px;text-align:center;">
<p style="margin:0 0 8px 0;font-size:12px;color:#707881;">Ο σύνδεσμός σας</p>
<p style="margin:0;font-size:14px;font-weight:700;color:#005d90;">voyage.travel/ref/ELENA2026</p></td></tr></table>`),
      cta('Μοιράσου τώρα'),
      text(`<p style="margin:16px 0 0 0;font-size:13px;color:#707881;text-align:center;">Ισχύει για νέους πελάτες · μία ανταμοιβή ανά φίλο.</p>`),
    ],
  },
];
