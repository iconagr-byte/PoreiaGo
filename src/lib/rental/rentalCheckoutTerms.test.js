import {
  RENTAL_CHECKOUT_TERMS,
  allCheckoutTermsAccepted,
  emptyCheckoutAcceptances,
  CHECKOUT_SIGNED_LEGAL_DOC_IDS,
} from './rentalCheckoutTerms.js';

console.assert(RENTAL_CHECKOUT_TERMS.length === 5, '5 mandatory terms');
console.assert(CHECKOUT_SIGNED_LEGAL_DOC_IDS.includes('agreement'), 'stamps agreement');
const empty = emptyCheckoutAcceptances();
console.assert(allCheckoutTermsAccepted(empty) === false, 'empty not accepted');
const full = Object.fromEntries(RENTAL_CHECKOUT_TERMS.map((t) => [t.id, true]));
console.assert(allCheckoutTermsAccepted(full) === true, 'full accepted');
console.log('rentalCheckoutTerms: OK');
