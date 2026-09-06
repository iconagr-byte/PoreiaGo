/**
 * Modal with full Greek General Terms (from rental legal pack).
 */
import { generalTermsClauses, generalTermsTitle } from '../../../lib/rental/rentalCheckoutTerms.js';
import { LEGAL_PACK_DISCLAIMER } from '../../../lib/rental/rentalLegalDocs.js';

export default function RentalTermsModal({ open, onClose }) {
  if (!open) return null;

  const clauses = generalTermsClauses();

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rental-terms-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[88vh] overflow-hidden rounded-t-[28px] sm:rounded-[28px] bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700/80">Νομικό κείμενο</p>
            <h2 id="rental-terms-title" className="font-bold text-lg text-slate-900 mt-0.5">
              {generalTermsTitle()}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
            aria-label="Κλείσιμο"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto space-y-3 flex-1">
          <ol className="list-decimal pl-5 space-y-2.5 text-sm text-slate-700 leading-relaxed">
            {clauses.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <p className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-100">
            {LEGAL_PACK_DISCLAIMER}
          </p>
        </div>
        <div className="px-5 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-full bg-teal-700 text-white font-bold text-sm hover:bg-teal-800"
          >
            Επιστροφή στην υπογραφή
          </button>
        </div>
      </div>
    </div>
  );
}
