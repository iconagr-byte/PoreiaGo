/**
 * Smoke test for rent app branding resolver.
 */
import {
  DEFAULT_RENT_APP_BRANDING,
  isGenericRentOfficeLabel,
  resolveRentAppBranding,
} from './rentAppBranding.js';

const empty = resolveRentAppBranding({});
console.assert(empty.brandLabel === 'Ενοικιάσεις', 'default brand');
console.assert(empty.title === DEFAULT_RENT_APP_BRANDING.rent_hero_title, 'default title');
console.assert(empty.logoUrl === '', 'no logo by default');

console.assert(isGenericRentOfficeLabel('Γραφείο') === true, 'generic greek');
console.assert(isGenericRentOfficeLabel('Office') === true, 'generic en');
console.assert(isGenericRentOfficeLabel('Achillio Travel') === false, 'real name');

const grafio = resolveRentAppBranding({ footer_brand_name: 'Γραφείο' });
console.assert(grafio.brandLabel === 'Ενοικιάσεις', 'strip placeholder Γραφείο');

const office = resolveRentAppBranding({
  rent_office_name: 'Achillio Rent',
  rent_hero_title: 'Κλείσε αυτοκίνητο σήμερα',
  rent_hero_copy: 'Γρήγορα και ασφαλή.',
  logo_url: '/api/site/assets/logo',
});
console.assert(office.brandLabel === 'Achillio Rent', 'custom office');
console.assert(office.title === 'Κλείσε αυτοκίνητο σήμερα', 'custom title');
console.assert(office.isCustomized === true, 'customized flag');
console.assert(office.logoUrl === '/api/site/assets/logo', 'logo kept');
console.assert(office.brandSubtitle === 'Ενοικιάσεις', 'subtitle when real office');

const guest = resolveRentAppBranding(
  { rent_guest_hero_title: 'Δες στόλο' },
  { guest: true },
);
console.assert(guest.title === 'Δες στόλο', 'guest title');
console.assert(guest.copy === '', 'guest copy empty by default');
console.assert(guest.titleAccent === DEFAULT_RENT_APP_BRANDING.rent_guest_hero_title_accent, 'guest accent');

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
