/**
 * Smoke test for rent app branding resolver.
 */
import { DEFAULT_RENT_APP_BRANDING, resolveRentAppBranding } from './rentAppBranding.js';

const empty = resolveRentAppBranding({});
console.assert(empty.brandLabel === 'Ενοικίαση', 'default brand');
console.assert(
  empty.heroKicker === DEFAULT_RENT_APP_BRANDING.rent_hero_kicker,
  'default hero kicker speaks to customer',
);
console.assert(empty.title === DEFAULT_RENT_APP_BRANDING.rent_hero_title, 'default title');

const genericOffice = resolveRentAppBranding({ rent_office_name: 'Γραφείο' });
console.assert(genericOffice.brandLabel === 'Ενοικίαση', 'generic office brand');
console.assert(
  genericOffice.heroKicker === 'Επωφελήσου από την ενοικίαση',
  'generic office hero is benefit copy',
);

const office = resolveRentAppBranding({
  rent_office_name: 'Achillio Rent',
  rent_hero_title: 'Κλείσε αυτοκίνητο σήμερα',
  rent_hero_copy: 'Γρήγορα και ασφαλή.',
});
console.assert(office.brandLabel === 'Achillio Rent', 'custom office');
console.assert(
  office.heroKicker === DEFAULT_RENT_APP_BRANDING.rent_hero_kicker,
  'named office still uses benefit kicker in hero',
);
console.assert(office.title === 'Κλείσε αυτοκίνητο σήμερα', 'custom title');
console.assert(office.isCustomized === true, 'customized flag');

const guest = resolveRentAppBranding(
  { rent_guest_hero_title: 'Δες στόλο' },
  { guest: true },
);
console.assert(guest.title === 'Δες στόλο', 'guest title');
console.assert(guest.copy === '', 'guest copy empty by default');

const obsolete = resolveRentAppBranding(
  {
    rent_guest_hero_copy:
      'Περιήγηση οχημάτων χωρίς σύνδεση — για κράτηση χρειάζεται είσοδος.',
  },
  { guest: true },
);
console.assert(obsolete.copy === '', 'obsolete guest copy stripped');

const fromFooter = resolveRentAppBranding({ footer_brand_name: 'Poreia Office' });
console.assert(fromFooter.brandLabel === 'Poreia Office', 'footer fallback');

console.log('rentAppBranding: OK');
