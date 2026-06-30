import {
  isPaid,
  isConfirmed,
  parsePaymentMethod,
  statusStyle,
  paymentStyle,
} from '../../lib/bookingDisplay.js';
import { bookingFiscalMark } from '../../lib/fiscal/fiscalDisplay.js';
import StaticTicketQr from '../StaticTicketQr.jsx';

export default function CustomerBookingCard({ booking, onOpenDetail, onViewTicket }) {
  const pay = parsePaymentMethod(booking);
  const st = statusStyle(booking);
  const pst = paymentStyle(booking);
  const paid = isPaid(booking);
  const confirmed = isConfirmed(booking);
  const base = booking.basePrice ?? (booking.price ? booking.price * 0.8 : 0);
  const taxes = booking.taxes ?? (booking.price ? booking.price * 0.2 : 0);
  const total = booking.price ?? base + taxes;
  const pnr = booking.pnr || booking.ticketRef || booking.id;

  return (
    <article className="bg-white rounded-[24px] border border-black/[0.06] shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-surface-container-lowest to-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined">confirmation_number</span>
          </div>
          <div className="min-w-0">
            <div className="font-mono font-bold text-gray-900">{booking.id}</div>
            <div className="text-xs text-gray-500 truncate">
              PNR: <span className="font-mono">{pnr}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${st.className}`}
          >
            <span className="material-symbols-outlined text-[14px]">{st.icon}</span>
            {booking.status || '—'}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${pst.className}`}
          >
            <span className="material-symbols-outlined text-[14px]">{pst.icon}</span>
            {paid ? 'Πληρώθηκε' : 'Μη πληρωμένο'}
          </span>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Εκδρομή</h4>
          <p className="font-bold text-gray-900 text-lg leading-snug">{booking.tripTitle}</p>
          <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            {booking.date} · {booking.time || '—'}
          </p>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">airline_seat_recline_normal</span>
            Θέση {booking.seat || booking.seats?.join?.(', ') || '—'}
          </p>
        </div>

        <div className="bg-surface-container-low rounded-2xl p-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">payments</span>
            Οικονομικά
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Καθαρή αξία</span>
              <span className="font-medium">€{Number(base).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Φόροι & τέλη</span>
              <span className="font-medium">€{Number(taxes).toFixed(2)}</span>
            </div>
            <div className="h-px bg-gray-200 my-2" />
            <div className="flex justify-between text-base">
              <span className="font-bold text-gray-900">Σύνολο</span>
              <span className="font-bold text-emerald-600">€{Number(total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {booking.boardingPassIssued && (
          <div className="lg:col-span-2 flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50/80">
            <StaticTicketQr booking={booking} size={120} />
            <div className="text-center sm:text-left">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Εισιτήριο</p>
              <p className="font-mono font-bold text-lg tracking-widest text-gray-900">{pnr}</p>
              <p className="text-xs text-gray-500 mt-1">Σκανάρετε κατά την επιβίβαση</p>
            </div>
          </div>
        )}

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-black/[0.05] p-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Πληρωμή</h4>
            <p className="font-bold flex items-center gap-2 text-gray-900">
              <span className="material-symbols-outlined text-primary">{pay.icon}</span>
              {pay.label}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Ημ/νία πληρωμής:{' '}
              <span className="font-medium text-gray-700">
                {booking.paymentDate || (paid ? '—' : 'Δεν έχει πληρωθεί')}
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-1 font-mono">TXN: {booking.transactionId || '—'}</p>
            <p className="text-xs text-gray-500 mt-1 font-mono">Τιμολόγιο: {booking.invoiceNumber || '—'}</p>
            {bookingFiscalMark(booking) ? (
              <p className="text-xs text-emerald-700 mt-2 font-mono font-bold">
                MARK: {bookingFiscalMark(booking)}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-black/[0.05] p-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Επιβεβαίωση</h4>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-[20px] ${confirmed ? 'text-emerald-600' : 'text-gray-300'}`}
                >
                  {confirmed ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span className={confirmed ? 'font-bold text-emerald-700' : 'text-gray-500'}>
                  Κράτηση {confirmed ? 'επιβεβαιωμένη' : 'μη επιβεβαιωμένη'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-[20px] ${booking.boardingPassIssued ? 'text-emerald-600' : 'text-gray-300'}`}
                >
                  {booking.boardingPassIssued ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span className={booking.boardingPassIssued ? 'text-gray-900' : 'text-gray-500'}>
                  Boarding pass {booking.boardingPassIssued ? 'εκδόθηκε' : 'όχι ακόμα'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-[20px] ${booking.checkedIn || booking.checkInStatus === 'CHECKED_IN' || booking.checkInStatus === 'BOARDED' ? 'text-emerald-600' : 'text-gray-300'}`}
                >
                  {booking.checkedIn || booking.checkInStatus === 'CHECKED_IN' ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span className="text-gray-700">Check-in: {booking.checkInStatus || 'NONE'}</span>
              </li>
            </ul>
            <p className="text-xs text-gray-400 mt-3">
              Πηγή: {booking.bookingSource || '—'} · {booking.agentName || '—'}
            </p>
          </div>
        </div>
      </div>

      {booking.notes && (
        <div className="px-5 pb-4">
          <p className="text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2">
            <span className="font-bold">Σημείωση:</span> {booking.notes}
          </p>
        </div>
      )}

      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap justify-end gap-3">
        {booking.boardingPassIssued && (
          <button
            type="button"
            onClick={() => onViewTicket?.(booking)}
            className="text-sm font-bold text-primary hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">confirmation_number</span>
            Προβολή εισιτηρίου
          </button>
        )}
        <button
          type="button"
          onClick={() => onOpenDetail?.(booking)}
          className="text-sm font-bold text-gray-700 hover:underline flex items-center gap-1"
        >
          Πλήρης προβολή κράτησης
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </article>
  );
}
