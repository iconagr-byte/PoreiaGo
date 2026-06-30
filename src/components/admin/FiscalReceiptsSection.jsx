import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import FiscalMarkCell from './FiscalMarkCell.jsx';
import { retryFiscalInvoice, issueFiscalReceipt } from '../../services/adminBookingsApi.js';
import { useFiscalBookingPoll } from '../../lib/fiscal/useFiscalBookingPoll.js';
import {
  bookingFiscalMark,
  bookingFiscalReceipts,
  bookingFiscalStatus,
  bookingCanManuallyIssueFiscal,
  fiscalInvoiceKindLabel,
  fiscalProviderLabel,
  fiscalReceiptStatusLabel,
  bookingFiscalProvider,
} from '../../lib/fiscal/fiscalDisplay.js';
import { bookingFiscalDocuments, fiscalReceiptPrintPath } from '../../lib/fiscal/fiscalReceiptPrint.js';

function receiptStatusClass(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'issued') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (key === 'failed') return 'bg-red-50 text-red-700 border-red-200';
  if (key === 'queued' || key === 'pending') return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-gray-50 text-gray-600 border-gray-200';
}

export default function FiscalReceiptsSection({
  booking,
  admin = false,
  enablePoll = false,
  onBookingUpdated,
}) {
  const [retryingId, setRetryingId] = useState(null);
  const [issuingManual, setIssuingManual] = useState(false);
  const receipts = bookingFiscalReceipts(booking);
  const status = bookingFiscalStatus(booking);
  const providerLabel = fiscalProviderLabel(bookingFiscalProvider(booking));
  const hasFiscalData = status || receipts.length > 0 || bookingFiscalMark(booking);
  const isPolling = enablePoll && (status === 'pending' || receipts.some((r) => ['pending', 'queued'].includes(String(r.status))));
  const canManualIssue = admin && bookingCanManuallyIssueFiscal(booking);
  const printableDocs = bookingFiscalDocuments(booking).filter((d) => d.mark);
  const canPrintReceipt = printableDocs.length > 0;

  useFiscalBookingPoll(booking, {
    enabled: enablePoll,
    onUpdated: onBookingUpdated,
  });

  const onRetry = async (receiptId) => {
    setRetryingId(receiptId);
    try {
      const updated = await retryFiscalInvoice(receiptId);
      onBookingUpdated?.(updated);
      toast.success('Η επανάληψη έκδοσης ξεκίνησε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία επανάληψης');
    } finally {
      setRetryingId(null);
    }
  };

  const onManualIssue = async () => {
    if (!booking?.id) return;
    setIssuingManual(true);
    try {
      const updated = await issueFiscalReceipt(booking.id);
      onBookingUpdated?.(updated);
      toast.success('Η χειροκίνητη έκδοση ξεκίνησε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία έκδοσης');
    } finally {
      setIssuingManual(false);
    }
  };

  if (!hasFiscalData) {
    if (!admin) return null;
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-4 text-sm text-gray-500 space-y-3">
        <p>Δεν έχει εκδοθεί ακόμα φορολογικό παραστατικό (ΑΠΥ / myDATA MARK).</p>
        {canManualIssue ? (
          <button
            type="button"
            disabled={issuingManual}
            onClick={onManualIssue}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            {issuingManual ? '…' : 'Έκδοση απόδειξης'}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-gray-400 uppercase font-bold mb-1">
            Φορολογική απόδειξη {isPolling ? '· ανανέωση…' : ''}
          </div>
          <FiscalMarkCell booking={booking} compact={!admin} />
        </div>
        {providerLabel ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
            <span className="material-symbols-outlined text-[16px]">hub</span>
            {providerLabel}
          </span>
        ) : null}
      </div>

      {receipts.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Τύπος</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Ποσό</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">MARK</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Κατάσταση</th>
                {admin ? (
                  <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 text-right">
                    Ενέργειες
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {receipts.map((receipt) => (
                <tr key={receipt.id} className="bg-white">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {fiscalInvoiceKindLabel(receipt.kind)}
                  </td>
                  <td className="px-4 py-3 font-bold tabular-nums">€{Number(receipt.amount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-emerald-800">{receipt.mark || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border ${receiptStatusClass(receipt.status)}`}
                    >
                      {fiscalReceiptStatusLabel(receipt.status)}
                    </span>
                    {receipt.status === 'failed' && receipt.error_message ? (
                      <p className="mt-1 text-[11px] text-red-600 line-clamp-2" title={receipt.error_message}>
                        {receipt.error_message}
                      </p>
                    ) : null}
                  </td>
                  {admin ? (
                    <td className="px-4 py-3 text-right">
                      {receipt.status === 'failed' ? (
                        <button
                          type="button"
                          disabled={retryingId === receipt.id}
                          onClick={() => onRetry(receipt.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[14px]">replay</span>
                          {retryingId === receipt.id ? '…' : 'Επανάληψη'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {canManualIssue ? (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={issuingManual}
            onClick={onManualIssue}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-800 text-xs font-bold disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            {issuingManual ? '…' : 'Έκδοση για μη καταγεγραμμένη πληρωμή'}
          </button>
        </div>
      ) : null}

      {!admin && bookingFiscalMark(booking) ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-gray-500 flex-1 min-w-[200px]">
            Το MARK είναι ο αριθμός καταχώρησης της απόδειξής σας στην ΑΑΔΕ (myDATA).
          </p>
          {canPrintReceipt ? (
            <Link
              to={fiscalReceiptPrintPath(booking.id)}
              state={{ booking }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
              Λήψη PDF
            </Link>
          ) : null}
        </div>
      ) : null}

      {admin && canPrintReceipt ? (
        <div className="flex justify-end">
          <Link
            to={fiscalReceiptPrintPath(booking.id)}
            state={{ booking }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold"
          >
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
            Εκτύπωση / PDF απόδειξης
          </Link>
        </div>
      ) : null}
    </div>
  );
}
