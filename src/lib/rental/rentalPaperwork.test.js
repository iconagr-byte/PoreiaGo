/**
 * Smoke test for rental paperwork status helpers.
 */
import {
  paperworkStatusForBooking,
  paperworkStatusChipClass,
} from './rentalPaperwork.js';

const booking = {
  id: 'b1',
  rental_status: 'ACTIVE',
  client_name: 'Test',
};

console.assert(
  paperworkStatusForBooking(booking, []).statusKey === 'missing',
  'no inspections → missing',
);
console.assert(
  paperworkStatusForBooking(booking, []).legal?.total >= 8,
  'legal pack attached',
);

const pickupOnly = paperworkStatusForBooking(booking, [
  {
    rental_booking_id: 'b1',
    inspection_type: 'PICKUP_CHECK',
    signature_url: '/api/site/rental-photos/sig.png',
  },
]);
console.assert(pickupOnly.statusKey === 'pickup_only', 'pickup signed');
console.assert(pickupOnly.agreementReady === true, 'agreement ready after pickup');

const complete = paperworkStatusForBooking(booking, [
  {
    rental_booking_id: 'b1',
    inspection_type: 'PICKUP_CHECK',
    signature_url: '/sig1.png',
  },
  {
    rental_booking_id: 'b1',
    inspection_type: 'RETURN_CHECK',
    signature_url: '/sig2.png',
  },
]);
console.assert(complete.statusKey === 'complete', 'both signatures → complete');
console.assert(
  paperworkStatusForBooking({ ...booking, rental_status: 'CANCELLED' }, []).statusKey ===
    'cancelled',
  'cancelled booking',
);
console.assert(typeof paperworkStatusChipClass('complete') === 'string', 'chip class');

console.log('rentalPaperwork: OK');
