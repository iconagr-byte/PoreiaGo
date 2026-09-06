/**
 * Smoke test for rental legal document pack helpers.
 */
import {
  RENTAL_LEGAL_DOCS,
  isLegalDocSigned,
  legalPackProgress,
  legalDocById,
} from './rentalLegalDocs.js';

console.assert(RENTAL_LEGAL_DOCS.length >= 8, 'expected full legal pack');
console.assert(legalDocById('agreement')?.title, 'agreement doc');
console.assert(legalDocById('gdpr')?.clauses?.length > 0, 'gdpr clauses');

const booking = {
  id: 'b1',
  client_name: 'Νίκος',
  rental_status: 'CONFIRMED',
  legal_doc_signatures: {
    agreement: { signature_url: '/sig-a.png', signed_at: '2026-01-01T10:00:00Z' },
    license_decl: { signature_url: '/sig-l.png', signed_at: '2026-01-01T10:01:00Z' },
  },
};

const empty = legalPackProgress({ id: 'x' }, []);
console.assert(empty.signedCount === 0, 'empty pack');
console.assert(empty.total === RENTAL_LEGAL_DOCS.length, 'total matches catalog');

const mid = legalPackProgress(booking, []);
console.assert(mid.signedCount === 2, 'two booking signatures');
console.assert(isLegalDocSigned(legalDocById('agreement'), booking, []), 'agreement signed');
console.assert(!isLegalDocSigned(legalDocById('gdpr'), booking, []), 'gdpr not signed');

const withPickup = legalPackProgress(booking, [
  {
    rental_booking_id: 'b1',
    inspection_type: 'PICKUP_CHECK',
    signature_url: '/pickup.png',
  },
]);
console.assert(
  isLegalDocSigned(legalDocById('delivery_protocol'), booking, [
    {
      rental_booking_id: 'b1',
      inspection_type: 'PICKUP_CHECK',
      signature_url: '/pickup.png',
    },
  ]),
  'delivery via inspection',
);
console.assert(withPickup.signedCount === 3, 'booking + pickup');

console.log('rentalLegalDocs: OK');
