const PROVIDER_LABELS = {
  native_aade: 'myDATA',
  prosvasis: 'Prosvasis',
  epsilon: 'Epsilon',
};

export function fiscalProviderLabel(provider) {
  if (!provider) return null;
  const key = String(provider).toLowerCase();
  return PROVIDER_LABELS[key] || provider;
}

export function bookingFiscalMark(booking) {
  return booking?.fiscal_mark || booking?.fiscalMark || null;
}

export function bookingFiscalMarks(booking) {
  const marks = booking?.fiscal_marks || booking?.fiscalMarks;
  if (Array.isArray(marks) && marks.length) return marks;
  const single = bookingFiscalMark(booking);
  return single ? [single] : [];
}

export function bookingFiscalProvider(booking) {
  return booking?.fiscal_provider || booking?.fiscalProvider || null;
}

export function bookingFiscalStatus(booking) {
  return booking?.fiscal_status || booking?.fiscalStatus || null;
}

const INVOICE_KIND_LABELS = {
  down_payment: 'Προκαταβολή',
  final_settlement: 'Εξόφληση υπολοίπου',
  full_payment: 'Πλήρης πληρωμή',
  credit_note: 'Πιστωτικό',
};

const FISCAL_STATUS_LABELS = {
  pending: 'Εκκρεμεί',
  queued: 'Σε ουρά',
  issued: 'Εκδόθηκε',
  failed: 'Αποτυχία',
};

export function fiscalInvoiceKindLabel(kind) {
  if (!kind) return '—';
  return INVOICE_KIND_LABELS[String(kind).toLowerCase()] || kind;
}

export function fiscalReceiptStatusLabel(status) {
  if (!status) return '—';
  return FISCAL_STATUS_LABELS[String(status).toLowerCase()] || status;
}

export function bookingFiscalReceipts(booking) {
  return booking?.fiscal_receipts || booking?.fiscalReceipts || [];
}

export function bookingAmountPaid(booking) {
  return Number(booking?.amountPaid ?? booking?.amount_paid ?? 0);
}

export function bookingCanManuallyIssueFiscal(booking) {
  if (bookingAmountPaid(booking) <= 0) return false;
  const receipts = bookingFiscalReceipts(booking);
  const statusKey = (status) => String(status || '').toLowerCase();
  if (receipts.some((r) => ['pending', 'queued'].includes(statusKey(r.status)))) return false;
  if (receipts.some((r) => statusKey(r.status) === 'failed')) return false;
  const issuedTotal = receipts
    .filter((r) => statusKey(r.status) === 'issued')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);
  return issuedTotal < bookingAmountPaid(booking) - 0.001;
}
