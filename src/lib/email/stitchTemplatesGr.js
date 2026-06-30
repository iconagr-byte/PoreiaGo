/**
 * Πρότυπα από Stitch export (3) — gr_1..gr_14 (ελληνικά app screens → email blocks)
 */

import { newBlock } from './campaignBlocks.js';

const T = (n) => `/email-templates/gr3_${n}.png`;

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

const I = {
  parisHero:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuA9kcGKy003blfyC2g7wIeGAoVXG0lIChoj_h8PYfZCqFJanwNrTyPEdPsdLrr7eN59yIRBxCtQOWaX92SfpMo3fsJcBbUSijE0hrK7iehufKdag8JZ6SSgXMP7drCJKPOT0p0eRn0t_4tzDUummtSSjvl7nSx16ipCFGRncz_wZB7NI_RAiJpmRRUi1g1R3d3JVxKsMEZddHk5UlyJknf6zyN8fsmX2Y4_c53qDYwsEcfqu-VPi_iEa89o7p0RWTVrYgZvSPbDVtOh',
  parisConfirm:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDT_lhaEcQtXlTdig5KdMdbxG99BIXXzjdfBJYI88Z6Ku1Y6wX31XR7sj1ccDOljnnArxDzSjYdOa8tJHMK6UYg51LZpVbbPnxK6g7W8oixIbJvlFrvEj13wl8AbeB8fzyX1FP4Y6hX_yrYH9LW7wGYfDiKfyhiiQeyqNGyVZ9cX56IvbTBtSFeZnMb0S107FZnzRK3GAJYhHP00X_IT743GEjFoU-WZFlOYTFobD_nTdP_Li8CZkb4U2gC06Sflb8Z5SnNdtpvVd8s',
  hotelRoom:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCdnqASGpc6_k3p0a_hdWvXs_mGeUL7WxTGBaord3LrbQKv6VYv4xu8bqqfOlRSvemhTQjmNv6QJnhowmd3PmVO3jCBOED__ZPLks3e9vZDR5R_a_Jj9moELYZJua6Dv5Tqc9iLagyzxZTf0RKCCRbFD0p98n89auDoSap1lfhR_Sf52JoqKJBHZgJq_661N8JpFGZ33T5-_zM4WxavfrSuLRqkkvfLryM_B2n0oI_TpQz3E1ifpPgCQt22aHIogrJeQ8Fxl8erPQ9Z',
  restaurant:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDn4ThyRQszxq4Aqi58DQWC8vY-bbEZz6zbtcEhE04oDWraBAcy5LTJDkhMmWmOfT5Qnezqm0a0eTrfspyEYu3x97JQObDdy_rBlPNjaDD2_WpvQA6USmo9pDTFrzx-K51_d59Zk2XMM0k5UAln765P7LaDi-gBAaJKlUm9CvB48qhVyU5PZgb-YvGe8y2ABCK3thjFDk4GqYtPZCuTq4SMebuR3ETx_GqHduHKrgvhg1iG6Y6BLlIUdkpcdneRFZuSVJtTuHT1EDqh',
  signupHero:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC31n1Sh3vKXe75UVc_cPmd8PlrKDQ88o9G92HuCcYe3dbaYtNCR7P2CEoLr0E50NHR_M8pqAoZEQzfCUN_uX0iYNRA6bkQL7KXASKuPWwmGQZpinGCOZV9SdnlhZxgp4Iv9zGV-SxHS0JbE2cUx-bquCbpoxCcsFchyZzhtQPGeaYzR-ta5avbu0VcnMFIxeMQZR_hOiP51HZfU3TRs1oc8GZN30xNOKEmC8iIBDC3B-JoZZ7IYbnJFGVeSZ7MsuqMdhh8-ypE0hAH',
  loginHero:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBdw2ZxwkSL65osPG8xVuB99D6BfUZ0-Jcz2SgZgSV__rUdTw1BsYw3HAwJcIiOTV3CpzsW7woQkfZue3lZ-7FBRfBmxJeQQsHev9_8oIMvfJdYccAG_modIsnY7DD9nirZ9Ht63yCwjFE8Tc7jwy-IyhZO6mVxp4Bn-5XO_JmqDAE1n22pb-MQU9IvnGRYXibTETUfLcWoKth5gcLTANEXd5zaSDo4wWlChznQiqvGsx5viUo5BzIxcw0kpIyBSA6vzVRVsyLcJrtm',
  aegeanReview:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBHVr8T6NyKpKLeVltibKImIyPzOb3b5gJ4Y4WKXQQKrAaVKiZGpktgEpSnyVoDQn9g24kMpIQqhiFM9a9xJAxlklEukNxloy09XWhA6sNn6e6X8k3VJ-eS6n6FdkH3UMbQ1IGud4mcMc5eMrPv8aHqfsCj4HnCe_h7aAeDVMC4lB6NccyXfW3KkQJ4hwJ61ge7BOUVI1xfe2NL-QcqUL9yGX7qilkLjKKChkydlZ2HkJ21S8GK3hP6Bk0LLeZDAKiKN4bJEwx2ZqUR',
  canyon:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBu-51Am-hP2T5TV86wdmPtht5cOQgDogNM_3HKvNztnG6DLrdSh8_M_8jYeShKuiK89L_C7hP8rqvVfQE19zCbgs4JkmqYKiPUswsancjbHu5tCwyNr6KMXEycXehGqL6zzzkv0g6pZNEFK3wSR_4XVrqDn6aJ1BxZnTUHQO5fgWuHe9FdOTaptQfpbe02fSZBn_KDAYPFhnkMJQMLeOgShKRVPD_FwESg8_EXktZiTJ26MV5jR0vAzPjDudL4yBs_AoubV9eOuLZp',
  parisNight:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBVyB71P9YcwwQqiynKea5oYyHR0gG0hY1uLtkUC8X-PcVPi9u5wY4k6866VCNlRViGOll5AUEQR51bIrZtaQlkvqA6kD3ITBW1RghHFGSgAk7op9xZzm1FIW--79yW4_sjATOAzVa3RH87GlmiV9UtqlDl6f3RfLw9luHInNbQLAyNohvsLI1tz-lQV_wglQrH0coVroqlhCNua7_u0YGYyzwyG7G_mgJwp-8g_iIxlumFl8g2vsfx9cy4hUi7FGC6wlqVuPJLa3RV',
  maldives:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC7cEQZIR5AUyxKRTz9w48pzL-yZDfSvY655NVnKHxL-l_LW9jfY1MOXDsYRlhYdLjNqqNx_ZlcrxYd7rZNHhEspGbZuWa5ZMwKw2g_JyWtCcGqOiBQsAlpA_a7wpBEdYzbK0S2GQoZhrNttSwG8eSpanPI-ac2BEbsSfW8GmNrQQzxrfN4lNFtapFGuv51f7or_iTzzpBuUN8wd40IbNF7MKQTKvKbf_OK-epUCTF96TmBbRMrLWLq9xJIC3QkSYE8Pod3XKD3y9wu',
  tuscany:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCn53bbGkMZC2xrXWyDlWuZK3oCNQ-HEsPI5E2KYzD6-7bPxUuDbM3hUNXULCYeFaNlCVic8N7wpTrkvl3p5sxIavAiAWrExexsU9peUiUEjf0tgr4iNezrY93m2EfwIajZ3sSUIrgVVVMSoXYbgV1ZAaBKqbeseON1CTd8QvDUlZIXUxYQOJ9mDoqDPF9HKbqgqAzX2ScNrWmuSd9KPROzVPV2SGJWx8l8haa-T65wRN3ZWZRb0jO8xkK7HoTfgtf5JUGJkXaQCFht',
  santoriniCheckout:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCYwLp63RK6XNDTBPg63A8Z9YJk2gM60YqenwITa9susOYzHHDWlL8y3KXBhJlT2FtCS1YcPBWkz9T02uuYiwGxu__S4NQpD39uURlL7EBMrdUajbt_ctyTUQOzTU1rRicZJ5AFcL2V78ROWUaY-omvFeSjqpUKuX1-zCHjNxNDgUX6rtD7fjWGWnwl31YS6VtIZsfHIkFYTqUQJudS5McsbZGb50f9pLGgo6eqSb5VpPFkDo5jcGLdRZrlArh_QcrdjuIixhznp8Wn',
  parisTwilight:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBgfZRzp7YaI8BDt52VOcqDBALmSEArVFvUPkTSUBbAFHiE9e5ylq8B6-reANiomFADtSIHx6-Ppgscf_JjtM5fj8A8QZ82p1Dl68AuW0lw_K0SKSZ2QURgHIPWZYHOQcSJzkTrCMw9s3rg6XRrx2jG_ioxPlQcQjXnQ2bt9BL0H8aVRV1uBHnDAKrTrn8QNCbGVqTU8_ax02ubK7hawah-39iefCVM9ExCODg9j3R2xIVjOtjcEoVn__8a_vPngC7QL_bcuHQ_Fap3',
  maldivesBeach:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBdXSfLSPNLZ7Uhaty6zMQWjzbg4TpcUYY2CZ_ZuOrFRTvd8daz_g4J3FFd_fWcyH-nJtepUBnNOt58cDEO-VCanrh892lV6qZ3BzWezOXDUbMcmEJBgeRebHiPE-dKT_Z6S4slcu1IJxO076HefQ6jsZlehpmlNUdSym2zzwQ0pnUioIETO9FCS6FnT6PKpaS_7HwA1D9BLTiy3iCRHufMdnRDNuNY6fwqCKgBw6QQjPnkUtSELW85M0SZGW4NWB50Nu3iNO4l5i7F',
  tuscanyHills:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAkGhY8bgveb4Ewk6NQuZ-f_ZjMyf7m_GNwRHq66argB5P0Z7Kl0FuIYcp69x5o9SznDJLyP86tqQtmQln4btVP7ZG2hDpqxzMz5Y3qSz-1zukTeOjPwM1Fbfr16JOWYV2sVJjM9qmqECILmxJ78pC7E769hn9ztEVQRo_ZNjXF2dcYgSVIYitoj0kbvizsLWInYqx0UZGBiKnwtkCaHG79xWQ3WrpZzC-tseo8BzUuIquT1RR0z4ucem5gm0PMmVrleFIeFJi4S_Gd',
  beachFilter:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBPGYOe0mM6W4JeAGZLlGmaMJVvy9tIS6cj8C3oRFFDWJElgvB-9O9KDGhxKZdJkrhe8KTkAB7_1ILKt9HkMcf5WfLybqzvDAUm4mA_GClVoFDNBZ06NfLI953UpGGx8y3xCxUtMX3PeWPrtaw9xvKaJTe65zlQ8Ji5q1EMhy3ljlOLtauELu6qSkC7hfGc2Ykm3Rjz8fbj0aJwbvXD6kZsejsLKtZhmye9moBMwCVLUV3iP4AqnDzG4CK_RszxKhEeMzYOsgA0NQOi',
  mountainFilter:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBhVnp9qar4fahpc7goaQ77wPRl_0tIdrqIYzoG_yvCPO2VOG-uB-tkzQTNDI6YorMCUIYUUgfbPK4m6F1Dzx0pDkKyR2_30sncB0cJJgJRYktHcL2T4X6A3VjXFATwPmWfI7cB2Kt2eHspRqeytWQSIN3vQXV-S01k28edPIIBAiswmDkWD5hEOoNNSS9Qvc75TNuyXzW_2aSBYD_cHW1qZCxQslsqldNq2WQfwuk7JGuGQ1qhmJCzCF2FKtC5xeUtnfvlwQKsdYI0',
  cityFilter:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDlq3VyKY8gV293HOuqRLzL2BjYM4-zObHOWWHlm39lVW0nspj7PM170PP2fcKFE2XxDp9QVZECifV0h-_9RSl23FcXIeTqeui2TriyspXirAokYOd8JbEGZODWCL0X5HNfxClxSKTs0Zp7HT0KU1lYlscQCaL5GnCkk39O_PI68Cyq3WATJRfBi2rAjWVbSzX5c6qqIyaKoc18eSPo-RwPlM4s6Qt21SPYslA8NsOvkFhrih6outYffdb-MnYi2tqjrXm6uNP4qEMe',
  parisNotify:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuALyKzo4J9dpfGtJmgj7t3GoHO6qvWwhU2kbKCuLess7kl2UiWB6-BmiofWC3P74CLC_tt2xusQUdecqoi4xuTZ22mjoK--GKSqiZM-hr96fGSVpif4rSsNCAj2kp1rQkmWesZmbvnwQ-5XRa4Ikj_9ubk2Bedy1V7cJIk5Qw0-JxHmKqOQiKRkeWRs1Fz8w9RVisYS7QWWjId9pnIGJOHGHbrTdVjfsy5MRyUtKQAjZ7rQQEa4b2V6iZH-uGU9qo2Zh3rGbw8A8E_y',
  avatar:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCsxwoQ_MIYcCinfT-RnPjxTTvUiLLvgbwZIuyUAn6uBzxojWJXtqoGx4KtQkIQw34OXG-vm_o1SB0TN_rPLSiVAfTCApgTzmFD09RMpfonyk2yRb_HV2xDrU8J6EodXuwMDxp5LLbQdLt-KsaYCyBwZg9q0c84-dw7ijEW18GLGMYXFNN0qtpIXDkuMQylJ3fzKKmBewoQKCGCg5eg6HrgL73MwfliXDmmSsaixBIt7Sc8nwiUZW5DgO-8qGDnG0wf2cJFzvXAj6Q3',
};

export const STITCH_GR_EXTRA_CATEGORIES = [
  { id: 'transactional', label: 'Transactional', icon: 'receipt_long' },
  { id: 'lifecycle', label: 'CRM & Lifecycle', icon: 'groups' },
];

export const STITCH_GR_TEMPLATES = [
  {
    id: 'stitch-gr-itinerary',
    category: 'packages',
    name: 'Πρόγραμμα Παρίσι',
    subtitle: 'Itinerary · 6 ημέρες',
    thumb: T(1),
    subject: 'Το πρόγραμμά σας: Απόδραση στο Παρίσι',
    preheader: '12–18 Οκτ · Le Meurice · Πτήσεις & δραστηριότητες',
    campaignName: 'Stitch GR — Πρόγραμμα Παρίσι',
    blocks: () => [
      header(I.parisHero, 'Απόδραση στο Παρίσι'),
      text(`<h1 style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:#005d90;">Απόδραση στο Παρίσι</h1>
<p style="margin:0 0 16px 0;font-size:15px;color:#404850;">12–18 Οκτ · 6 ημέρες, 5 νύχτες</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="48%" style="padding:10px;background:#f6f3f5;border-radius:10px;font-size:13px;"><strong>✈ Πτήση</strong><br/>On Time · Gate B2</td>
<td width="4%"></td>
<td width="48%" style="padding:10px;background:#f6f3f5;border-radius:10px;font-size:13px;"><strong>🏨 Διαμονή</strong><br/>Le Meurice · 2 επισκ.</td></tr></table>`),
      text(`<h2 style="margin:16px 0 8px 0;font-size:18px;color:#1b1b1d;">Πρόγραμμα</h2>
<p style="margin:0 0 10px 0;padding:12px;border:1px solid #e4e2e4;border-radius:10px;"><strong>Ημέρα 1</strong> — Πτήση AF1234 προς CDG<br/><span style="font-size:14px;color:#707881;">08:00–11:30 · JFK → Paris</span></p>
<p style="margin:0 0 10px 0;padding:12px;border:1px solid #e4e2e4;border-radius:10px;"><strong>Ημέρα 2</strong> — Check-in &amp; βόλτα Σηκουάνα</p>`),
      image(I.hotelRoom, 'Δωμάτιο ξενοδοχείου'),
      image(I.restaurant, 'Γαστρονομία Παρίσι'),
      cta('Δείτε πλήρες πρόγραμμα', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
    ],
  },
  {
    id: 'stitch-gr-payment',
    category: 'lifecycle',
    name: 'Τρόποι Πληρωμής',
    subtitle: 'Υπενθύμιση πληρωμής',
    thumb: T(2),
    subject: 'Ολοκληρώστε την πληρωμή της κράτησής σας',
    preheader: 'Ασφαλείς τρόποι πληρωμής · Visa, Mastercard, PayPal',
    campaignName: 'Stitch GR — Τρόποι Πληρωμής',
    blocks: () => [
      header(I.parisConfirm, 'Voyage — Πληρωμή'),
      text(`<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">Τρόποι Πληρωμής</h1>
<p style="margin:0 0 16px 0;font-size:16px;color:#404850;">Διαχειριστείτε τις κάρτες και τις προτιμώμενες μεθόδους πληρωμής σας με ασφάλεια.</p>
<ul style="margin:0;padding:0 0 0 18px;font-size:15px;color:#404850;line-height:1.8;">
<li>Visa ·••• 4242 (Προεπιλογή)</li>
<li>Mastercard ·••• 8891</li>
<li>PayPal — maria@example.com</li>
</ul>`),
      cta('Διαχείριση πληρωμών'),
    ],
  },
  {
    id: 'stitch-gr-settings',
    category: 'lifecycle',
    name: 'Ρυθμίσεις Newsletter',
    subtitle: 'Προτιμήσεις & ειδοποιήσεις',
    thumb: T(3),
    subject: 'Ενημερώστε τις προτιμήσεις email σας',
    preheader: 'GDPR · Newsletter · Προσφορές · Ειδοποιήσεις ταξιδιού',
    campaignName: 'Stitch GR — Ρυθμίσεις',
    blocks: () => [
      text(`<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">Ρυθμίσεις Email</h1>
<p style="margin:0 0 16px 0;font-size:16px;color:#404850;">Επιλέξτε τι θέλετε να λαμβάνετε από το Voyage.</p>
<p style="margin:0 0 8px 0;padding:12px;background:#f6f3f5;border-radius:10px;font-size:14px;">✉ Newsletter &amp; προσφορές — <strong>Ενεργό</strong></p>
<p style="margin:0 0 8px 0;padding:12px;background:#f6f3f5;border-radius:10px;font-size:14px;">🔔 Ειδοποιήσεις κράτησης — <strong>Ενεργό</strong></p>
<p style="margin:0;padding:12px;background:#f6f3f5;border-radius:10px;font-size:14px;">📉 Ειδοποιήσεις πτώσης τιμής — <strong>Ενεργό</strong></p>`),
      cta('Διαχείριση προτιμήσεων'),
    ],
  },
  {
    id: 'stitch-gr-review',
    category: 'lifecycle',
    name: 'Αξιολόγηση Ταξιδιού',
    subtitle: 'Post-trip feedback',
    thumb: T(4),
    subject: 'Πώς ήταν το ταξίδι σας; Αξιολογήστε το',
    preheader: 'Aegean Luxury Retreat · Η γνώμη σας μετράει',
    campaignName: 'Stitch GR — Αξιολόγηση',
    blocks: () => [
      header(I.aegeanReview, 'Aegean Luxury Retreat'),
      text(`<h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#005d90;">Αξιολόγηση Ταξιδιού</h1>
<p style="margin:0 0 4px 0;font-size:16px;font-weight:600;color:#1b1b1d;">Aegean Luxury Retreat</p>
<p style="margin:0 0 16px 0;font-size:14px;color:#707881;">Σαντορίνη · 4 ημέρες</p>
<p style="margin:0 0 12px 0;font-size:15px;color:#404850;">Βαθμολογήστε την εμπειρία σας από 1 έως 5 αστέρια και μοιραστείτε σχόλια.</p>
<p style="margin:0;font-size:28px;letter-spacing:4px;color:#ffb702;">★★★★☆</p>`),
      cta('Υποβολή αξιολόγησης'),
    ],
  },
  {
    id: 'stitch-gr-welcome-back',
    category: 'lifecycle',
    name: 'Καλώς ήρθατε ξανά',
    subtitle: 'Re-engagement login',
    thumb: T(5),
    subject: 'Καλώς ήρθατε ξανά στο Voyage',
    preheader: 'Ανακαλύψτε το άγνωστο — τα δρομολόγιά σας σας περιμένουν',
    campaignName: 'Stitch GR — Welcome Back',
    blocks: () => [
      header(I.loginHero, 'Voyage — Σύνδεση'),
      text(`<h1 style="margin:0 0 8px 0;font-size:26px;font-weight:700;color:#005d90;">Voyage</h1>
<h2 style="margin:0 0 12px 0;font-size:20px;color:#1b1b1d;">Καλώς ήρθατε ξανά</h2>
<p style="margin:0 0 16px 0;font-size:16px;color:#404850;">Συνδεθείτε για να δείτε τα δρομολόγιά σας και τις αποκλειστικές κρατήσεις.</p>
<p style="margin:0;font-size:15px;color:#707881;">Ανακαλύψτε το άγνωστο — επιλεγμένες εμπειρίες για τον σύγχρονο εξερευνητή.</p>`),
      cta('Σύνδεση στο λογαριασμό μου', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
    ],
  },
  {
    id: 'stitch-gr-signup',
    category: 'lifecycle',
    name: 'Εγγραφή',
    subtitle: 'Welcome · νέο μέλος',
    thumb: T(6),
    subject: 'Καλώς ήρθατε στο Voyage — Δημιουργήστε λογαριασμό',
    preheader: 'Premium ταξιδιωτικός σχεδιασμός · Ανακαλύψτε το αθέατο',
    campaignName: 'Stitch GR — Εγγραφή',
    blocks: () => [
      header(I.signupHero, 'Voyage — Εγγραφή'),
      text(`<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#005d90;">Δημιουργία Λογαριασμού</h1>
<p style="margin:0 0 16px 0;font-size:16px;color:#404850;">Γίνετε μέλος του Voyage για απρόσκοπτο, premium ταξιδιωτικό σχεδιασμό.</p>
<p style="margin:0;font-size:15px;color:#707881;">Ανακαλύψτε το αθέατο — επιλεγμένες εμπειρίες για τον σύγχρονο εξερευνητή.</p>`),
      cta('Εγγραφή τώρα'),
    ],
  },
  {
    id: 'stitch-gr-confirmed',
    category: 'transactional',
    name: 'Επιβεβαίωση Κράτησης',
    subtitle: 'Booking confirmed',
    thumb: T(7),
    subject: 'Η κράτησή σας επιβεβαιώθηκε — Απόδραση στο Παρίσι',
    preheader: 'Κωδικός #VYG-9824-FR · 12–18 Οκτ · 2 ενήλικες',
    campaignName: 'Stitch GR — Επιβεβαίωση',
    blocks: () => [
      text(`<p style="margin:0 0 8px 0;font-size:48px;text-align:center;color:#266449;">✓</p>
<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#005d90;text-align:center;">Η Κράτηση Επιβεβαιώθηκε!</h1>
<p style="margin:0 0 20px 0;font-size:16px;color:#404850;text-align:center;">Η περιπέτειά σας περιμένει. Σας στείλαμε email επιβεβαίωσης.</p>`),
      image(I.parisConfirm, 'Παρίσι'),
      text(`<h2 style="margin:0 0 8px 0;font-size:20px;color:#1b1b1d;">Απόδραση στο Παρίσι</h2>
<p style="margin:0 0 12px 0;font-size:14px;color:#707881;">📍 Παρίσι, Γαλλία</p>
<p style="margin:0 0 4px 0;font-size:13px;color:#707881;">ΗΜΕΡΟΜΗΝΙΕΣ: <strong style="color:#1b1b1d;">12 Οκτ – 18 Οκτ</strong></p>
<p style="margin:0 0 4px 0;font-size:13px;color:#707881;">ΕΠΙΣΚΕΠΤΕΣ: <strong style="color:#1b1b1d;">2 Ενήλικες</strong></p>
<p style="margin:0;font-size:13px;color:#707881;">ΚΩΔΙΚΟΣ: <strong style="color:#005d90;">#VYG-9824-FR</strong></p>`),
      cta('Δείτε το δρομολόγιο', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
    ],
  },
  {
    id: 'stitch-gr-notifications',
    category: 'lifecycle',
    name: 'Ειδοποιήσεις',
    subtitle: 'Price drop & updates',
    thumb: T(8),
    subject: 'Ειδοποίηση: Πτώση τιμής για Παρίσι −140$',
    preheader: 'Επιβεβαίωση Μπαλί · Προσφορά πτήσεων τώρα $480',
    campaignName: 'Stitch GR — Ειδοποιήσεις',
    blocks: () => [
      text(`<h1 style="margin:0 0 16px 0;font-size:24px;font-weight:700;color:#005d90;">Ενημερώσεις</h1>
<p style="margin:0 0 12px 0;padding:14px;background:#eef2ff;border-radius:12px;font-size:14px;color:#404850;"><strong>✓ Επιβεβαίωση:</strong> Βίλα στο Μπαλί · 12–18 Οκτ<br/>Ο οικοδεσπότης Wayan σας έστειλε μήνυμα καλωσορίσματος.</p>`),
      image(I.parisNotify, 'Παρίσι'),
      text(`<p style="margin:0 0 8px 0;font-size:15px;font-weight:600;color:#7d5800;">📉 Πτώση τιμής: Παρίσι</p>
<p style="margin:0 0 8px 0;font-size:15px;color:#404850;">Οι πτήσεις για τις αποθηκευμένες ημερομηνίες σας έπεσαν κατά 140$. Κλείστε τώρα.</p>
<p style="margin:0;font-size:20px;font-weight:700;color:#005d90;">Τώρα $480</p>`),
      cta('Κράτηση τώρα'),
    ],
  },
  {
    id: 'stitch-gr-saved',
    category: 'destinations',
    name: 'Αγαπημένοι Προορισμοί',
    subtitle: 'Wishlist email',
    thumb: T(9),
    subject: 'Οι αγαπημένοι σας προορισμοί σας περιμένουν',
    preheader: 'Grand Canyon · Paris · Maldives · Tuscany',
    campaignName: 'Stitch GR — Wishlist',
    blocks: () => [
      text(`<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">Αγαπημένοι Προορισμοί</h1>
<p style="margin:0 0 16px 0;font-size:16px;color:#404850;">Η επιλεγμένη σας λίστα για επερχόμενες περιπέτειες.</p>`),
      image(I.canyon, 'Grand Canyon'),
      text(`<p style="margin:0 0 16px 0;font-size:15px;"><strong>Grand Canyon</strong> · ★ 4.9 · Από $299/ταξίδι</p>`),
      image(I.parisNight, 'Paris Lights'),
      text(`<p style="margin:0 0 16px 0;font-size:15px;"><strong>Paris Lights</strong> · ★ 4.8 · Από €450</p>`),
      image(I.maldives, 'Maldives Retreat'),
      text(`<p style="margin:0 0 16px 0;font-size:15px;"><strong>Maldives Retreat</strong> · Από €890</p>`),
      image(I.tuscany, 'Tuscan Villa'),
      text(`<p style="margin:0;font-size:15px;"><strong>Tuscan Villa</strong> · Από €620</p>`),
      cta('Δείτε όλους'),
    ],
  },
  {
    id: 'stitch-gr-checkout',
    category: 'transactional',
    name: 'Ολοκλήρωση Κράτησης',
    subtitle: 'Secure checkout',
    thumb: T(10),
    subject: 'Ολοκληρώστε την κράτησή σας — Σαντορίνη Villa',
    preheader: 'Ασφαλής πληρωμή · 2 επισκέπτες · €2.450 σύνολο',
    campaignName: 'Stitch GR — Checkout',
    blocks: () => [
      header(I.santoriniCheckout, 'Checkout — Σαντορίνη'),
      text(`<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">Ολοκληρώστε την κράτηση</h1>
<p style="margin:0 0 16px 0;font-size:16px;color:#404850;">Ασφαλής ολοκλήρωση πληρωμής για τη διαμονή σας.</p>
<p style="margin:0 0 8px 0;font-size:15px;"><strong>Santorini Villa</strong> · 5 νύχτες</p>
<p style="margin:0 0 8px 0;font-size:14px;color:#707881;">2 επισκέπτες · 15–20 Οκτ</p>
<p style="margin:0;font-size:22px;font-weight:700;color:#005d90;">Σύνολο: €2.450</p>`),
      cta('Ολοκλήρωση πληρωμής', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
    ],
  },
  {
    id: 'stitch-gr-bookings',
    category: 'packages',
    name: 'Οι Κρατήσεις μου',
    subtitle: 'Upcoming & past trips',
    thumb: T(11),
    subject: 'Οι κρατήσεις σας — Parisian Retreat & more',
    preheader: 'Επιβεβαιωμένο Παρίσι · Pending Maldives · Completed Tuscany',
    campaignName: 'Stitch GR — Κρατήσεις',
    blocks: () => [
      text(`<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">Οι Κρατήσεις μου</h1>
<p style="margin:0 0 16px 0;font-size:16px;color:#404850;">Διαχειριστείτε τις επερχόμενες περιπέτειές σας.</p>`),
      image(I.parisTwilight, 'Parisian Retreat'),
      text(`<p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#266449;">● Επιβεβαιωμένο</p>
<h2 style="margin:0 0 6px 0;font-size:18px;color:#1b1b1d;">Parisian Retreat</h2>
<p style="margin:0 0 4px 0;font-size:14px;color:#707881;">12–18 Οκτ 2024 · #VOY-88421A</p>`),
      cta('Δείτε δρομολόγιο'),
      image(I.maldivesBeach, 'Maldives Escape'),
      text(`<p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#7d5800;">● Εκκρεμεί πληρωμή</p>
<h2 style="margin:0 0 6px 0;font-size:18px;color:#1b1b1d;">Maldives Escape</h2>
<p style="margin:0;font-size:14px;color:#707881;">5–12 Δεκ · #VOY-992B</p>`),
      cta('Ολοκλήρωση πληρωμής'),
      image(I.tuscanyHills, 'Tuscan Villa Tour'),
      text(`<p style="margin:0 0 4px 0;font-size:12px;color:#707881;">● Ολοκληρωμένο</p>
<h2 style="margin:0;font-size:18px;color:#1b1b1d;">Tuscan Villa Tour · Αυγ 2024</h2>`),
    ],
  },
  {
    id: 'stitch-gr-support',
    category: 'lifecycle',
    name: 'Βοήθεια & Υποστήριξη',
    subtitle: 'Customer care',
    thumb: T(12),
    subject: 'Πώς μπορούμε να βοηθήσουμε; — Voyage Support',
    preheader: 'Live chat · FAQ · Τηλέφωνο 24/7',
    campaignName: 'Stitch GR — Support',
    blocks: () => [
      text(`<h1 style="margin:0 0 12px 0;font-size:26px;font-weight:700;color:#005d90;">Πώς μπορούμε να βοηθήσουμε;</h1>
<p style="margin:0 0 20px 0;font-size:16px;color:#404850;">Η ομάδά μας είναι εδώ για κάθε ερώτηση σχετικά με κρατήσεις, αλλαγές ή ακυρώσεις.</p>
<p style="margin:0 0 10px 0;padding:14px;background:#f6f3f5;border-radius:12px;font-size:15px;"><strong>💬 Live Support</strong><br/>Άμεση απάντηση · Δε–Παρ 09:00–21:00</p>
<p style="margin:0 0 10px 0;padding:14px;background:#f6f3f5;border-radius:12px;font-size:15px;"><strong>📞 +30 210 000 0000</strong><br/>24/7 για επείγουσες κρατήσεις</p>
<p style="margin:0;padding:14px;background:#f6f3f5;border-radius:12px;font-size:15px;"><strong>❓ FAQ</strong><br/>Αλλαγές, ακυρώσεις, αποσκευές</p>`),
      cta('Επικοινωνία'),
    ],
  },
  {
    id: 'stitch-gr-filters',
    category: 'destinations',
    name: 'Αναζήτηση ανά στυλ',
    subtitle: 'Beach · Mountain · City',
    thumb: T(13),
    subject: 'Βρείτε τον ιδανικό προορισμό — Beach, Mountain ή City',
    preheader: 'Προηγμένα φίλτρα · Premium εμπειρίες Voyage',
    campaignName: 'Stitch GR — Φίλτρα',
    blocks: () => [
      text(`<h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;">Προηγμένα Φίλτρα</h1>
<p style="margin:0 0 16px 0;font-size:16px;color:#404850;">Επιλέξτε τον τύπο ταξιδιού που σας ταιριάζει.</p>`),
      image(I.beachFilter, 'Παραλία'),
      text(`<p style="margin:0 0 16px 0;font-size:15px;font-weight:600;color:#005d90;">🏖 Παραλία &amp; θάλασσα</p>`),
      image(I.mountainFilter, 'Βουνό'),
      text(`<p style="margin:0 0 16px 0;font-size:15px;font-weight:600;color:#005d90;">⛰ Βουνό &amp; φύση</p>`),
      image(I.cityFilter, 'Πόλη'),
      text(`<p style="margin:0;font-size:15px;font-weight:600;color:#005d90;">🏙 Πόλη &amp; πολιτισμός</p>`),
      cta('Αναζήτηση προορισμών'),
    ],
  },
  {
    id: 'stitch-gr-profile',
    category: 'lifecycle',
    name: 'Προφίλ VIP',
    subtitle: 'Loyalty member',
    thumb: T(14),
    subject: 'Καλώς ήρθατε, Elena — Τα προνόμιά σας στο Voyage',
    preheader: 'Gold Member · 12 ταξίδια · Αποκλειστικές προσφορές',
    campaignName: 'Stitch GR — Προφίλ VIP',
    blocks: () => [
      image(I.avatar, 'Elena Rostova'),
      text(`<h1 style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:#005d90;text-align:center;">Elena Rostova</h1>
<p style="margin:0 0 16px 0;font-size:14px;color:#707881;text-align:center;">Gold Member · Μέλος από 2022</p>
<p style="margin:0 0 10px 0;padding:12px;background:#f6f3f5;border-radius:10px;font-size:14px;">✈ <strong>12</strong> ολοκληρωμένα ταξίδια</p>
<p style="margin:0 0 10px 0;padding:12px;background:#f6f3f5;border-radius:10px;font-size:14px;">🎁 <strong>Αποκλειστικές</strong> early-access προσφορές</p>
<p style="margin:0;padding:12px;background:#fff8e6;border-radius:10px;font-size:14px;color:#7d5800;">⭐ Priority support &amp; room upgrades</p>`),
      cta('Δείτε τα προνόμιά μου'),
    ],
  },
];
