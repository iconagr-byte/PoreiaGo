/**
 * Minimal EL/EN dictionary for Rent Wallet / catalog CTAs.
 * Persist language via rent_lang_v1 in localStorage.
 */
const DICTS = {
  el: {
    book: 'Κράτηση',
    book_now: 'Κλείσε τώρα',
    cancel: 'Ακύρωση κράτησης',
    cancelling: 'Ακύρωση…',
    cancel_ok: 'Η κράτηση ακυρώθηκε',
    cancel_refunded: 'Η κράτηση ακυρώθηκε · επιστροφή χρημάτων',
    cancel_refund_pending: 'Η κράτηση ακυρώθηκε · εκκρεμεί επιστροφή από το γραφείο',
    contract: 'Λήψη σύμβασης',
    contract_signed: 'Σύμβαση υπογεγραμμένη',
    payment: 'Πληρωμή',
    payment_pending: 'εκκρεμεί πληρωμή',
    payment_partial: 'προκαταβολή καταχωρήθηκε',
    pay_with_card: 'Πληρωμή με κάρτα',
    pay_success: 'Η πληρωμή ολοκληρώθηκε',
    wallet: 'Wallet',
    wallet_empty_title: 'Δεν έχετε ακόμα ενοικίαση',
    wallet_empty_copy:
      'Κλείστε όχημα από την εφαρμογή ενοικίασης — η κράτηση εμφανίζεται εδώ στο Rent Wallet.',
    find_vehicle: 'Βρες όχημα',
    new_booking: 'Νέα κράτηση',
    pickup: 'Παραλαβή',
    code: 'Κωδικός',
    amount: 'Ποσό',
    customer: 'Πελάτης',
    status_confirmed: 'Επιβεβαιωμένη',
    status_active: 'Σε εξέλιξη',
    status_completed: 'Ολοκληρωμένη',
    status_cancelled: 'Ακυρωμένη',
    self_drive: 'Self-drive',
    with_driver: 'Με οδηγό',
    check_in: 'Check-in',
    check_out: 'Check-out',
    modify_dates: 'Αλλαγή ημερομηνιών',
    review: 'Αξιολόγηση',
    review_submit: 'Υποβολή αξιολόγησης',
    review_thanks: 'Ευχαριστούμε για την αξιολόγηση',
    damage_deposit: 'Εγγύηση ζημιάς',
    deposit_held: 'Δεσμευμένη',
    deposit_released: 'Απελευθερώθηκε',
    deposit_captured: 'Κατακρατήθηκε',
    branch: 'Γραφείο',
    search: 'Αναζήτηση',
    all_categories: 'Όλες',
    min_age: 'Ελάχιστη ηλικία',
    language: 'Γλώσσα',
  },
  en: {
    book: 'Book',
    book_now: 'Book now',
    cancel: 'Cancel booking',
    cancelling: 'Cancelling…',
    cancel_ok: 'Booking cancelled',
    cancel_refunded: 'Booking cancelled · refund processed',
    cancel_refund_pending: 'Booking cancelled · refund pending at desk',
    contract: 'Download contract',
    contract_signed: 'Contract signed',
    payment: 'Payment',
    payment_pending: 'payment pending',
    payment_partial: 'deposit recorded',
    pay_with_card: 'Pay with card',
    pay_success: 'Payment completed',
    wallet: 'Wallet',
    wallet_empty_title: 'No rental yet',
    wallet_empty_copy:
      'Book a vehicle from the rental app — it appears here in Rent Wallet.',
    find_vehicle: 'Find a vehicle',
    new_booking: 'New booking',
    pickup: 'Pickup',
    code: 'Code',
    amount: 'Amount',
    customer: 'Customer',
    status_confirmed: 'Confirmed',
    status_active: 'Active',
    status_completed: 'Completed',
    status_cancelled: 'Cancelled',
    self_drive: 'Self-drive',
    with_driver: 'With driver',
    check_in: 'Check-in',
    check_out: 'Check-out',
    modify_dates: 'Change dates',
    review: 'Review',
    review_submit: 'Submit review',
    review_thanks: 'Thanks for your review',
    damage_deposit: 'Damage deposit',
    deposit_held: 'Held',
    deposit_released: 'Released',
    deposit_captured: 'Captured',
    branch: 'Branch',
    search: 'Search',
    all_categories: 'All',
    min_age: 'Minimum age',
    language: 'Language',
  },
};

const LANG_KEY = 'rent_lang_v1';

export function getRentLang() {
  try {
    const raw = localStorage.getItem(LANG_KEY);
    if (raw === 'en' || raw === 'el') return raw;
  } catch {
    /* ignore */
  }
  return 'el';
}

export function setRentLang(lang) {
  const next = lang === 'en' ? 'en' : 'el';
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    /* ignore */
  }
  return next;
}

export function t(key, lang = getRentLang()) {
  const dict = DICTS[lang] || DICTS.el;
  return dict[key] || DICTS.el[key] || key;
}

export function rentStatusLabel(status, lang = getRentLang()) {
  const map = {
    CONFIRMED: 'status_confirmed',
    ACTIVE: 'status_active',
    COMPLETED: 'status_completed',
    CANCELLED: 'status_cancelled',
  };
  return t(map[status] || 'status_confirmed', lang);
}

export { DICTS, LANG_KEY };
