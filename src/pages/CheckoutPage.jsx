import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loginAsCustomer, getCustomerEmail } from '../lib/auth.js';
import { createBookingFromCheckout } from '../lib/ticketing/bookingStore.js';
import {
  clearPendingCheckout,
  loadPendingCheckout,
} from '../lib/ticketing/pendingCheckout.js';
import { loadTrips } from '../lib/trips/tripStore.js';
import MinimalPageBackground from '../components/MinimalPageBackground.jsx';
import { checkTripAvailable } from '../lib/fleet/vehicleAvailability.js';
import { trackAbandonedCheckout } from '../lib/revenue/abandonedCart.js';
import {
  amountDueAtCheckout,
  computeDepositSplit,
  getPaymentPlans,
  PAYMENT_PLAN_DEPOSIT,
  PAYMENT_PLAN_FULL,
} from '../lib/payments/depositPayment.js';
import {
  buildBankPaymentReference,
  formatIbanDisplay,
  getCheckoutPaymentMethods,
  getEnabledBankAccountsForCheckout,
  PAYMENT_METHOD_BANK,
  resolveBankAccount,
} from '../lib/payments/bankTransfer.js';
import { maskIban } from '../lib/payments/ibanValidation.js';
import { fetchCheckoutSettings, DEFAULT_CHECKOUT_SETTINGS } from '../services/checkoutSettingsApi.js';
import { validateCheckoutEmail } from '../services/emailSpamApi.js';
import { completeAbandonedCart, getStoredResumeToken } from '../services/abandonedApi.js';

export default function CheckoutPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState(PAYMENT_PLAN_FULL);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [checkoutSettings, setCheckoutSettings] = useState({ ...DEFAULT_CHECKOUT_SETTINGS });
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');
  const [ibanRevealed, setIbanRevealed] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: getCustomerEmail() || '',
    phone: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
  });

  const trip = useMemo(() => {
    const id = Number(tripId);
    return loadTrips().find((t) => t.id === id) || null;
  }, [tripId]);

  const pending = useMemo(() => loadPendingCheckout(), [tripId]);
  const checkoutTotal = Number(pending?.total) || 0;
  const depositPercent = checkoutSettings.checkout_deposit_percent;
  const depositEnabled = checkoutSettings.checkout_deposit_enabled;
  const paymentPlans = useMemo(
    () =>
      depositEnabled
        ? getPaymentPlans(depositPercent)
        : getPaymentPlans(depositPercent).slice(0, 1),
    [depositEnabled, depositPercent],
  );
  const split = useMemo(
    () => computeDepositSplit(checkoutTotal, depositPercent),
    [checkoutTotal, depositPercent],
  );
  const chargeNow = useMemo(
    () => amountDueAtCheckout(checkoutTotal, paymentPlan, depositPercent),
    [checkoutTotal, paymentPlan, depositPercent],
  );
  const isDepositPlan = depositEnabled && paymentPlan === PAYMENT_PLAN_DEPOSIT;
  const paymentSettings = checkoutSettings.paymentSettings;
  const paymentMethods = useMemo(
    () => getCheckoutPaymentMethods(paymentSettings || checkoutSettings),
    [paymentSettings, checkoutSettings],
  );
  const bankAccounts = useMemo(
    () => getEnabledBankAccountsForCheckout(paymentSettings || checkoutSettings),
    [paymentSettings, checkoutSettings],
  );
  const selectedBankAccount = useMemo(
    () => resolveBankAccount(paymentSettings || checkoutSettings, selectedBankAccountId),
    [paymentSettings, checkoutSettings, selectedBankAccountId],
  );
  const isBankTransfer = paymentMethod === PAYMENT_METHOD_BANK;
  const maskIbanAtCheckout = Boolean(paymentSettings?.security?.mask_iban_public);
  const bankReferencePreview = buildBankPaymentReference(
    selectedBankAccount?.reference_template || checkoutSettings.checkout_bank_reference_template,
    { pnr: '····', amount: chargeNow, name: form.name || '···' },
  );

  useEffect(() => {
    fetchCheckoutSettings().then(setCheckoutSettings);
  }, []);

  useEffect(() => {
    if (!bankAccounts.length) return;
    setSelectedBankAccountId((prev) =>
      prev && bankAccounts.some((a) => a.id === prev)
        ? prev
        : bankAccounts.find((a) => a.is_default)?.id || bankAccounts[0].id,
    );
  }, [bankAccounts]);

  useEffect(() => {
    if (!paymentMethods.some((m) => m.id === paymentMethod)) {
      setPaymentMethod(paymentMethods[0]?.id || 'card');
    }
  }, [paymentMethods, paymentMethod]);

  useEffect(() => {
    if (!isBankTransfer) setIbanRevealed(false);
  }, [isBankTransfer, selectedBankAccountId]);

  useEffect(() => {
    if (!depositEnabled && paymentPlan !== PAYMENT_PLAN_FULL) {
      setPaymentPlan(PAYMENT_PLAN_FULL);
    }
  }, [depositEnabled, paymentPlan]);

  useEffect(() => {
    if (!trip || !pending || pending.tripId !== trip.id) {
      if (trip) navigate(`/select-seat/${trip.id}`, { replace: true });
      else navigate('/', { replace: true });
    }
  }, [trip, pending, navigate]);

  useEffect(() => {
    if (!trip || !pending) return;
    trackAbandonedCheckout({
      tripId: trip.id,
      tripTitle: trip.title,
      seats: pending.seats,
      amountEur: chargeNow,
      passengerName: form.name,
      passengerEmail: form.email,
      passengerPhone: form.phone,
    });
  }, [trip, pending, chargeNow, form.name, form.email, form.phone]);

  if (!trip || !pending || pending.tripId !== trip.id) {
    return (
      <div className="relative min-h-screen bg-surface flex items-center justify-center">
        <MinimalPageBackground />
        <p className="relative z-10 text-on-surface-variant text-sm">Φόρτωση checkout…</p>
      </div>
    );
  }

  const seatCount = pending.seats?.split(',').filter(Boolean).length || 1;
  const subtotal = checkoutTotal;
  const serviceFee = 0;
  const total = checkoutTotal;

  const handleChange = (field) => (e) => {
    let { value } = e.target;
    if (field === 'cardNumber') {
      value = value.replace(/\D/g, '').slice(0, 16);
      value = value.replace(/(.{4})/g, '$1 ').trim();
    }
    if (field === 'expiry') {
      value = value.replace(/\D/g, '').slice(0, 4);
      if (value.length >= 2) value = `${value.slice(0, 2)}/${value.slice(2)}`;
    }
    if (field === 'cvv') value = value.replace(/\D/g, '').slice(0, 4);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!form.name.trim() || form.name.length < 2) {
      toast.error('Συμπληρώστε το ονοματεπώνυμο');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('Μη έγκυρο email');
      return false;
    }
    if (!form.phone.trim() || form.phone.replace(/\D/g, '').length < 10) {
      toast.error('Συμπληρώστε έγκυρο τηλέφωνο');
      return false;
    }
    if (paymentMethod === 'card') {
      const digits = form.cardNumber.replace(/\s/g, '');
      if (digits.length < 16) {
        toast.error('Συμπληρώστε τον αριθμό κάρτας');
        return false;
      }
      if (!/^\d{2}\/\d{2}$/.test(form.expiry)) {
        toast.error('Μη έγκυρη λήξη (MM/YY)');
        return false;
      }
      if (form.cvv.length < 3) {
        toast.error('Συμπληρώστε CVV');
        return false;
      }
    }
    return true;
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await validateCheckoutEmail(form.email);
    } catch (err) {
      toast.error(err.message || 'Το email δεν επιτρέπεται');
      return;
    }

    const fleet = await checkTripAvailable(trip);
    if (!fleet.available) {
      toast.error(fleet.reason || 'Το όχημα δεν είναι διαθέσιμο για κράτηση');
      return;
    }

    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1200));

    try {
      const booking = await createBookingFromCheckout({
        trip,
        seats: pending.seats,
        total,
        amountPaid: chargeNow,
        balanceDue: isDepositPlan ? split.balanceDue : 0,
        paymentPlan,
        depositPercent,
        passenger: {
          name: form.name,
          email: form.email,
          phone: form.phone,
        },
        paymentMethod,
        bankAccountId: selectedBankAccount?.id || null,
      });
      loginAsCustomer(form.email, {
        name: form.name,
        phone: form.phone,
        provider: 'checkout',
      });
      clearPendingCheckout();
      const resumeToken = getStoredResumeToken();
      if (resumeToken) await completeAbandonedCart(resumeToken);
      sessionStorage.setItem('lastBookingId', booking.id);
      if (booking.syncedToSaas) {
        toast.success(
          isBankTransfer
            ? 'Η κράτηση καταχωρήθηκε — ολοκληρώστε την τραπεζική κατάθεση'
            : isDepositPlan
              ? 'Προκαταβολή OK — η κράτηση επιβεβαιώθηκε'
              : 'Πληρωμή OK — κράτηση & τιμολόγιο myDATA σε επεξεργασία',
        );
      } else {
        toast.success(
          isBankTransfer
            ? 'Η κράτηση καταχωρήθηκε — ολοκληρώστε την τραπεζική κατάθεση'
            : isDepositPlan
              ? 'Η προκαταβολή ολοκληρώθηκε — κράτηση επιβεβαιωμένη!'
              : 'Η πληρωμή ολοκληρώθηκε!',
        );
      }
      navigate('/wallet', { state: { highlightBooking: booking.id } });
    } catch {
      toast.error('Αποτυχία πληρωμής. Δοκιμάστε ξανά.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-surface py-6 px-4 md:py-10">
      <MinimalPageBackground />
      <div className="relative z-10 max-w-5xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(`/select-seat/${trip.id}`)}
          className="mb-4 flex items-center gap-1.5 text-on-surface-variant hover:text-primary font-bold text-sm"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Επιλογή θέσεων
        </button>

        <div className="mb-6">
          <p className="text-primary text-xs font-bold uppercase tracking-wide mb-1">Checkout</p>
          <h1 className="text-2xl md:text-3xl font-bold text-on-surface">Ολοκλήρωση & πληρωμή</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Ασφαλής πληρωμή · κράτηση άμεσα στο My Wallet
          </p>
        </div>

        <form onSubmit={handlePay} className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-5">
            <section className="bg-surface-container-lowest/90 backdrop-blur-sm rounded-2xl border border-black/[0.05] p-5 md:p-6 shadow-sm">
              <h2 className="font-bold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person</span>
                Στοιχεία επιβάτη
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block sm:col-span-2 text-sm">
                  <span className="font-bold text-on-surface-variant text-xs uppercase">Ονοματεπώνυμο</span>
                  <input
                    required
                    value={form.name}
                    onChange={handleChange('name')}
                    className="mt-1 w-full rounded-xl border border-surface-container bg-surface-container-low px-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder="π.χ. Μαρία Παπαδοπούλου"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-bold text-on-surface-variant text-xs uppercase">Email</span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={handleChange('email')}
                    className="mt-1 w-full rounded-xl border border-surface-container bg-surface-container-low px-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-bold text-on-surface-variant text-xs uppercase">Τηλέφωνο</span>
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    className="mt-1 w-full rounded-xl border border-surface-container bg-surface-container-low px-3 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder="+30 694 …"
                  />
                </label>
              </div>
            </section>

            {depositEnabled && (
              <section className="bg-surface-container-lowest/90 backdrop-blur-sm rounded-2xl border border-black/[0.05] p-5 md:p-6 shadow-sm">
                <h2 className="font-bold text-on-surface mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
                  Επιλογή πληρωμής
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                  {paymentPlans.map((plan) => {
                    const active = paymentPlan === plan.id;
                    const planCharge =
                      plan.id === PAYMENT_PLAN_DEPOSIT ? split.depositAmount : split.total;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setPaymentPlan(plan.id)}
                        className={`text-left rounded-2xl border p-4 transition-all ${
                          active
                            ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                            : 'border-surface-container bg-white hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              active
                                ? 'bg-primary text-on-primary'
                                : 'bg-surface-container text-on-surface-variant'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[20px]">{plan.icon}</span>
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-on-surface text-sm">{plan.label}</p>
                            <p className="text-xs text-on-surface-variant mt-1 leading-snug">
                              {plan.description}
                            </p>
                            <p className="text-sm font-bold text-primary mt-2">
                              {plan.id === PAYMENT_PLAN_DEPOSIT ? (
                                <>
                                  Τώρα €{planCharge.toFixed(2)}
                                  <span className="text-on-surface-variant font-medium">
                                    {' '}
                                    · υπόλοιπο €{split.balanceDue.toFixed(2)} στο λεωφορείο
                                  </span>
                                </>
                              ) : (
                                <>€{planCharge.toFixed(2)} online</>
                              )}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {isDepositPlan && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex gap-2">
                    <span className="material-symbols-outlined text-[16px] shrink-0">info</span>
                    Με την προκαταβολή {split.depositPercent}% η θέση σας δεσμεύεται. Το υπόλοιπο
                    πληρώνεται σε μετρητά στον οδηγό κατά την επιβίβαση.
                  </p>
                )}
              </section>
            )}

            <section className="bg-surface-container-lowest/90 backdrop-blur-sm rounded-2xl border border-black/[0.05] p-5 md:p-6 shadow-sm">
              <h2 className="font-bold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">payments</span>
                {isDepositPlan ? 'Πληρωμή προκαταβολής online' : 'Τρόπος πληρωμής'}
              </h2>
              <div className="flex flex-wrap gap-2 mb-5">
                {paymentMethods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold border transition-all ${
                      paymentMethod === m.id
                        ? 'bg-primary text-on-primary border-primary shadow-sm'
                        : 'bg-white text-on-surface-variant border-surface-container hover:border-primary/40'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>

              {paymentMethod === 'card' && (
                <div className="space-y-4 p-4 rounded-xl bg-surface-container-low border border-surface-container">
                  <label className="block text-sm">
                    <span className="font-bold text-xs text-on-surface-variant uppercase">Αριθμός κάρτας</span>
                    <input
                      inputMode="numeric"
                      value={form.cardNumber}
                      onChange={handleChange('cardNumber')}
                      className="mt-1 w-full rounded-xl border border-surface-container bg-white px-3 py-2.5 font-mono focus:ring-2 focus:ring-primary focus:outline-none"
                      placeholder="4242 4242 4242 4242"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block text-sm">
                      <span className="font-bold text-xs text-on-surface-variant uppercase">Λήξη</span>
                      <input
                        value={form.expiry}
                        onChange={handleChange('expiry')}
                        className="mt-1 w-full rounded-xl border border-surface-container bg-white px-3 py-2.5 font-mono focus:ring-2 focus:ring-primary focus:outline-none"
                        placeholder="MM/YY"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-bold text-xs text-on-surface-variant uppercase">CVV</span>
                      <input
                        inputMode="numeric"
                        value={form.cvv}
                        onChange={handleChange('cvv')}
                        className="mt-1 w-full rounded-xl border border-surface-container bg-white px-3 py-2.5 font-mono focus:ring-2 focus:ring-primary focus:outline-none"
                        placeholder="123"
                      />
                    </label>
                  </div>
                </div>
              )}

              {paymentMethod === 'paypal' && (
                <p className="text-sm text-on-surface-variant p-4 rounded-xl bg-[#0070ba]/10 border border-[#0070ba]/20">
                  Θα ανακατευθυνθείτε στο PayPal (demo — πληρωμή τοπική).
                </p>
              )}

              {paymentMethod === 'apple' && (
                <p className="text-sm text-on-surface-variant p-4 rounded-xl bg-black/[0.04] border border-black/[0.08] flex items-center gap-2">
                  <span className="material-symbols-outlined">contactless</span>
                  Apple Pay — γρήγορη ασφαλής πληρωμή (demo).
                </p>
              )}

              {isBankTransfer && selectedBankAccount && (
                <div className="space-y-3 p-4 rounded-xl bg-sky-50 border border-sky-200 text-sm">
                  <p className="font-bold text-sky-950 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">account_balance</span>
                    Στοιχεία κατάθεσης
                  </p>
                  {bankAccounts.length > 1 && (
                    <label className="block text-sm">
                      <span className="font-bold text-sky-900">Επιλέξτε λογαριασμό</span>
                      <select
                        className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2"
                        value={selectedBankAccountId}
                        onChange={(e) => setSelectedBankAccountId(e.target.value)}
                      >
                        {bankAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.label || acc.bank_name} · {formatIbanDisplay(acc.iban).slice(0, 14)}…
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <dl className="space-y-2 text-sky-900">
                    <div className="flex justify-between gap-3">
                      <dt className="text-sky-700">Ποσό</dt>
                      <dd className="font-bold">€{chargeNow.toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-sky-700">Τράπεζα</dt>
                      <dd className="font-medium text-right">{selectedBankAccount.bank_name}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-sky-700">Δικαιούχος</dt>
                      <dd className="font-medium text-right">{selectedBankAccount.beneficiary}</dd>
                    </div>
                    <div>
                      <dt className="text-sky-700 text-xs uppercase font-bold mb-1">IBAN</dt>
                      <dd className="font-mono font-bold text-base tracking-wide break-all">
                        {maskIbanAtCheckout && !ibanRevealed ? (
                          <button
                            type="button"
                            onClick={() => setIbanRevealed(true)}
                            className="text-primary underline"
                          >
                            {maskIban(selectedBankAccount.iban)} — Εμφάνιση
                          </button>
                        ) : (
                          formatIbanDisplay(selectedBankAccount.iban)
                        )}
                      </dd>
                    </div>
                    {selectedBankAccount.bic && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-sky-700">BIC</dt>
                        <dd className="font-mono font-medium">{selectedBankAccount.bic}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sky-700 text-xs uppercase font-bold mb-1">Αιτιολογία</dt>
                      <dd className="font-mono font-bold bg-white/70 rounded-lg px-3 py-2 border border-sky-100">
                        {bankReferencePreview}
                      </dd>
                      <p className="text-[11px] text-sky-700/80 mt-1">
                        Το ακριβές reference θα εμφανιστεί στο My Wallet μετά την κράτηση.
                      </p>
                    </div>
                  </dl>
                  {(selectedBankAccount.instructions || paymentSettings?.global_bank_instructions) && (
                    <p className="text-xs text-sky-800 leading-relaxed border-t border-sky-200 pt-3">
                      {selectedBankAccount.instructions || paymentSettings?.global_bank_instructions}
                    </p>
                  )}
                  {isDepositPlan && (
                    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Προκαταβολή μέσω τράπεζας · υπόλοιπο €{split.balanceDue.toFixed(2)} μετρητά στο λεωφορείο.
                    </p>
                  )}
                </div>
              )}

              {!isBankTransfer && (
                <p className="text-[11px] text-on-surface-variant mt-4 flex items-start gap-1 leading-relaxed">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600 shrink-0 mt-0.5">lock</span>
                  Κρυπτογραφημένη σύνδεση (HTTPS). Τα στοιχεία κάρτας δεν αποθηκεύονται — η επεξεργασία γίνεται μέσω πιστοποιημένου payment gateway.
                </p>
              )}
              {isBankTransfer && (
                <p className="text-[11px] text-on-surface-variant mt-4 flex items-start gap-1 leading-relaxed">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600 shrink-0 mt-0.5">verified_user</span>
                  Η κράτηση παραμένει εκκρεμής μέχρι να επιβεβαιωθεί η κατάθεση από την εταιρεία. Μην κοινοποιείτε απόδειξη σε τρίτους.
                </p>
              )}
            </section>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-surface-container-lowest/90 backdrop-blur-sm rounded-2xl border border-black/[0.05] p-5 md:p-6 shadow-sm lg:sticky lg:top-6">
              <h2 className="font-bold text-on-surface mb-4">Σύνοψη παραγγελίας</h2>

              {trip.image && (
                <div className="h-28 rounded-xl overflow-hidden mb-4">
                  <img src={trip.image} alt="" className="w-full h-full object-cover" />
                </div>
              )}

              <p className="font-bold text-on-surface leading-snug">{trip.title}</p>
              <p className="text-xs text-on-surface-variant mt-1 mb-4">
                {trip.departureTime
                  ? new Date(trip.departureTime).toLocaleString('el-GR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : '—'}
                {trip.vehicleType && ` · ${trip.vehicleType}`}
              </p>

              <dl className="space-y-2 text-sm border-t border-surface-container pt-4">
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">Θέσεις ({seatCount})</dt>
                  <dd className="font-bold text-on-surface">{pending.seats}</dd>
                </div>
                {pending.seatBreakdown?.length > 0 && (
                  <div className="text-xs text-on-surface-variant space-y-1 pl-1">
                    {pending.seatBreakdown.map((row) => (
                      <div key={row.number} className="flex justify-between">
                        <span>
                          {row.number}
                          {row.tier === 'vip' ? ' · VIP' : ''}
                        </span>
                        <span>€{Number(row.priceEur).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">Υποσύνολο</dt>
                  <dd>€{subtotal.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">ΦΠΑ (24%)</dt>
                  <dd>συμπεριλ.</dd>
                </div>
                {isDepositPlan && (
                  <>
                    <div className="flex justify-between pt-2 border-t border-dashed border-surface-container">
                      <dt className="text-on-surface-variant">Πληρωμή τώρα ({split.depositPercent}%)</dt>
                      <dd className="font-bold text-primary">€{chargeNow.toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-on-surface-variant">Υπόλοιπο στο λεωφορείο</dt>
                      <dd className="font-bold text-amber-700">€{split.balanceDue.toFixed(2)}</dd>
                    </div>
                  </>
                )}
                {serviceFee > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-on-surface-variant">Χρέωση υπηρεσίας</dt>
                    <dd>€{serviceFee.toFixed(2)}</dd>
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t border-surface-container text-base">
                  <dt className="font-bold text-on-surface">
                    {isDepositPlan ? 'Σύνολο εκδρομής' : 'Σύνολο'}
                  </dt>
                  <dd className="text-xl font-bold text-primary">€{total.toFixed(2)}</dd>
                </div>
                {isDepositPlan && (
                  <div className="flex justify-between text-sm bg-primary/5 rounded-xl px-3 py-2 mt-2">
                    <dt className="font-bold text-on-surface">Χρέωση τώρα</dt>
                    <dd className="font-bold text-primary">€{chargeNow.toFixed(2)}</dd>
                  </div>
                )}
              </dl>

              <button
                type="submit"
                disabled={processing}
                className="mt-6 w-full py-3.5 rounded-full bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {processing ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                    Επεξεργασία…
                  </>
                ) : isBankTransfer ? (
                  <>
                    {isDepositPlan
                      ? `Κράτηση με προκαταβολή €${chargeNow.toFixed(2)} (τράπεζα)`
                      : 'Ολοκλήρωση κράτησης (τραπεζική κατάθεση)'}
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </>
                ) : isDepositPlan ? (
                  <>
                    Πληρωμή προκαταβολής €{chargeNow.toFixed(2)}
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </>
                ) : (
                  <>
                    Ολοκλήρωση πληρωμής
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-center text-on-surface-variant mt-3">
                Με την πληρωμή αποδέχεστε τους{' '}
                <Link to="/" className="text-primary hover:underline">
                  όρους χρήσης
                </Link>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
