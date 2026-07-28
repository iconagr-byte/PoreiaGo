/**
 * Smoke test for rent app branding resolver.
 */
import { DEFAULT_RENT_APP_BRANDING, resolveRentAppBranding } from './rentAppBranding.js';

const empty = resolveRentAppBranding({});
console.assert(empty.brandLabel === 'Ενοικίαση', 'default brand');
console.assert(empty.title === DEFAULT_RENT_APP_BRANDING.rent_hero_title, 'default title');

const office = resolveRentAppBranding({
  rent_office_name: 'Achillio Rent',
  rent_hero_title: 'Κλείσε αυτοκίνητο σήμερα',
  rent_hero_copy: 'Γρήγορα και ασφαλή.',
});
console.assert(office.brandLabel === 'Achillio Rent', 'custom office');
console.assert(office.title === 'Κλείσε αυτοκίνητο σήμερα', 'custom title');
console.assert(office.isCustomized === true, 'customized flag');

const guest = resolveRentAppBranding(
  { rent_guest_hero_title: 'Δες στόλο' },
  { guest: true },
);
console.assert(guest.title === 'Δες στόλο', 'guest title');

const fromFooter = resolveRentAppBranding({ footer_brand_name: 'Poreia Office' });
console.assert(fromFooter.brandLabel === 'Poreia Office', 'footer fallback');

console.log('rentAppBranding: OK');
