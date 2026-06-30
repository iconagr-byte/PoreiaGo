/** Printable fiscal receipt path (browser → Save as PDF). */

export function fiscalReceiptPrintPath(bookingId) {
  return `/wallet/receipt/${encodeURIComponent(bookingId)}`;
}

export function bookingFiscalDocuments(booking) {
  const docs = booking?.fiscal_documents || booking?.fiscalDocuments;
  if (Array.isArray(docs) && docs.length) return docs;
  const receipts = booking?.fiscal_receipts || booking?.fiscalReceipts || [];
  return receipts
    .filter((r) => r.mark && String(r.status || '').toLowerCase() === 'issued')
    .map((r) => ({
      kind: r.kind,
      amount_eur: r.amount,
      mark: r.mark,
      issued_at: null,
      description: null,
      is_credit: String(r.kind || '').toLowerCase() === 'credit_note',
    }));
}
