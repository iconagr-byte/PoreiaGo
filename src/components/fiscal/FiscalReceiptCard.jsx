function Field({ label, children }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-1">{label}</div>
      <div>{children}</div>
    </div>
  );
}

export default function FiscalReceiptCard({ document, booking, issuerName, issuerVat }) {
  const isCredit = document.is_credit;
  const issuedLabel = document.issued_at
    ? new Date(`${document.issued_at}T12:00:00`).toLocaleDateString('el-GR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('el-GR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

  const pnr = booking?.booking_reference || booking?.bookingReference || booking?.pnr || booking?.id;
  const tripTitle = booking?.trip_title || booking?.tripTitle || 'Εκδρομή';
  const customerName = booking?.customer_name || booking?.customerName || '—';

  return (
    <div className="max-w-[480px] mx-auto bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-200 print:shadow-none print:break-after-page">
      <div
        className={`px-6 py-5 text-white ${
          isCredit
            ? 'bg-gradient-to-br from-rose-600 to-rose-900'
            : 'bg-gradient-to-br from-emerald-600 to-emerald-900'
        }`}
      >
        <div className="text-[11px] uppercase tracking-widest opacity-90 mb-1">
          {isCredit ? 'Πιστωτικό στοιχείο' : 'Φορολογική απόδειξη'} · myDATA
        </div>
        <h2 className="text-xl font-bold leading-tight m-0">{issuerName || 'PoreiaGo Travel'}</h2>
        {issuerVat ? (
          <p className="text-sm opacity-90 mt-2 mb-0">ΑΦΜ εκδότη: {issuerVat}</p>
        ) : null}
      </div>

      <div className="px-6 py-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Ημερομηνία έκδοσης">
            <span className="font-bold text-gray-900">{issuedLabel}</span>
          </Field>
          <Field label="Ποσό">
            <span className="font-bold text-2xl text-gray-900 tabular-nums">
              €{Number(document.amount_eur || 0).toFixed(2)}
            </span>
          </Field>
          <Field label="MARK (ΑΑΔΕ)">
            <span className="font-mono text-sm font-bold text-emerald-800 break-all">{document.mark}</span>
          </Field>
          <Field label="Κράτηση">
            <span className="font-mono text-sm font-bold">{pnr}</span>
          </Field>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm text-slate-700">
          <p className="font-bold text-slate-900 mb-1">{tripTitle}</p>
          <p className="m-0">{document.description || 'Παροχή υπηρεσιών ταξιδιού'}</p>
        </div>

        <div className="border-t border-dashed border-gray-200 pt-4">
          <Field label="Επιβάτης / πελάτης">
            <span className="font-bold text-gray-900">{customerName}</span>
          </Field>
        </div>

        <p className="text-[10px] text-gray-400 leading-relaxed m-0">
          Το MARK είναι ο μοναδικός αριθμός καταχώρησης του παραστατικού στο myDATA της ΑΑΔΕ.
          Για επίσημη χρήση, αποθηκεύστε αυτή τη σελίδα ως PDF (Ctrl+P).
        </p>
      </div>
    </div>
  );
}
