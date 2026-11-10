import { deriveOfficeInfoEmail, resolveFooterContact } from './footerContact.js';

console.assert(
  deriveOfficeInfoEmail('www.achilliotravel.com') === 'info@achilliotravel.com',
  'achillio www → info@',
);
console.assert(
  deriveOfficeInfoEmail('achilliotravel.com') === 'info@achilliotravel.com',
  'achillio apex → info@',
);
console.assert(deriveOfficeInfoEmail('www.poreiago.com') === '', 'skip marketing host');
console.assert(deriveOfficeInfoEmail('localhost') === '', 'skip localhost');

const filled = resolveFooterContact(
  {
    footer_contact_email: 'desk@office.gr',
    footer_contact_phone: '+30 210 0000000',
  },
  { host: 'www.achilliotravel.com' },
);
console.assert(filled.email === 'desk@office.gr', 'stored email wins');
console.assert(filled.phone.includes('210'), 'phone kept');

const fallback = resolveFooterContact({}, { host: 'www.achilliotravel.com' });
console.assert(fallback.email === 'info@achilliotravel.com', 'host fallback email');
console.assert(fallback.hasAny === true, 'hasAny with email');

console.log('footerContact.test.js OK');
