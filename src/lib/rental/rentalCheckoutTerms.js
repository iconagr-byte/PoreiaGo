/**
 * Mandatory tablet-checkout acceptances (master prompt · PoreiaGo Rent).
 * Maps UI checkboxes → legal pack ids where applicable.
 */
import { legalDocById } from './rentalLegalDocs.js';

/** @typedef {{ id: string, label: string, legalDocId?: string, hasTermsModal?: boolean }} CheckoutTerm */

/** @type {CheckoutTerm[]} */
export const RENTAL_CHECKOUT_TERMS = [
  {
    id: 'general_terms',
    label: 'Διάβασα και αποδέχομαι τους Γενικούς Όρους Ενοικίασης.',
    legalDocId: 'terms',
    hasTermsModal: true,
  },
  {
    id: 'vehicle_condition',
    label:
      'Επιβεβαιώνω ότι έλεγξα το όχημα, είδα τις καταγεγραμμένες φθορές στο διάγραμμα και συμφωνώ με τη στάθμη καυσίμου.',
  },
  {
    id: 'fines',
    label: 'Αναλαμβάνω πλήρως το κόστος οποιασδήποτε τροχαίας παράβασης ή προστίμου.',
  },
  {
    id: 'offroad_ferry',
    label:
      'Κατανοώ ότι απαγορεύεται η οδήγηση σε χωματόδρομους και η μεταφορά με πλοίο χωρίς άδεια.',
  },
  {
    id: 'gdpr_gps',
    label:
      'Συναινώ στην επεξεργασία των στοιχείων μου και αποδέχομαι τη λειτουργία τηλεμετρίας (GPS).',
    legalDocId: 'gdpr',
  },
];

/** Legal docs stamped with the same signature on contract issue. */
export const CHECKOUT_SIGNED_LEGAL_DOC_IDS = [
  'agreement',
  'license_decl',
  'insurance_ack',
  'deposit',
  'gdpr',
  'terms',
];

export function emptyCheckoutAcceptances() {
  return Object.fromEntries(RENTAL_CHECKOUT_TERMS.map((t) => [t.id, false]));
}

export function allCheckoutTermsAccepted(acceptances) {
  return RENTAL_CHECKOUT_TERMS.every((t) => Boolean(acceptances?.[t.id]));
}

export function generalTermsClauses() {
  const doc = legalDocById('terms');
  return doc?.clauses || [];
}

export function generalTermsTitle() {
  return legalDocById('terms')?.title || 'Γενικοί Όροι Ενοικίασης';
}
