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
  const checkedIn =
    booking.checkedIn ||
    booking.checkInStatus === 'CHECKED_IN' ||
    booking.checkInStatus === 'BOARDED';

  return (
    <article className="group relative bg-white rounded-[28px] border border-black/[0.06] shadow-[0_10px_40px_rgba(15,23,42,0.06)] overflow-hidden hover:shadow-[0_16px_48px_rgba(0,64,223,0.12)] hover:-translate-y-0.5 transition-all duration-300">
      <div
        className={`absolute inset-y-0 left-0 w-1.5 ${
          paid && confirmed
            ? 'bg-emerald-500'
            : paid
              ? 'bg-sky-500'
              : 'bg-amber-400'
        }`}
        aria-hidden
      />

      <div className="pl-3 sm:pl-4">
        <div className="px-5 py-4 border-b border-sky-100/80 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-sky-50 via-primary/[0.06] to-teal-50/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-sky-500 text-white shadow-md shadow-primary/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                directions_bus
              </span>
            </div>
            <div className="min-w-0">
              <div className="font-mono font-bold text-slate-900 tracking-tight">{booking.id}</div>
              <div className="text-xs text-slate-500 truncate">
                PNR: <span className="font-mono text-slate-700">{pnr}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm ${st.className}`}
            >
              <span className="material-symbols-outlined text-[14px]">{st.icon}</span>
              {booking.status || '—'}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm ${pst.className}`}
            >
              <span className="material-symbols-outlined text-[14px]">{pst.icon}</span>
              {paid ? 'Πληρώθηκε' : 'Μη πληρωμένο'}
            </span>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-white border border-sky-100 p-4">
            <h4 className="text-[11px] font-bold text-sky-700/80 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-[15px]">map</span>
              </span>
              Εκδρομή
            </h4>
            <p className="font-bold text-primary text-lg leading-snug">{booking.tripTitle}</p>
            <p className="text-sm text-slate-600 mt-3 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-white border border-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px]">calendar_month</span>
              </span>
              {booking.date} · {booking.time || '—'}
            </p>
            <p className="text-sm text-slate-600 mt-2 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-white border border-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px]">airline_seat_recline_normal</span>
              </span>
              Θέση {booking.seat || booking.seats?.join?.(', ') || '—'}
            </p>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white border border-emerald-100 p-4">
            <h4 className="text-[11px] font-bold text-emerald-700/80 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-[15px]">payments</span>
              </span>
              Οικονομικά
            </h4>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Καθαρή αξία</span>
                <span className="font-semibold text-slate-800">€{Number(base).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Φόροι & τέλη</span>
                <span className="font-semibold text-slate-800">€{Number(taxes).toFixed(2)}</span>
              </div>
              <div className="h-px bg-emerald-200/70 my-1" />
              <div className="flex justify-between items-baseline text-base pt-1">
                <span className="font-bold text-slate-900">Σύνολο</span>
                <span className="font-bold text-2xl text-emerald-600 tracking-tight">
                  €{Number(total).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {booking.boardingPassIssued && (
            <div className="lg:col-span-2 flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-sky-50">
              <StaticTicketQr booking={booking} size={120} />
              <div className="text-center sm:text-left">
                <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-1">Εισιτήριο</p>
                <p className="font-mono font-bold text-lg tracking-widest text-slate-900">{pnr}</p>
                <p className="text-xs text-slate-500 mt-1">Σκανάρετε κατά την επιβίβαση</p>
              </div>
            </div>
          )}

          <div
            className={`rounded-2xl border p-4 ${
              paid
                ? 'border-emerald-100 bg-gradient-to-br from-emerald-50/70 to-white'
                : 'border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50/40'
            }`}
          >
            <h4
              className={`text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${
                paid ? 'text-emerald-700/80' : 'text-amber-700/80'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                  paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{pay.icon}</span>
              </span>
              Πληρωμή
            </h4>
            <p className="font-bold flex items-center gap-2 text-slate-900">
              {pay.label}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Ημ/νία πληρωμής:{' '}
              <span className="font-medium text-slate-700">
                {booking.paymentDate || (paid ? '—' : 'Δεν έχει πληρωθεί')}
              </span>
            </p>
            <p className="text-xs text-slate-500 mt-1 font-mono">TXN: {booking.transactionId || '—'}</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">Τιμολόγιο: {booking.invoiceNumber || '—'}</p>
            {bookingFiscalMark(booking) ? (
              <p className="text-xs text-emerald-700 mt-2 font-mono font-bold">
                MARK: {bookingFiscalMark(booking)}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/80 to-white p-4">
            <h4 className="text-[11px] font-bold text-teal-700/80 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-[15px]">verified</span>
              </span>
              Επιβεβαίωση
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-[20px] ${confirmed ? 'text-emerald-600' : 'text-slate-300'}`}
                >
                  {confirmed ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span className={confirmed ? 'font-bold text-emerald-700' : 'text-slate-500'}>
                  Κράτηση {confirmed ? 'επιβεβαιωμένη' : 'μη επιβεβαιωμένη'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-[20px] ${booking.boardingPassIssued ? 'text-emerald-600' : 'text-slate-300'}`}
                >
                  {booking.boardingPassIssued ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span className={booking.boardingPassIssued ? 'text-slate-900' : 'text-slate-500'}>
                  Boarding pass {booking.boardingPassIssued ? 'εκδόθηκε' : 'όχι ακόμα'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={`material-symbols-outlined text-[20px] ${checkedIn ? 'text-emerald-600' : 'text-slate-300'}`}
                >
                  {checkedIn ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span className="text-slate-700">Check-in: {booking.checkInStatus || 'NONE'}</span>
              </li>
            </ul>
            <p className="text-xs text-slate-400 mt-3">
              Πηγή: {booking.bookingSource || '—'} · {booking.agentName || '—'}
            </p>
          </div>
        </div>

        {booking.notes && (
          <div className="px-5 pb-4">
            <p className="text-sm text-amber-900 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl px-4 py-2.5">
              <span className="font-bold">Σημείωση:</span> {booking.notes}
            </p>
          </div>
        )}

        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 via-sky-50/40 to-teal-50/30 border-t border-sky-100/80 flex flex-wrap justify-end gap-3">
          {booking.boardingPassIssued && (
            <button
              type="button"
              onClick={() => onViewTicket?.(booking)}
              className="text-sm font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">confirmation_number</span>
              Προβολή εισιτηρίου
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenDetail?.(booking)}
            className="text-sm font-bold text-white bg-gradient-to-r from-primary to-sky-500 hover:brightness-110 px-4 py-1.5 rounded-full shadow-sm shadow-primary/20 transition-all flex items-center gap-1"
          >
            Πλήρης προβολή κράτησης
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </article>
  );
}
