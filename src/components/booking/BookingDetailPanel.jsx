import { useState } from 'react';
import toast from 'react-hot-toast';
import StaticTicketQr from '../StaticTicketQr.jsx';
import RecordCashPaymentModal from '../admin/RecordCashPaymentModal.jsx';
import FiscalReceiptsSection from '../admin/FiscalReceiptsSection.jsx';
import { useCustomerFiscalPoll } from '../../lib/fiscal/useCustomerFiscalPoll.js';
import {
  isPaid,
  statusStyle,
  parsePaymentMethod,
  hasDepositBalance,
  canRecordCashPayment,
} from '../../lib/bookingDisplay.js';
import { recordCashPayment } from '../../lib/ticketing/bookingStore.js';
import { DEFAULT_PAYMENT_SECURITY } from '../../lib/payments/paymentSecurity.js';
import { sendTicketEmail } from '../../services/ticketingApi.js';
import PassengerTrackCTA from '../passenger/PassengerTrackCTA.jsx';

/**
 * Κοινή προβολή κράτησης — Control Panel & καρτέλα πελάτη.
 */
export default function BookingDetailPanel({
  booking,
  mode = 'customer',
  fullPage = false,
  onBack,
  onPrint,
  onEmail,
  onCancel,
  onOpenCustomer,
  onBookingUpdated,
}) {
  const [emailSending, setEmailSending] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashSaving, setCashSaving] = useState(false);

  if (!booking) return null;

  const bookingPrice =
    Number(
      booking.basePrice != null && booking.taxes != null
        ? booking.basePrice + booking.taxes
        : booking.price,
    ) || 0;
  const base = booking.basePrice ?? bookingPrice * 0.8;
  const taxes = booking.taxes ?? bookingPrice * 0.2;
  const pnr = booking.pnr || booking.ticketRef || booking.id;
  const paid = isPaid(booking);
  const st = statusStyle(booking);
  const pay = parsePaymentMethod(booking);
  const cardRound = fullPage ? 'rounded-[28px]' : 'rounded-[32px]';
  const customerEmail = String(booking.email || '').trim();

  useCustomerFiscalPoll(booking, {
    enabled: mode === 'customer' && paid,
    onUpdated: onBookingUpdated,
  });

  const handleEmail = async () => {
    if (onEmail) {
      onEmail(booking);
      return;
    }
    if (!customerEmail) {
      toast.error('Δεν υπάρχει email πελάτη για αυτή την κράτηση');
      return;
    }
    setEmailSending(true);
    try {
      const result = await sendTicketEmail(booking);
      if (result.logged_only) {
        toast.success(`Το email καταγράφηκε (χωρίς SMTP) — ${result.email}`);
      } else {
        toast.success(`Το εισιτήριο στάλθηκε στο ${result.email}`);
      }
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποστολής email');
    } finally {
      setEmailSending(false);
    }
  };

  const handleCashConfirm = async (payload) => {
    setCashSaving(true);
    try {
      const updated = await recordCashPayment(booking.id, payload);
      toast.success('Η είσπραξη μετρητών καταχωρήθηκε');
      setCashModalOpen(false);
      onBookingUpdated?.(updated);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία καταχώρησης μετρητών');
    } finally {
      setCashSaving(false);
    }
  };

  const emailButtonClass = fullPage
    ? 'bg-white text-[#0040df] hover:bg-blue-50 shadow-lg'
    : 'border border-gray-300 hover:bg-gray-50';

  return (
    <div className={`space-y-6 ${fullPage ? 'w-full' : ''}`}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-white/90 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {mode === 'admin' ? 'Πίσω στις Κρατήσεις' : 'Πίσω στις κρατήσεις'}
        </button>
      )}

      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          {mode === 'admin' && onOpenCustomer ? (
            <button
              type="button"
              onClick={() => onOpenCustomer(booking)}
              className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface mb-2 hover:text-primary flex items-center gap-2 transition-colors"
            >
              {booking.customerName || 'Άγνωστος'}
              <span className="material-symbols-outlined text-[20px]">person</span>
            </button>
          ) : (
            <h2
              className={`font-bold tracking-tight mb-2 ${
                fullPage ? 'text-2xl md:text-3xl text-white' : 'font-headline-lg text-headline-lg text-gray-900'
              }`}
            >
              {booking.tripTitle}
            </h2>
          )}
          <p className={`text-base ${fullPage ? 'text-blue-100' : 'text-on-surface-variant'}`}>
            Κράτηση <span className="font-mono font-bold">#{booking.id}</span>
            <span className="mx-2 opacity-50">·</span>
            PNR <span className="font-mono font-bold">{pnr}</span>
            {booking.syncedToSaas && (
              <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-100 text-xs font-bold">
                SaaS
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${st.className}`}
            >
              <span className="material-symbols-outlined text-[14px]">{st.icon}</span>
              {booking.status}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                paid ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30' : 'bg-amber-500/20 text-amber-100 border border-amber-400/30'
              }`}
            >
              {paid ? 'Εξοφλήθηκε' : 'Εκκρεμεί'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(onEmail || customerEmail) && (
            <button
              type="button"
              onClick={handleEmail}
              disabled={emailSending || (!onEmail && !customerEmail)}
              className={`px-5 py-2.5 rounded-full font-bold flex items-center gap-2 transition-colors text-sm disabled:opacity-60 ${emailButtonClass}`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {emailSending ? 'hourglass_empty' : 'mail'}
              </span>
              {emailSending
                ? 'Αποστολή…'
                : onEmail
                  ? 'Email'
                  : mode === 'admin'
                    ? 'Αποστολή Επιβεβαίωσης'
                    : 'Email'}
            </button>
          )}
          {onPrint && (
            <button
              type="button"
              onClick={() => onPrint(booking)}
              className={`px-5 py-2.5 rounded-full font-bold flex items-center gap-2 transition-colors text-sm ${
                fullPage
                  ? 'bg-white text-[#0040df] hover:bg-blue-50 shadow-lg'
                  : 'border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">print</span>
              Εκτύπωση
            </button>
          )}
          {mode === 'admin' && onCancel && booking.status !== 'Ακυρωμένη' &&
            !String(booking.paymentStatus || '').includes('CANCELLED') && (
            <button
              type="button"
              onClick={() => onCancel(booking.id)}
              className="px-5 py-2.5 rounded-full border border-red-200 text-red-700 font-bold hover:bg-red-50 flex items-center gap-2 transition-colors text-sm"
            >
              <span className="material-symbols-outlined text-[20px]">cancel</span>
              Ακύρωση
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className={`bg-white p-6 md:p-8 ${cardRound} border border-black/[0.05] shadow-lg`}>
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2 text-lg">
              <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined">info</span>
              </span>
              Βασικά Στοιχεία
            </h3>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-1">PNR</div>
                <div className="font-mono font-bold text-lg text-gray-900">{pnr}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-1">Πηγή</div>
                <div className="font-bold text-gray-900">{booking.bookingSource || 'Website (B2C)'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-1">Ημερομηνία</div>
                <div className="font-bold text-gray-900">
                  {booking.date} · {booking.time || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-1">Θέση</div>
                <div className="font-bold text-2xl text-primary">{booking.seat}</div>
              </div>
            </div>
          </div>

          <div className={`bg-white p-6 md:p-8 ${cardRound} border border-black/[0.05] shadow-lg`}>
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2 text-lg">
              <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined">payments</span>
              </span>
              Πληρωμή & Χρέωση
            </h3>
            <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-2xl p-6 mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-500">Εισιτήριο</span>
                <span className="font-bold">€{Number(base).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-500">Φόροι & τέλη (24%)</span>
                <span className="font-bold">€{Number(taxes).toFixed(2)}</span>
              </div>
              <div className="h-px bg-gray-200 my-3" />
              <div className="flex justify-between items-center text-xl">
                <span className="font-bold text-gray-900">Σύνολο</span>
                <span className="font-bold text-emerald-600">€{bookingPrice.toFixed(2)}</span>
              </div>
              {hasDepositBalance(booking) && (
                <>
                  <div className="h-px bg-gray-200 my-3" />
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Πληρώθηκε online (προκαταβολή)</span>
                    <span className="font-bold text-emerald-600">
                      €{Number(booking.amountPaid || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-2">
                    <span className="text-gray-500">Υπόλοιπο στο λεωφορείο (μετρητά)</span>
                    <span className="font-bold text-amber-700">
                      €{Number(booking.balanceDue || 0).toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-400 uppercase font-bold mb-1">Τρόπος πληρωμής</div>
                <div className="font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">{pay.icon}</span>
                  {booking.paymentMethod || pay.label}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 uppercase font-bold mb-1">Transaction ID</div>
                <div className="font-mono text-xs text-gray-600">{booking.transactionId || '—'}</div>
              </div>
              {booking.invoiceNumber && (
                <div className="sm:col-span-2">
                  <div className="text-xs text-gray-400 uppercase font-bold mb-1">Τιμολόγιο</div>
                  <div className="font-mono text-sm text-gray-700">{booking.invoiceNumber}</div>
                </div>
              )}
            </div>
            {mode === 'admin' && canRecordCashPayment(booking) && (
              <button
                type="button"
                onClick={() => setCashModalOpen(true)}
                className="mt-6 w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors shadow-md shadow-amber-600/20"
              >
                <span className="material-symbols-outlined">payments</span>
                Καταχώρηση μετρητών
                <span className="text-amber-100 text-sm font-medium">
                  (υπόλοιπο €{Number(booking.balanceDue || 0).toFixed(2)})
                </span>
              </button>
            )}
            {mode === 'admin' ? (
              <FiscalReceiptsSection
                booking={booking}
                admin
                enablePoll
                onBookingUpdated={onBookingUpdated}
              />
            ) : (
              <FiscalReceiptsSection booking={booking} admin={false} />
            )}
          </div>

          {mode === 'customer' && (
            <div className={`bg-white p-6 md:p-8 ${cardRound} border border-black/[0.05] shadow-lg`}>
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">timeline</span>
                Ιστορικό κράτησης
              </h3>
              <div className="space-y-4 pl-2 border-l-2 border-primary/20 ml-2">
                {[
                  { label: 'Κράτηση επιβεβαιώθηκε', done: isPaid(booking) },
                  { label: 'Boarding pass εκδόθηκε', done: booking.boardingPassIssued },
                  { label: 'Check-in / επιβίβαση', done: booking.checkedIn },
                ].map((step) => (
                  <div key={step.label} className="flex items-center gap-3 relative -left-[9px]">
                    <span
                      className={`w-4 h-4 rounded-full border-2 bg-white ${
                        step.done ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                      }`}
                    />
                    <span className={step.done ? 'font-bold text-gray-900' : 'text-gray-500'}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {mode === 'customer' && paid && booking.tripId ? (
            <div className={`bg-white p-6 md:p-8 ${cardRound} border border-black/[0.05] shadow-lg`}>
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#facc15]">directions_bus</span>
                Ζωντανή διαδρομή
              </h3>
              <PassengerTrackCTA booking={booking} />
            </div>
          ) : null}

          <div
            className={`bg-white p-6 md:p-8 ${cardRound} border border-black/[0.05] shadow-xl text-center relative overflow-hidden`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <h3 className="font-bold text-gray-900 mb-1 text-lg relative">Εισιτήριο</h3>
            <p className="text-xs text-gray-500 mb-5 relative">Σκανάρετε κατά την επιβίβαση</p>
            <div className="inline-block mb-4 p-3 rounded-2xl border-2 border-dashed border-primary/20 bg-white relative">
              <StaticTicketQr booking={booking} size={160} />
            </div>
            <div className="font-mono font-bold text-xl text-gray-900 tracking-[0.2em] relative">{pnr}</div>
            <div className="mt-5 relative">
              {booking.checkedIn ? (
                <div className="py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined">check_circle</span>
                  Επιβιβάστηκε
                </div>
              ) : (
                <div className="py-3 bg-slate-50 text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 border border-slate-200">
                  <span className="material-symbols-outlined">pending</span>
                  Εκκρεμεί επιβίβαση
                </div>
              )}
            </div>
          </div>

          <div className={`bg-white p-6 md:p-8 ${cardRound} border border-black/[0.05] shadow-lg`}>
            <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500">person</span>
              Επιβάτης
            </h3>
            <div className="space-y-4">
              {[
                { icon: 'call', value: booking.phone, color: 'text-gray-400' },
                { icon: 'mail', value: booking.email, color: 'text-gray-400' },
                { icon: 'luggage', value: booking.luggage, color: 'text-gray-400' },
                { icon: 'restaurant', value: booking.dietary, color: 'text-orange-400' },
              ].map((row) => (
                <div key={row.icon} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className={`material-symbols-outlined ${row.color}`}>{row.icon}</span>
                  <span className="font-medium text-gray-900">{row.value || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <RecordCashPaymentModal
        booking={booking}
        security={DEFAULT_PAYMENT_SECURITY}
        open={cashModalOpen}
        onClose={() => setCashModalOpen(false)}
        onConfirm={handleCashConfirm}
        confirming={cashSaving}
      />
    </div>
  );
}
