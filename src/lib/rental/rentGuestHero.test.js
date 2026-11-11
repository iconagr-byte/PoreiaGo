/**
 * Smoke test for guest hero benefits + search layout resolvers.
 */
import {
  isBusDemoHeroUrl,
  RENT_GUEST_HERO_BENEFITS,
  RENT_GUEST_HERO_IMAGE,
  resolveRentGuestHeroBenefits,
  resolveRentGuestSearchLayout,
} from './rentGuestHero.js';

const defaults = resolveRentGuestHeroBenefits(undefined);
console.assert(
  defaults.join('|') === RENT_GUEST_HERO_BENEFITS.join('|'),
  'default benefits',
);

const fromText = resolveRentGuestHeroBenefits('A\nB\n\nC');
console.assert(fromText.join('|') === 'A|B|C', 'newline benefits');

const emptyAllowed = resolveRentGuestHeroBenefits('', { allowEmpty: true });
console.assert(emptyAllowed.length === 0, 'allow empty');

const layout = resolveRentGuestSearchLayout({});
console.assert(layout.showDropoffToggle && layout.showPromo, 'layout defaults on');
console.assert(layout.submitLabel === 'Δες οχήματα', 'submit default');

const obsoleteSubmit = resolveRentGuestSearchLayout({
  rent_search_submit_label: 'Αναζήτηση',
});
console.assert(obsoleteSubmit.submitLabel === 'Δες οχήματα', 'obsolete submit remaps');

const off = resolveRentGuestSearchLayout({
  rent_search_show_dropoff_toggle: false,
  rent_search_show_promo: false,
  rent_search_submit_label: 'Go',
});
console.assert(!off.showDropoffToggle && !off.showPromo, 'layout toggles off');
console.assert(off.submitLabel === 'Go', 'custom submit');

console.assert(isBusDemoHeroUrl('') === true, 'empty → bus demo');
console.assert(isBusDemoHeroUrl(null) === true, 'null → bus demo');
console.assert(
  isBusDemoHeroUrl('/images/hero-bus-achillio.png') === true,
  'achillio bus path',
);
console.assert(
  isBusDemoHeroUrl(RENT_GUEST_HERO_IMAGE) === false,
  'coastal is not bus demo',
);
console.assert(
  isBusDemoHeroUrl('/uploads/office-hero.jpg') === false,
  'custom upload ok',
);

console.log('rentGuestHero: OK');
