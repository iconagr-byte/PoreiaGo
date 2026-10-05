/**
 * Smoke test for rent app branding resolver.
 */
import {
  DEFAULT_RENT_APP_BRANDING,
  isGenericRentOfficeLabel,
  resolveRentAppBranding,
  splitRentBrandLabel,
} from './rentAppBranding.js';

const empty = resolveRentAppBranding({});
console.assert(empty.brandLabel === 'Poreiago Rent', 'default brand');
console.assert(empty.brandSubtitle === '', 'no default subtitle');
console.assert(empty.title === DEFAULT_RENT_APP_BRANDING.rent_hero_title, 'default title');
console.assert(empty.logoUrl === '', 'no logo by default');

console.assert(isGenericRentOfficeLabel('Γραφείο') === true, 'generic greek');
console.assert(isGenericRentOfficeLabel('Office') === true, 'generic en');
console.assert(isGenericRentOfficeLabel('Ενοικιάσεις') === true, 'generic rentals');
console.assert(isGenericRentOfficeLabel('Achillio Travel') === false, 'real name');

const grafio = resolveRentAppBranding({ footer_brand_name: 'Γραφείο' });
console.assert(grafio.brandLabel === 'Poreiago Rent', 'strip placeholder Γραφείο');

const enoik = resolveRentAppBranding({ rent_office_name: 'Ενοικιάσεις' });
console.assert(enoik.brandLabel === 'Poreiago Rent', 'strip Ενοικιάσεις');

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
console.assert(office.brandSubtitle === '', 'no subtitle under wordmark');

const rentLogoWins = resolveRentAppBranding({
  logo_url: '/api/site/assets/logo',
  rent_logo_url: '/api/site/office-assets/t/rent_logo/rent_logo.jpg',
  rent_logo_show_name: false,
});
console.assert(
  rentLogoWins.logoUrl === '/api/site/office-assets/t/rent_logo/rent_logo.jpg',
  'rent_logo_url preferred over office logo',
);
console.assert(rentLogoWins.showName === false, 'rent_logo_show_name honored');
console.assert(rentLogoWins.isCustomized === true, 'rent logo counts as customized');

const guest = resolveRentAppBranding(
  { rent_guest_hero_title: 'Δες στόλο' },
  { guest: true },
);
console.assert(guest.title === 'Δες στόλο', 'guest title');
console.assert(guest.copy === '', 'guest copy empty by default');
console.assert(guest.titleAccent === DEFAULT_RENT_APP_BRANDING.rent_guest_hero_title_accent, 'guest accent');
console.assert(guest.benefits.length === 3, 'default benefits');
console.assert(guest.searchLayout.showDropoffToggle === true, 'dropoff on');
console.assert(guest.searchLayout.showPromo === true, 'promo on');
console.assert(guest.searchLayout.submitLabel === 'Αναζήτηση', 'submit label');

const guestCustom = resolveRentAppBranding(
  {
    rent_guest_hero_title_accent: '— κλείσε online',
    rent_guest_hero_benefits: ['Free cancel', 'Airport pickup'],
    rent_search_show_dropoff_toggle: false,
    rent_search_show_promo: false,
    rent_search_submit_label: 'Βρες αυτοκίνητο',
  },
  { guest: true },
);
console.assert(guestCustom.titleAccent === '— κλείσε online', 'custom accent');
console.assert(guestCustom.benefits.length === 2, 'custom benefits');
console.assert(guestCustom.searchLayout.showDropoffToggle === false, 'dropoff off');
console.assert(guestCustom.searchLayout.showPromo === false, 'promo off');
console.assert(guestCustom.searchLayout.submitLabel === 'Βρες αυτοκίνητο', 'custom submit');

const noAccent = resolveRentAppBranding(
  { rent_guest_hero_title_accent: '' },
  { guest: true },
);
console.assert(noAccent.titleAccent === '', 'empty accent hides');

const obsoleteAccent = resolveRentAppBranding(
  { rent_guest_hero_title_accent: '— αναζήτησε, σύγκρινε & κλείσε' },
  { guest: true },
);
console.assert(
  obsoleteAccent.titleAccent === DEFAULT_RENT_APP_BRANDING.rent_guest_hero_title_accent,
  'obsolete accent refreshes to platform slogan',
);

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

const split = splitRentBrandLabel('Poreiago Rent');
console.assert(split.primary === 'Poreiago' && split.accent === 'Rent', 'split wordmark');

console.log('rentAppBranding: OK');
