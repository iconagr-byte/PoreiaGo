/**
 * Derive rental booking paperwork status from inspections + legal doc pack signatures.
 */
import { legalPackProgress } from './rentalLegalDocs.js';

export function inspectionsForBooking(inspections, bookingId) {
  return (inspections || []).filter((i) => i.rental_booking_id === bookingId);
}

export function latestInspectionOfType(inspections, bookingId, type) {
  return inspectionsForBooking(inspections, bookingId).find((i) => i.inspection_type === type) || null;
}

/**
 * @returns {{
 *   pickup: object|null,
 *   returnCheck: object|null,
 *   pickupSigned: boolean,
 *   returnSigned: boolean,
 *   agreementReady: boolean,
 *   legal: ReturnType<typeof legalPackProgress>,
 *   statusKey: 'missing'|'pickup_only'|'complete'|'cancelled',
 *   statusLabel: string,
 * }}
 */
export function paperworkStatusForBooking(booking, inspections) {
  const legal = legalPackProgress(booking, inspections);
  if (!booking) {
    return {
      pickup: null,
      returnCheck: null,
      pickupSigned: false,
      returnSigned: false,
      agreementReady: false,
      legal,
      statusKey: 'missing',
      statusLabel: 'Χωρίς δεδομένα',
    };
  }
  if (booking.rental_status === 'CANCELLED') {
    return {
      pickup: null,
      returnCheck: null,
      pickupSigned: false,
      returnSigned: false,
      agreementReady: false,
      legal,
      statusKey: 'cancelled',
      statusLabel: 'Ακυρωμένη',
    };
  }
  const pickup = latestInspectionOfType(inspections, booking.id, 'PICKUP_CHECK');
  const returnCheck = latestInspectionOfType(inspections, booking.id, 'RETURN_CHECK');
  const pickupSigned = Boolean(pickup?.signature_url);
  const returnSigned = Boolean(returnCheck?.signature_url);
  const legalHint = `Νομικά ${legal.signedCount}/${legal.total}`;

  if (pickupSigned && returnSigned && legal.packComplete) {
    return {
      pickup,
      returnCheck,
      pickupSigned,
      returnSigned,
      agreementReady: true,
      legal,
      statusKey: 'complete',
      statusLabel: 'Πλήρης χαρτούρα',
    };
  }
  if (pickupSigned && returnSigned) {
    return {
      pickup,
      returnCheck,
      pickupSigned,
      returnSigned,
      agreementReady: true,
      legal,
      statusKey: 'complete',
      statusLabel: `Check-in/out OK · ${legalHint}`,
    };
  }
  if (pickupSigned) {
    return {
      pickup,
      returnCheck,
      pickupSigned,
      returnSigned,
      agreementReady: true,
      legal,
      statusKey: 'pickup_only',
      statusLabel: legal.pickupReady
        ? 'Υπογραφή παραλαβής · νομικά OK'
        : `Υπογραφή παραλαβής · ${legalHint}`,
    };
  }
  const pendingLegal = legal.pickupSignedCount < legal.pickupTotal;
  return {
    pickup,
    returnCheck,
    pickupSigned,
    returnSigned,
    agreementReady: Boolean(booking.id),
    legal,
    statusKey: 'missing',
    statusLabel: pickup
      ? 'Check-in χωρίς υπογραφή'
      : pendingLegal
        ? `Εκκρεμεί υπογραφή · ${legalHint}`
        : 'Εκκρεμεί υπογραφή παραλαβής',
  };
}

export function paperworkStatusChipClass(statusKey) {
  switch (statusKey) {
    case 'complete':
      return 'bg-emerald-100 text-emerald-800';
    case 'pickup_only':
      return 'bg-sky-100 text-sky-800';
    case 'cancelled':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-amber-100 text-amber-900';
  }
}

/** @deprecated Prefer RENTAL_LEGAL_DOCS agreement clauses — kept for older imports. */
export const RENTAL_AGREEMENT_TERMS = [
  'Ο πελάτης δηλώνει ότι παρέλαβε το όχημα στην κατάσταση που περιγράφεται στον έλεγχο παραλαβής και ότι διαθέτει ισχύουσα άδεια οδήγησης.',
  'Το όχημα χρησιμοποιείται μόνο από τον δηλωμένο οδηγό (ή οδηγούς που εγκρίνει το γραφείο) και σύμφωνα με την ισχύουσα νομοθεσία.',
  'Απαγορεύεται η υπεκμίσθωση, η συμμετοχή σε αγώνες και η μεταφορά παράνομων φορτίων.',
  'Ο πελάτης ευθύνεται για ζημιές, πρόστιμα και έξοδα που προκύπτουν κατά τη διάρκεια της ενοικίασης, εκτός αν καλύπτονται από την επιλεγμένη ασφαλιστική κάλυψη.',
  'Σε περίπτωση βλάβης ή ατυχήματος, ο πελάτης ειδοποιεί άμεσα το γραφείο και ακολουθεί τις οδηγίες οδικής βοήθειας.',
  'Η επιστροφή γίνεται στον δηλωμένο τόπο και χρόνο, με καύσιμο και χιλιόμετρα όπως καταγράφονται στον έλεγχο επιστροφής.',
  'Η παρούσα σύμβαση ισχύει μαζί με την κράτηση, τον έλεγχο παραλαβής/επιστροφής και τις υπογραφές που επισυνάπτονται.',
];
