/**
 * +15 πρότυπα ανά κατηγορία: Προορισμοί · Πακέτα · Transactional · Lifecycle
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
  meteora:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAFvSfwCfeI0oBTQOpHE100qMBGP_nA8HnvwzgAQnu7ajqvLe6wo1KdwaK1gvA-xsBnpw8RFu23J9Csd4Gvg3z2b5M5iywT-lCfM5Xs_-GKj3xUfRSa8fGEDVZRa_mBRNMKaPoaKR9-YwmMoQMvHsN4evqNZ_c6wfiaRFPNzQ2SvikObTnj1MSSDYQ40y1Z_ls3NO5qKl9OKppy-yUdBI01prtBad-bVQW5rqlQ2jP9TpMkAmm4rl3OIaPC_fa-Dc99l9YMuR6Dxx1N',
  chania:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBswKqhVgKKz86kUhDfqgTyZzKwK3LCUSCUhpTAfcztltx5yz7lTVELCqCEmkOHLKPuJcPXg5vRBjrwOMRcFWmnGhhGPT9ulodLor2LZedcxQhA0H2uYsY3H64B6SaIUvWNRjeaT-4JAjd7T-6Oxb_gTbyReAkyRmsCR42BN_lGSyeEnO1uMttkxP18uZdLIkSed9yZ9Lbr6aU_VF0wuEfacF5Bux_6KSHskfVmrok8kD66F5yVR9VJMQk9O6OfbVthJ6B38xqJkeK6',
  pelion:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAkMz7SZDBpVyJdDaZMAk2maZt1qvL9yo1Ll43X3s5PiYL2A_tfTu7iy8KHIsSsen5MpKs9z2gp3buu-7LxOZ4xzu7cWsJpZPljQ6gI7g0krdlRnYwB4V8j2nKfU92EAdw7-B8nVqokJYAzZhhcsk_oyQIF_UZytErKxP8htTBPewdcn_O48-aQjt0zAzePwh20aS8dcdVW4y3nRLL9rpml-ri_ege0QydFDQt7BAbE3_KeJrZHoKN1Rni4KPAg5pYoJ6QgwaDmmRTf',
  rhodes:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBNuG8Y1hIQxh2QiuquK8fMr0VBZHLn2p0D9qEyWmSJVTnwU-AncxYhTnuBBNq9LypOKB4iMcaL2WFClRmLIm_GtUx6Roc1meRSvxZWKI5dotjkyJIJob17a3-MG17zdzbjyqvyHk-32miCz_VrgiOX95pq3uN-HcB7X7CCelnE9QRikHu9oYMc_EraXUaf-B2S5zgQm0ESEsokUOIHfkR_whAMfNzhXURsJZON3GqfKdWS_XJ51JomKl3-3RMji_MITOtS54D-zE5v',
  santorini:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDdNas_atDYFR-1lmm_hSQWtWwPVqvSWIqKFPKPUv0hJE4aHhaadFAFE40MrKkaG740hd1mV7x0I1sjT0c5Zyq1D-lCK8as3EWUiw09dMFtx3vtxIQVktHlAsQhKJ37eP9iyxW7gp6y-bRYuI87291d3Bpmni9cv3YfWNja5CmsLidqb626Mx2NwPlasjq6QknPR7ucPpTdzLjiFAzrf87y_S9dt0Dqxpb8_XR2zu5aELWC0sI-sKeWEVpYC7B_J5CAB7ePa8gn8Bng',
  mykonos:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC_RDipq3mHUkqjJpzIXzNES__uLjFgkm5UEOEnU-2Nvxu8bLG1b0WzuPsipO-yRnFsGMf5R2uSlZUetZ8IIR8_9B-ox0K-8_fBUMU9TMdeUecC0NMW2-pBa8Ufk5Ksu64KN4a4ac3UKm7WMsU4uK-9xsePXrZ_V-y5x35CJj1l7iNvY78XCdqCsXSi_zKZpi6BOD_Jz_cr1tHNgZyT9_0g0QJLlPo9R9JLdNV6E8BpXA3VBmDsDejHO1N9b6L3OKe8eNj_x0I4WRyG',
  paris:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCev_xmkp3N4URDrL46CFzt_DjwBaDXdvBbfL-1Gp91SOQOoscyUyxJNwsigUfzwU9GVCKt28nWnHBom1QRv488g7weZVQb-4zBjU1s7TaL9MX9FdORSGJmkIEdICM_WQ_YE25ZTxhYMITkJmO-KWgnM7h5E2iwo6PuscWX4EpSJcZ18MsxZPKvLDfRrj-J7ozSUxeMJF8DcrQVosqBJNGvC20H-3gF4iLXQ-bD2mdqCnVG--vvhuNDxLpGM3__gToddQvPprGzMhul',
  rome:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuD_rnjeBjqRfpONuaP3wYEoZtnwJKCCRKf_lLsLDcxonjMIB_UDNIjCwguBc0eZKo48Rgi033Ge_wU8OjsGEn8bCWQ2Ha2xui4UkESMU4-ciipAcXqfmRv607kj-kdNB_VHjHMbjjQVhJFRa5hAzl8u1Q8r3_Iixz88dumoJ-slsaSaUNftMnHrWopFZO_YiYNXHV-MBwTSqTlI88fTPEr2e-67L3FcX5mE1MrUPpRaO1Ts966NW0i1Ofuv81jv_-7FOVPeeMPoLyfz',
  london:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDJRKjQFogxX5zZm4p00SgCxRSrLzhB1872hJOGjEQMpVB5YjC3JyqrywrTcJ7ddFxdIyPBALRA5QeSHIRbjZ2vjAb5WrfNFBvdL4V6h-R9wXLHCCJmnKoMmbFT35pMOr5NDjJIJv_wSDe0egdUUnBd-84iHqt19jVvyCt9GdPac_vUswz4QOg9wgHj7CCPMDP57zIQpQKBP6vtalP389I2cTe11YXKPchDbnjA1ylYYp8x-aLvGA831fpswO3feZ1i5g0ZD6EmS221',
  newYork:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBs_C7MsXFrLb4y1gIJ6hjE-ZYC0kVLNys7xs0GKQwC8CH9TJJF_1hl4qx4WJRHgQKfMQ_okW8J_b2WWA-ypJO05mSV7yVe1hv2XJsVmsxvOHJ47K6YwId4DnZoFPh5sfm3oEEq5o21306OriRH_7Z1SqLCeC7AF1oDMNpPGysybkJl6mcrFAR4DAyEnvUh4KiwNCDc6Afazcal712bsZ3sWx40fbmyyHDcYVXwKas7uQPn8h9aMYIrFHmT2RnM0pUn-UnfuM3iEqF0',
  promoEurope:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuB1nChplOcmwaHvDxV6xX4rB6fRR9ddy8CVSS2rZWbNew24kQZNNLzRr9Cd3vUJj9NyAZTXvwVDAbAqCEMkwrFsGyTwrAmAed4m6sd6fFD1D6BofkGnZwc2jYG4T6G9_ql7yNTYeW--2FonMJGprwnK-ndcVaAOxhfPOdYHnUf3OMPnljzrRWUFmUw9LTNnCPbwHRc-3iPiZQ-lXEXitUSh1Eqte4ic5wvky4H5vTSRMDO57Km1INjQZm4lnJ-diokq7Y-gGrQbmK6-',
  maldives:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC7cEQZIR5AUyxKRTz9w48pzL-yZDfSvY655NVnKHxL-l_LW9jfY1MOXDsYRlhYdLjNqqNx_ZlcrxYd7rZNHhEspGbZuWa5ZMwKw2g_JyWtCcGqOiBQsAlpA_a7wpBEdYzbK0S2GQoZhrNttSwG8eSpanPI-ac2BEbsSfW8GmNrQQzxrfN4lNFtapFGuv51f7or_iTzzpBuUN8wd40IbNF7MKQTKvKbf_OK-epUCTF96TmBbRMrLWLq9xJIC3QkSYE8Pod3XKD3y9wu',
  tuscany:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCn53bbGkMZC2xrXWyDlWuZK3oCNQ-HEsPI5E2KYzD6-7bPxUuDbM3hUNXULCYeFaNlCVic8N7wpTrkvl3p5sxIavAiAWrExexsU9peUiUEjf0tgr4iNezrY93m2EfwIajZ3sSUIrgVVVMSoXYbgV1ZAaBKqbeseON1CTd8QvDUlZIXUxYQOJ9mDoqDPF9HKbqgqAzX2ScNrWmuSd9KPROzVPV2SGJWx8l8haa-T65wRN3ZWZRb0jO8xkK7HoTfgtf5JUGJkXaQCFht',
  homeSantorini:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCKTkXo5SSKQL43tI4XhW6nPgTDiAXKnM-Jw-jNs8HV8jhXHreQ6YK95T1McLp6KIUsnd-W4yMuhgo8ZfRx9I49XNSpNO-RfHfLJo55DRRA5fm0KPjZ9Sn0_zc59NWx9M6kfXsMIW7TrZVxYHV3zJUpWMpLv2BfVjXNNEdC_YIuUW024nr9X4CJALkVA8jCL9js1YmFCGeaYyMvwaDSTLWD5pVACPG9u0ukp6vNiqjTF5sAp7_6sZp3RjFrTpQqSidoTRHsS2KgXKU4',
  catGreece:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBGZxxbeLhA9N_gh8UGg7ewTTylv2Su124E-VH8r6HohP2cMMVtBa-5BkG1_Q80DIDvjkWuTly_xIRCbNqbAPg5WDhGDC-jykHnz1SnlIxhOWp4_gOkTtumgh8X_vDPxLWUU5VxV2H452Z8ILTcdQM7INweXONhVznbfoJo680RqgqgIvVHlrfIZsZZQSWLEZFAlOsG3-O0jn7v1FOzIZGBNohKmNJyFjF0-sCzflVsA3r2AYLNebmkTzkGAAvysrhF_xmyT0vueX7w',
  catEurope:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDc3ihuWHU74MOiTWxC2Vts_g7BlWjNqbB2gTMzOOztjnbZyNOwTYTMrIJ6agaVxNWC1xvD14IbM4LR08IK-SKZC9LX7wtrBtcxRDVCWC71CnKcPyKSNJakrwtykd9zVnDUG3tQpC7UYnNUAVVssbk1ZfFhtAVsfT708hYJ2iwEBfExf-b87cRGoYD53wG3pvlk4x_Ui8XhRcDsh0eQyKkoSd744glJ3AVzE34_Y-tom4D8BR2MCyBcdWj4oXSsaFoapKAO9Q9mAQYM',
  catExotic:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBssMRmWhZq09YmBqeOwC4GEuZbyBEOku2J5MzlYym7Iu4jrWqodUSUlHFJbY7JikhKZHV-EHmXJXOMAovDcfZvLNEcuMbGfZ1gcFGhEcAMKyOan-hSpHHfd35nqaKmiqnLwLExwNm4_zevER5G9zSQ--ATY0aRBK-Q3ISR3Csaws8qKtT13Y7C4YNnnvf61tBbSbSWao6leKJIKULI8IRsqL5HJekdcGEfjcYyyJc-aGRpeFdEWzmPCED5zlCajnZ26n6_PqXreZgV',
  promoBeach:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDglX9VvDGm6ZZwhAaoXJ5EjLHSdVWa8sQaTLQbRGABNvUT5q4bdAyUla40R-eFm7Z3Srnm7CyVsgOUO6wTF9zIChKWt2WLe4uqRBBtlYjjs8xlJ40DlgtY4UWGsAEv-XB-mJsJWVdJxcj2HIVWOpIfTXC9MLOWapEot16s_bBj_DdwbtWyumpT0MlHGbXpHlFG1v7Lo3cBO5KQv9-P1kmD04m46K0rdmBOXMUSIJLiiPQievuUGXls6zn5o8oSVigTq4S0M_1g0qK6',
};

const H1 = 'margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;';
const P = 'margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#404850;';
const PRICE = 'margin:0;font-size:18px;font-weight:700;color:#005d90;';
const BADGE = 'margin:0 0 8px 0;font-size:12px;font-weight:700;color:#266449;';
const CARD = 'margin:0 0 10px 0;padding:14px;background:#f6f3f5;border-radius:12px;font-size:14px;color:#404850;';

function dest(slug, name, subtitle, subject, preheader, hero, title, intro, detail, price, ctaLabel = 'Κράτηση τώρα') {
  return {
    id: `stitch-more-dest-${slug}`,
    category: 'destinations',
    name,
    subtitle,
    thumb: THUMB.domestic,
    subject,
    preheader,
    campaignName: `Stitch — ${name}`,
    blocks: () => [
      header(hero, name),
      text(`<h1 style="${H1}">${title}</h1><p style="${P}">${intro}</p>${detail ? `<p style="${BADGE}">${detail}</p>` : ''}<p style="${PRICE}">${price}</p>`),
      cta(ctaLabel, 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
    ],
  };
}

function pack(slug, name, subtitle, subject, preheader, hero, bodyHtml, ctaLabel = 'Δείτε πακέτο') {
  return {
    id: `stitch-more-pack-${slug}`,
    category: 'packages',
    name,
    subtitle,
    thumb: THUMB.santorini,
    subject,
    preheader,
    campaignName: `Stitch — ${name}`,
    blocks: () => [header(hero, name), text(bodyHtml), cta(ctaLabel)],
  };
}

function txn(slug, name, subtitle, subject, preheader, bodyHtml, ctaLabel, blue = true) {
  return {
    id: `stitch-more-txn-${slug}`,
    category: 'transactional',
    name,
    subtitle,
    thumb: THUMB.santorini,
    subject,
    preheader,
    campaignName: `Stitch — ${name}`,
    blocks: () => [
      text(bodyHtml),
      cta(ctaLabel, 'http://localhost:5173/trips', blue ? TRAVEL_BLUE_CTA : HORIZON_CTA),
    ],
  };
}

function life(slug, name, subtitle, subject, preheader, hero, bodyHtml, ctaLabel = 'Μάθε περισσότερα') {
  const blocks = () => {
    const b = [];
    if (hero) b.push(header(hero, name));
    b.push(text(bodyHtml), cta(ctaLabel));
    return b;
  };
  return {
    id: `stitch-more-life-${slug}`,
    category: 'lifecycle',
    name,
    subtitle,
    thumb: THUMB.home,
    subject,
    preheader,
    campaignName: `Stitch — ${name}`,
    blocks,
  };
}

const DESTINATIONS_MORE = [
  dest('zakynthos', 'Ζάκυνθος', 'Ναυάγιο · παραλίες', 'Ζάκυνθος — Το Ναυάγιο & οι μπλε σπηλιές', '4 ημέρες · από 165€/άτομο', IMG.promoBeach, 'Ζάκυνθος', 'Το Ναυάγιο, οι μπλε σπηλιές και τα γραφικά χωριά της Ζακύνθου.', '★ 4.8 · Θάλασσα', 'Από 165€/άτομο'),
  dest('delphi', 'Δελφοί & Αράχωβα', 'Πολιτισμός · βουνό', 'Δελφοί & Αράχωβα — Μυθολογία & φύση', '3 ημέρες · αρχαιολογικοί χώροι', IMG.meteora, 'Δελφοί & Αράχωβα', 'Μυθικό μαντείο, μουσεία και χειμερινή Αράχωβα με θέα στον Παρνασσό.', '🏛 Πολιτισμός', 'Από 110€'),
  dest('mani', 'Μάνη', 'Πύργοι · ακρογιαλιές', 'Μάνη — Αυθεντική Πελοπόννησος', 'Πέτρινοι πύργοι & καταγάλανα νερά', IMG.pelion, 'Μάνη', 'Εξερευνήστε τους πέτρινους πύργους, τα σπήλαια και τις απομονωμένες παραλίες.', '🌊 Αυθεντική Ελλάδα', 'Από 135€'),
  dest('ioannina', 'Ιωάννινα & Μετσόβο', 'Λίμνη · χειμώνας', 'Ιωάννινα & Μετσόβο — Ήπειρος', 'Λίμνη Παμβώτιδα · χειμερινό Μετσόβο', IMG.meteora, 'Ιωάννινα & Μετσόβο', 'Καστοπολιτεία, λίμνη με νησάκι και γουρμέ Μετσόβο στα βουνά της Ηπείρου.', '⛰ Ήπειρος', 'Από 98€'),
  dest('prague', 'Πράγα', 'City break · 4 ημέρες', 'City Break Πράγα — 4 ημέρες στην Τσεχία', 'Κάρλοβι Βάρι · Κάστρο · από 390€', IMG.catEurope, 'City Break Πράγα', 'Γοτθική αρχιτεκτονική, γέφυρα Καρλόβου & ζωντανή νυχτερινή ζωή.', '★ 4.9 · Δημοφιλές', 'Από 390€'),
  dest('vienna', 'Βιέννη', 'Μουσική · αυτοκρατορία', 'Βιέννη — Αυτοκρατορική πολιτεία', '5 ημέρες · Σάλτσμπουργκ optional', IMG.promoEurope, 'Βιέννη', 'Σχενμπρούν, Όπερα, καφέ πολιτισμός και προαιρετική εκδρομή Σάλτσμπουργκ.', '🇦🇹 Κλασική Ευρώπη', 'Από 580€'),
  dest('amsterdam', 'Άμστερνταμ', 'Κανάλια · μουσεία', 'Άμστερνταμ — Κανάλια & Van Gogh', '4 ημέρες · ποδήλατο & μουσεία', IMG.london, 'Άμστερνταμ', 'Κανάλια, Anne Frank House, Rijksmuseum και χαλαρή ατμόσφαιρα.', '🚲 City break', 'Από 510€'),
  dest('berlin', 'Βερολίνο', 'Ιστορία · street art', 'Βερολίνο — Σύγχρονη ευρωπαϊκή πρωτεύουσα', '5 ημέρες · Brandenburg & East Side Gallery', IMG.promoEurope, 'Βερολίνο', 'Τείχος, Brandenburg Gate, μουσεία και ζωντανή νυχτερινή σκηνή.', '🏙 Urban', 'Από 540€'),
  dest('madrid', 'Μαδρίτη', 'Tapas · Prado', 'Μαδρίτη — Τέχνη & γαστρονομία', '4 ημέρες · Royal Palace & Retiro', IMG.rome, 'Μαδρίτη', 'Prado, tapas bars, βασιλικό παλάτι και ζωντανές πλατείες.', '🇪🇸 Ισπανία', 'Από 480€'),
  dest('lisbon', 'Λισαβόνα', 'Τραμ · Ατλαντικός', 'Λισαβόνα — Ατλαντική πόλη', '5 ημέρες · Belém & Sintra', IMG.paris, 'Λισαβόνα', 'Ποδηλατόδρομοι τραμ, Belém, Sintra και θέα στον Ατλαντικό.', '★ 4.7', 'Από 460€'),
  dest('dubai', 'Ντουμπάι', 'Premium · έρημος', 'Ντουμπάι — Πολυτέλεια & έρημος', '6 ημέρες · Burj Khalifa & safari', IMG.catExotic, 'Ντουμπάι', 'Ουρανοξύστες, σαφάρι στην έρημο, εμπορικά κέντρα & παραλίες.', '🌴 Premium', 'Από 1.290€'),
  dest('tokyo', 'Τόκιο', 'Ιαπωνία · πολιτισμός', 'Τόκιο — Ανατολική μεγαλούπολη', '8 ημέρες · Shibuya & Kyoto extension', IMG.newYork, 'Τόκιο', 'Shibuya, ιερούς, σούσι & σύγχρονη ιαπωνική κουλτούρα.', '🇯🇵 Bucket list', 'Από 1.890€'),
  dest('edinburgh', 'Εδιμβούργο', 'Σκωτία · κάστρα', 'Εδιμβούργο — Μεσαιωνική Σκωτία', '4 ημέρες · Edinburgh Castle', IMG.london, 'Εδιμβούργο', 'Κάστρο, Royal Mile, Highlands day trip και ουiski εμπειρία.', '🏰 Σκωτία', 'Από 620€'),
  dest('norway', 'Νορβηγία Φιορδ', 'Φύση · κρουαζιέρα', 'Νορβηγία — Φιορδ & Βόρειο Σέλας', '7 ημέρες · fjord cruise', IMG.catExotic, 'Νορβηγία Φιορδ', 'Κρουαζιέρα στα φιορδ, Bergen, και πιθανό Northern Lights.', '🌌 Φύση', 'Από 1.650€'),
  dest('crete', 'Κρήτη Ολόκληρη', 'Ηράκλειο · Χανιά · Ρέθυμνο', 'Κρήτη — Από Χανιά έως Ηράκλειο', '6 ημέρες · παραλίες & φαράγγια', IMG.chania, 'Κρήτη', 'Σαμαριά, ενετικά λιμάνια, Knossos και κρητική κουζίνα.', '🇬🇷 Νησί #1', 'Από 175€'),
];

const PACKAGES_MORE = [
  pack('meteora-3d', 'Μετέωρα 3ήμερο', 'Μοναστήρια · ηλιοβασίλεμα', 'Πακέτο Μετέωρα — 3 ημέρες', 'Ξενοδοχείο · ξεναγήσεις · μεταφορές', IMG.meteora,
    `<h1 style="${H1}">Μετέωρα 3ήμερο</h1><p style="${P}">Μοναστήρια, ηλιοβασίλεμα &amp; ξενάγηση στους βράχους.</p>
<ul style="margin:0;padding:0 0 0 18px;font-size:15px;color:#404850;line-height:1.8;"><li>2 νύχτες 3* ξενοδοχείο</li><li>Μεταφορά λεωφορείου</li><li>Ξενάγηση μοναστηριών</li></ul>
<p style="margin:16px 0 0 0;font-size:22px;font-weight:700;color:#005d90;">Από 220€</p>`),
  pack('cyclades-combo', 'Κυκλάδες Combo', 'Μύκονος + Σαντορίνη', 'Πακέτο Κυκλάδες — 6 ημέρες', '2 νησιά · μεταφορές · ξενοδοχεία', IMG.mykonos,
    `<h1 style="${H1}">Κυκλάδες Combo</h1><p style="${P}">Μύκονος &amp; Σαντορίνη σε ένα πακέτο — 6 ημέρες, 5 νύχτες.</p>
<p style="${PRICE}">Από 780€/άτομο</p>`),
  pack('epirus-adv', 'Ήπειρος Adventure', 'Ράφτινγκ · πεζοπορία', 'Ήπειρος Adventure — Φύση & δράση', '5 ημέρες · Voidomatis & Zagori', IMG.meteora,
    `<h1 style="${H1}">Ήπειρος Adventure</h1><p style="${P}">Πεζοπορία στα Ζαγοροχώρια, ράφτινγκ στον Βοϊδομάτη &amp; τοπική κουζίνα.</p>
<p style="${PRICE}">Από 340€</p>`),
  pack('ski-parnassos', 'Ski Πάρνασσος', 'Χειμερινό · 4 ημέρες', 'Ski Πάρνασσος — Χειμερινό πακέτο', 'Εξοπλισμός · μαθήματα · διαμονή', IMG.pelion,
    `<h1 style="${H1}">Ski Πάρνασσος</h1><p style="${P}">4 ημέρες στο χιονοδρομικό κέντρο — lift pass, ενοικίαση εξοπλισμού &amp; διαμονή.</p>
<p style="${PRICE}">Από 290€</p>`),
  pack('wellness', 'Wellness & Spa', 'Ροδόπη · 3 νύχτες', 'Wellness Retreat — Ρόδες & spa', 'All-inclusive spa · yoga', IMG.rhodes,
    `<h1 style="${H1}">Wellness &amp; Spa</h1><p style="${P}">3 νύχτες σε spa resort — μασάζ, yoga, healthy dining &amp; χαλάρωση.</p>
<p style="${PRICE}">Από 420€</p>`),
  pack('gourmet-tuscany', 'Gourmet Τοσκάνη', 'Κρασί · μαγειρική', 'Gourmet Τοσκάνη — 5 ημέρες', 'Οινοποιεία · cooking class', IMG.tuscany,
    `<h1 style="${H1}">Gourmet Τοσκάνη</h1><p style="${P}">Wine tours, cooking class &amp; γεύματα σε αγροτικές villa.</p>
<p style="${PRICE}">Από 890€</p>`),
  pack('adriatic-cruise', 'Κρουαζιέρα Αδριατική', 'Βενετία · Δουβλίνο', 'Κρουαζιέρα Αδριατική — 7 ημέρες', '5 λιμάνια · πλήρης διατροφή', IMG.promoEurope,
    `<h1 style="${H1}">Κρουαζιέρα Αδριατική</h1><p style="${P}">Βενετία, Δουβλίνο, Κορφού, Μύκονος, Σαντορίνη — 7 ημέρες all-inclusive.</p>
<p style="${PRICE}">Από 950€</p>`),
  pack('safari', 'Safari Αφρική', 'Κένυα · 8 ημέρες', 'Safari Αφρική — Big Five', 'Luxury lodge · game drives', IMG.catExotic,
    `<h1 style="${H1}">Safari Αφρική</h1><p style="${P}">8 ημέρες στην Κένυα — game drives, luxury lodge &amp; Masai Mara.</p>
<p style="${PRICE}">Από 2.890€</p>`),
  pack('cairo', 'Πυραμίδες & Κάιρο', 'Αίγυπτος · 6 ημέρες', 'Πακέτο Αίγυπτος — Πυραμίδες & Κάιρο', 'Ξεναγός · Nile cruise', IMG.catExotic,
    `<h1 style="${H1}">Πυραμίδες &amp; Κάιρο</h1><p style="${P}">Giza, Egyptian Museum, Nile dinner cruise &amp; παραδοσιακή αγορά.</p>
<p style="${PRICE}">Από 780€</p>`),
  pack('bali-honeymoon', 'Bali Honeymoon', 'Μήνας μέλιτος', 'Bali Honeymoon — 10 ημέρες', 'Villa · spa · private tours', IMG.maldives,
    `<h1 style="${H1}">Bali Honeymoon</h1><p style="${P}">10 ημέρες σε private villa — spa, rice terraces &amp; sunset dinners.</p>
<p style="${PRICE}">Από 1.980€/ζευγάρι</p>`),
  pack('interrail', 'Interrail Ευρώπη', '15 ημέρες · 5 πόλεις', 'Interrail — 5 ευρωπαϊκές πόλεις', 'Eurail pass · hostels 4*', IMG.catEurope,
    `<h1 style="${H1}">Interrail Ευρώπη</h1><p style="${P}">15 ημέρες — Παρίσι, Βρυξέλλες, Άμστερνταμ, Βερολίνο, Πράγα με Eurail pass.</p>
<p style="${PRICE}">Από 1.150€</p>`),
  pack('wine-naousa', 'Wine Tour Νάουσα', 'Οινοποιεία · 2 ημέρες', 'Wine Tour Νάουσα — Βόρεια Ελλάδα', '5 οινοποιεία · γευσιγνωσία', IMG.tuscany,
    `<h1 style="${H1}">Wine Tour Νάουσα</h1><p style="${P}">2 ημέρες — 5 οινοποιεία, γευσιγνωσία &amp; τοπική κουζίνα στη Βόρεια Ελλάδα.</p>
<p style="${PRICE}">Από 180€</p>`),
  pack('olympus-hike', 'Ορειβασία Όλυμπος', 'Κορυφή · 3 ημέρες', 'Όλυμπος — Ορειβατικό πακέτο', 'Οδηγός · refuge διαμονή', IMG.pelion,
    `<h1 style="${H1}">Ορειβασία Όλυμπος</h1><p style="${P}">3 ημέρες με οδηγό — Prionia, refuge διαμονή &amp; κορυφή Mytikas (optional).</p>
<p style="${PRICE}">Από 195€</p>`),
  pack('diving-zante', 'Diving Ζάκυνθος', 'Κατάδυση · 4 ημέρες', 'Diving Ζάκυνθος — Underwater', 'PADI · ναυάγιο dive', IMG.promoBeach,
    `<h1 style="${H1}">Diving Ζάκυνθος</h1><p style="${P}">4 ημέρες — 6 καταδύσεις, ναυάγιο site &amp; PADI instructor.</p>
<p style="${PRICE}">Από 320€</p>`),
  pack('aegean-islands', 'Νησιωτικό Pass', '3 νησιά · 8 ημέρες', 'Aegean Island Pass — 3 νησιά', 'Ferry pass · ξενοδοχεία', IMG.santorini,
    `<h1 style="${H1}">Νησιωτικό Pass</h1><p style="${P}">8 ημέρες — Νάξος, Πάρος, Σαντορίνη με ferry pass &amp; 3* ξενοδοχεία.</p>
<p style="${PRICE}">Από 640€</p>`),
];

const TRANSACTIONAL_MORE = [
  txn('payment-ok', 'Επιβεβαίωση Πληρωμής', 'Payment received', 'Η πληρωμή σας καταχωρήθηκε επιτυχώς', 'Απόδειξη #PAY-2026-8842 · Σαντορίνη Villa',
    `<p style="margin:0 0 8px 0;font-size:48px;text-align:center;color:#266449;">✓</p>
<h1 style="${H1}text-align:center;">Πληρωμή Επιτυχής</h1>
<p style="${P}text-align:center;">Λάβαμε την πληρωμή σας €2.450 για <strong>Santorini Villa</strong>.</p>
<p style="${CARD}"><strong>Απόδειξη:</strong> #PAY-2026-8842<br/><strong>Ημερομηνία:</strong> 15 Μαρ 2026<br/><strong>Μέθοδος:</strong> Visa ·••• 4242</p>`,
    'Λήψη απόδειξης'),
  txn('invoice', 'Τιμολόγιο', 'Invoice PDF', 'Το τιμολόγιό σας — Voyage Travel', 'PDF επισύναψη · #INV-2026-1204',
    `<h1 style="${H1}">Τιμολόγιο</h1>
<p style="${P}">Σας αποστέλλουμε το τιμολόγιο για την κράτησή σας.</p>
<p style="${CARD}"><strong>Αριθμός:</strong> #INV-2026-1204<br/><strong>Ποσό:</strong> €2.450<br/><strong>ΦΠΑ:</strong> 24%</p>`,
    'Λήψη PDF'),
  txn('cancel', 'Ακύρωση Κράτησης', 'Booking cancelled', 'Η κράτησή σας ακυρώθηκε', 'Επιστροφή €2.100 εντός 5 εργάσιμων · #VYG-9824',
    `<h1 style="${H1}">Ακύρωση Κράτησης</h1>
<p style="${P}">Η κράτηση <strong>#VYG-9824-FR</strong> ακυρώθηκε σύμφωνα με την πολιτική ακυρώσεων.</p>
<p style="${CARD}"><strong>Επιστροφή:</strong> €2.100<br/><strong>Χρόνος:</strong> 3–5 εργάσιμες</p>`,
    'Δείτε πολιτική ακυρώσεων', false),
  txn('modify', 'Τροποποίηση Κράτησης', 'Booking modified', 'Η κράτησή σας ενημερώθηκε', 'Νέες ημερομηνίες 20–25 Οκτ · #VYG-9824',
    `<h1 style="${H1}">Τροποποίηση Κράτησης</h1>
<p style="${P}">Οι ημερομηνίες της κράτησής σας ενημερώθηκαν.</p>
<p style="${CARD}"><strong>Παλιές:</strong> 12–18 Οκτ<br/><strong>Νέες:</strong> 20–25 Οκτ<br/><strong>Κωδικός:</strong> #VYG-9824-FR</p>`,
    'Δείτε ενημερωμένο δρομολόγιο'),
  txn('remind-7d', 'Υπενθύμιση 7 ημέρες', 'Trip in 7 days', 'Το ταξίδι σας σε 7 ημέρες — Παρίσι', 'Checklist · καιρός · meeting point',
    `<h1 style="${H1}">Το ταξίδι σας πλησιάζει!</h1>
<p style="${P}">Σε <strong>7 ημέρες</strong> ξεκινά η εκδρομή σας στο <strong>Παρίσι</strong>.</p>
<p style="${CARD}">📍 Meeting point: Σταθμός Αθήνας, πύλη 3 · 06:30<br/>🧳 Checklist: ταυτότητα, voucher, κινητό</p>`,
    'Δείτε δρομολόγιο'),
  txn('remind-24h', 'Υπενθύμιση 24 ώρες', 'Trip tomorrow', 'Αύριο ξεκινάει η εκδρομή σας!', 'Παρίσι · Gate 3 · 06:30 · θυμηθείτε τα έγγραφα',
    `<p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#ba1a1a;text-align:center;">⏰ ΑΥΡΙΟ</p>
<h1 style="${H1}text-align:center;">Η εκδρομή ξεκινά!</h1>
<p style="${P}text-align:center;">Παρίσι · Αναχώρηση 06:30 · Σταθμός Αθήνας, πύλη 3</p>`,
    'QR εισιτηρίου'),
  txn('tickets', 'Αποστολή Εισιτηρίων', 'E-tickets & QR', 'Τα εισιτήριά σας είναι έτοιμα', 'QR boarding · seat 14A · #VYG-9824',
    `<h1 style="${H1}">Τα εισιτήριά σας</h1>
<p style="${P}">Συνημμένα τα ηλεκτρονικά εισιτήρια για την εκδρομή <strong>#VYG-9824</strong>.</p>
<p style="${CARD}"><strong>Θέση:</strong> 14A<br/><strong>Επιβίβαση:</strong> 06:00<br/><strong>QR:</strong> Σαρώστε στο λεωφορείο</p>`,
    'Προβολή εισιτηρίων'),
  txn('refund', 'Επιστροφή Χρημάτων', 'Refund processed', 'Η επιστροφή χρημάτων ολοκληρώθηκε', '€2.100 στον λογαριασμό σας · 3–5 ημέρες',
    `<p style="margin:0 0 8px 0;font-size:48px;text-align:center;color:#266449;">✓</p>
<h1 style="${H1}text-align:center;">Επιστροφή Χρημάτων</h1>
<p style="${P}text-align:center;">Η επιστροφή <strong>€2.100</strong> καταχωρήθηκε. Θα εμφανιστεί σε 3–5 εργάσιμες.</p>`,
    'Επικοινωνία'),
  txn('payment-fail', 'Αποτυχία Πληρωμής', 'Payment failed', 'Η πληρωμή δεν ολοκληρώθηκε', 'Δοκιμάστε ξανά ή αλλάξτε κάρτα · Santorini Villa',
    `<p style="margin:0 0 8px 0;font-size:48px;text-align:center;color:#ba1a1a;">✗</p>
<h1 style="${H1}text-align:center;">Αποτυχία Πληρωμής</h1>
<p style="${P}text-align:center;">Η πληρωμή €2.450 δεν ολοκληρώθηκε. Οι θέσεις παραμένουν δεσμευμένες για 2 ώρες.</p>`,
    'Δοκιμή ξανά'),
  txn('waitlist', 'Λίστα Αναμονής', 'Waitlist confirmed', 'Μπήκατε στη λίστα αναμονής — Μύκονος', 'Θα ειδοποιηθείτε αν ανοίξει θέση',
    `<h1 style="${H1}">Λίστα Αναμονής</h1>
<p style="${P}">Η εκδρομή <strong>Μύκονος Weekend</strong> είναι πλήρης. Προστέθηκατε στη λίστα αναμονής.</p>
<p style="${CARD}">Θα λάβετε email αν ανοίξει θέση — συνήθως εντός 48 ωρών.</p>`,
    'Δείτε εναλλακτικές'),
  txn('schedule-change', 'Αλλαγή Δρομολογίου', 'Schedule update', 'Σημαντική αλλαγή δρομολογίου', 'Νέα ώρα αναχώρησης 07:00 · Παρίσι',
    `<p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#ba1a1a;">⚠ ΣΗΜΑΝΤΙΚΗ ΕΝΗΜΕΡΩΣΗ</p>
<h1 style="${H1}">Αλλαγή Δρομολογίου</h1>
<p style="${P}">Η ώρα αναχώρησης για <strong>Παρίσι</strong> άλλαξε από 06:30 σε <strong>07:00</strong>.</p>`,
    'Επιβεβαίωση λήψης'),
  txn('insurance', 'Ασφάλεια Ταξιδιού', 'Insurance purchased', 'Η ασφάλεια ταξιδιού σας ενεργοποιήθηκε', 'Policy #INS-2026-4421 · κάλυψη έως €50.000',
    `<h1 style="${H1}">Ασφάλεια Ταξιδιού</h1>
<p style="${P}">Η ταξιδιωτική ασφάλειά σας ενεργοποιήθηκε για την εκδρομή <strong>Παρίσι</strong>.</p>
<p style="${CARD}"><strong>Policy:</strong> #INS-2026-4421<br/><strong>Κάλυψη:</strong> Ιατρική έως €50.000<br/><strong>Ακύρωση:</strong> Ναι</p>`,
    'Λήψη policy'),
  txn('voucher', 'Voucher PDF', 'Travel voucher', 'Το voucher ταξιδιού σας', 'PDF για εκτύπωση · #VYG-9824',
    `<h1 style="${H1}">Voucher Ταξιδιού</h1>
<p style="${P}">Το voucher για την κράτησή σας είναι έτοιμο για εκτύπωση ή αποθήκευση στο κινητό.</p>`,
    'Λήψη voucher PDF'),
  txn('otp', 'Επιβεβαίωση Email', 'Email verification', 'Επιβεβαιώστε το email σας — Voyage', 'Κωδικός 6 ψηφίων · ισχύει 15 λεπτά',
    `<h1 style="${H1}">Επιβεβαίωση Email</h1>
<p style="${P}">Χρησιμοποιήστε τον κωδικό παρακάτω ή πατήστε το κουμπί για επιβεβαίωση.</p>
<p style="margin:0 0 16px 0;padding:16px;background:#f6f3f5;border-radius:12px;font-size:28px;font-weight:700;letter-spacing:8px;text-align:center;color:#005d90;">482916</p>`,
    'Επιβεβαίωση τώρα'),
  txn('seat-assigned', 'Ανάθεση Θέσης', 'Seat assignment', 'Η θέση σας ορίστηκε — 14A', 'Παράθυρο · λεωφορείο #BT-4021',
    `<h1 style="${H1}">Ανάθεση Θέσης</h1>
<p style="${P}">Η θέση σας για την εκδρομή <strong>Μετέωρα</strong> ορίστηκε.</p>
<p style="${CARD}"><strong>Θέση:</strong> 14A (παράθυρο)<br/><strong>Λεωφορείο:</strong> #BT-4021<br/><strong>Όροφος:</strong> 1</p>`,
    'Αλλαγή θέσης'),
];

const LIFECYCLE_MORE = [
  life('newsletter', 'Μηνιαίο Newsletter', 'Tips · ιστορίες · προσφορές', 'Voyage Monthly — Ιδέες ταξιδιού Μαρτίου', 'Νέοι προορισμοί · editor picks · -15% Ελλάδα', IMG.homeSantorini,
    `<h1 style="${H1}">Voyage Monthly</h1><p style="${P}">Οι καλύτερες ιδέες, ιστορίες &amp; προσφορές του μήνα.</p>
<p style="${CARD}"><strong>Νέος προορισμός:</strong> Πράγα από 390€</p>
<p style="${CARD}"><strong>Travel tip:</strong> Τι να πακάρετε για 5ήμερη εκδρομή</p>
<p style="margin:0;padding:12px;background:#fff8e6;border-radius:10px;font-size:14px;color:#7d5800;"><strong>Προσφορά:</strong> -15% Ελλάδα</p>`,
    'Διάβασε περισσότερα'),
  life('birthday', 'Γενέθλια', 'Birthday offer', 'Χρόνια πολλά! Δώρο 30€ για εσάς', 'Κουπόνι BDAY30 · ισχύει 30 ημέρες', null,
    `<p style="margin:0 0 8px 0;font-size:40px;text-align:center;">🎂</p>
<h1 style="${H1}text-align:center;">Χρόνια Πολλά!</h1>
<p style="${P}text-align:center;">Σας χαρίζουμε <strong>30€</strong> για την επόμενη εκδρομή σας.</p>
<p style="margin:0;padding:14px;background:#fff8e6;border-radius:12px;font-size:16px;font-weight:700;text-align:center;color:#7d5800;">BDAY30</p>`,
    'Χρησιμοποίησε κουπόνι'),
  life('anniversary', 'Επέτειος Μέλους', 'Member anniversary', '2 χρόνια μαζί — ευχαριστούμε!', 'Bonus 200 πόντοι · exclusive offer', IMG.homeSantorini,
    `<h1 style="${H1}">2 Χρόνια Μαζί!</h1>
<p style="${P}">Γιορτάζουμε την επέτειό σας ως μέλος Voyage — σας χαρίζουμε <strong>200 πόντοι</strong>.</p>`,
    'Δείτε προνόμια'),
  life('winback', 'Σας Λείπουμε', 'Win-back inactive', 'Σας λείπουμε — επιστρέψτε με -20%', 'Μόνο για εσάς · 14 ημέρες', null,
    `<h1 style="${H1}">Σας Λείπουμε!</h1>
<p style="${P}">Έχει περάσει καιρός από το τελευταίο σας ταξίδι. Επιστρέψτε με <strong>-20%</strong> στην επόμενη κράτηση.</p>
<p style="margin:0;padding:12px;background:#eef2ff;border-radius:10px;font-size:14px;color:#404850;">Κωδικός: <strong>COMEBACK20</strong> · ισχύει 14 ημέρες</p>`,
    'Κράτηση τώρα'),
  life('thank-you', 'Ευχαριστούμε', 'Post-trip thank you', 'Ευχαριστούμε που ταξιδέψατε μαζί μας', 'Μετέωρα · ελπίζουμε να σας αρέσει η εμπειρία', IMG.meteora,
    `<h1 style="${H1}">Ευχαριστούμε!</h1>
<p style="${P}">Ελπίζουμε να απολαύσατε την εκδρομή σας στα <strong>Μετέωρα</strong>. Θα χαρούμε να σας δούμε ξανά σύντομα.</p>`,
    'Κράτησε ξανά'),
  life('nps', 'Έρευνα NPS', 'Net Promoter Score', 'Πόσο πιθανό είναι να μας συστήσετε;', '1 ερώτηση · 30 δευτερόλεπτα', null,
    `<h1 style="${H1}">Η γνώμη σας μετράει</h1>
<p style="${P}">Πόσο πιθανό είναι να συστήσετε το Voyage σε φίλο; (0–10)</p>
<p style="margin:0;font-size:22px;letter-spacing:6px;text-align:center;color:#005d90;">0 1 2 3 4 5 6 7 8 9 10</p>`,
    'Απάντηση τώρα'),
  life('tier-upgrade', 'Αναβάθμιση Tier', 'Loyalty upgrade', 'Συγχαρητήρια! Αναβαθμιστήκατε σε Gold', 'Νέα προνόμια · priority support', null,
    `<p style="margin:0 0 8px 0;font-size:40px;text-align:center;">⭐</p>
<h1 style="${H1}text-align:center;">Gold Member!</h1>
<p style="${P}text-align:center;">Αναβαθμιστήκατε σε <strong>Gold</strong> — αποκλειστικές προσφορές &amp; priority support.</p>`,
    'Δείτε προνόμια'),
  life('points-expire', 'Λήξη Πόντων', 'Points expiration', 'Οι πόντοι σας λήγουν σε 30 ημέρες', '850 πόντοι · αξία ~42€',
    `<h1 style="${H1}">Λήξη Πόντων</h1>
<p style="${P}">Έχετε <strong>850 πόντοι</strong> που λήγουν σε 30 ημέρες. Μην τους χάσετε!</p>`,
    'Εξαργύρωση πόντων'),
  life('prefs', 'Ενημέρωση Προτιμήσεων', 'Seasonal preferences', 'Τι είδους ταξίδι σας ενδιαφέρει φέτος;', 'Θάλασσα · βουνό · πόλη · οικογένεια', null,
    `<h1 style="${H1}">Οι προτιμήσεις σας</h1>
<p style="${P}">Ενημερώστε τις ταξιδιωτικές σας προτιμήσεις για πιο σχετικές προσφορές.</p>
<p style="${CARD}">🏖 Θάλασσα &amp; παραλία</p>
<p style="${CARD}">⛰ Βουνό &amp; φύση</p>
<p style="${CARD}">🏙 City breaks</p>`,
    'Ενημέρωση προτιμήσεων'),
  life('app-download', 'Κατέβασε την App', 'Mobile app', 'Ταξιδέψτε smarter — κατέβασε το Voyage app', 'E-tickets · live tracking · chat support', null,
    `<h1 style="${H1}">Voyage App</h1>
<p style="${P}">Εισιτήρια, live tracking λεωφορείου &amp; chat υποστήριξης — όλα στο κινητό σας.</p>`,
    'Λήψη app'),
  life('social', 'Ακολούθησέ μας', 'Social media', 'Μπείτε στην κοινότητα Voyage', 'Instagram · Facebook · TikTok', IMG.promoBeach,
    `<h1 style="${H1}">Ακολούθησέ μας</h1>
<p style="${P}">Ιστορίες ταξιδιών, tips &amp; αποκλειστικές προσφορές στα social μας.</p>`,
    'Instagram'),
  life('insurance-upsell', 'Ασφάλεια Upsell', 'Pre-trip insurance', 'Προστατέψτε το ταξίδι σας', 'Ιατρική κάλυψη · ακύρωση · από 29€', null,
    `<h1 style="${H1}">Ασφάλεια Ταξιδιού</h1>
<p style="${P}">Προσθέστε ταξιδιωτική ασφάλεια στην κράτησή σας — ιατρική κάλυψη &amp; ακύρωση από <strong>29€</strong>.</p>`,
    'Προσθήκη ασφάλειας'),
  life('packing', 'Checklist Αποσκευών', 'Packing list', 'Τι να πάρετε μαζί σας — Μετέωρα', 'Smart packing για 4ήμερη εκδρομή', IMG.meteora,
    `<h1 style="${H1}">Smart Packing</h1>
<p style="${P}">Checklist για την εκδρομή <strong>Μετέωρα</strong> — 4 ημέρες.</p>
<ul style="margin:0;padding:0 0 0 18px;font-size:15px;color:#404850;line-height:1.8;">
<li>Άνετα παπούτσια πεζοπορίας</li><li>Μπουφάν (βράχος ψυχρός)</li><li>Αναλώσιμα &amp; power bank</li><li>Ταυτότητα &amp; voucher</li></ul>`,
    'Πλήρης λίστα'),
  life('photo-contest', 'Διαγωνισμός Φωτογραφίας', 'Photo contest', 'Μοιραστείτε τη φωτό σας — κερδίστε 200€', 'Hashtag #VoyageMoments · λήξη 30 Απρ',
    `<h1 style="${H1}">Διαγωνισμός Φωτογραφίας</h1>
<p style="${P}">Ανεβάστε την καλύτερη φωτογραφία από το ταξίδι σας με <strong>#VoyageMoments</strong> — κερδίστε voucher 200€.</p>`,
    'Συμμετοχή'),
  life('gdpr', 'Ενημέρωση GDPR', 'Consent renewal', 'Ενημερώστε τις προτιμήσεις απορρήτου σας', 'Newsletter · analytics · personalization', null,
    `<h1 style="${H1}">Απόρρητο &amp; GDPR</h1>
<p style="${P}">Ενημερώστε τις προτιμήσεις απορρήτου και marketing consent σας.</p>
<p style="${CARD}">✉ Newsletter — <strong>Ενεργό</strong></p>
<p style="${CARD}">📊 Analytics — <strong>Ενεργό</strong></p>
<p style="${CARD}">🎯 Personalization — <strong>Ενεργό</strong></p>`,
    'Διαχείριση consent'),
];

export const STITCH_MORE_TEMPLATES = [
  ...DESTINATIONS_MORE,
  ...PACKAGES_MORE,
  ...TRANSACTIONAL_MORE,
  ...LIFECYCLE_MORE,
];
