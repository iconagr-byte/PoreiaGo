import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getCustomerEmail,
  getCustomerName,
  getCustomerToken,
} from '../../lib/auth.js';
import { ensureCustomerForRental } from '../../lib/customers/customerStore.js';
import { enrichRentVehicle } from '../../lib/rental/rentFleetEnrichment.js';
import {
  estimateBookingTotals,
  euroLabel,
  readCoverageCatalog,
  readExtrasSelection,
  readRentVehicleSnapshot,
  rentalDayCount,
  selectedExtrasLabels,
} from '../../lib/rental/rentBookingExtras.js';
import { readRentBookingPrefs, writeRentBookingPrefs } from '../../lib/rental/rentBookingSearch.js';
import {
  PAYMENT_PLAN_DEPOSIT,
  PAYMENT_PLAN_FULL,
  RENT_PAYMENT_CASH,
  getRentPaymentMethods,
  getRentPaymentPlans,
  summarizeRentPayment,
} from '../../lib/rental/rentPayment.js';
import {
  PAYMENT_METHOD_BANK,
  buildBankPaymentReference,
  formatIbanDisplay,
  getEnabledBankAccountsForCheckout,
  resolveBankAccount,
} from '../../lib/payments/bankTransfer.js';
import { createCustomerRentalBooking } from '../../services/customerRentalApi.js';
import { fetchCheckoutSettings } from '../../services/checkoutSettingsApi.js';
import { fetchSiteAppearance } from '../../services/siteAppearanceApi.js';
import RentBookingStepper from './RentBookingStepper.jsx';
import RentBookingTripSummary from './RentBookingTripSummary.jsx';
import RentBookingVehicleSidebar from './RentBookingVehicleSidebar.jsx';

/**
 * Final rent checkout — plan + method + complete booking CTA.
 */
export default function RentBookingPaymentStep({ brandLabel = 'Γραφείο' } = {}) {
  const navigate = useNavigate();
  const prefs = useMemo(() => readRentBookingPrefs(), []);
  const snap = useMemo(() => readRentVehicleSnapshot(), []);
  const vehicle = useMemo(() => (snap ? enrichRentVehicle(snap) : null), [snap]);

  const [catalog, setCatalog] = useState([]);
  const [selection, setSelection] = useState(() => readExtrasSelection(prefs));
  const [settings, setSettings] = useState(null);
  const [paymentPlan, setPaymentPlan] = useState(prefs.payment_plan || PAYMENT_PLAN_FULL);
  const [paymentMethod, setPaymentMethod] = useState(prefs.payment_method || 'card');
  const [bankAccountId, setBankAccountId] = useState(prefs.payment_bank_account_id || '');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCheckoutSettings(), fetchSiteAppearance()])
      .then(([checkout, appearance]) => {
        if (cancelled) return;
        setSettings(checkout);
        const { options } = readCoverageCatalog(appearance);
        setCatalog(options);
        setSelection(readExtrasSelection(readRentBookingPrefs(), options));
        if (!checkout.checkout_deposit_enabled && paymentPlan === PAYMENT_PLAN_DEPOSIT) {
          setPaymentPlan(PAYMENT_PLAN_FULL);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dayCount = rentalDayCount(prefs.start_time, prefs.end_time);
  const totals = estimateBookingTotals({
    dailyRate: vehicle?.daily_rate_eur,
    days: dayCount,
    selection,
    catalog,
  });
  const selectedLabels = selectedExtrasLabels(selection, catalog);
  const depositPercent = settings?.checkout_deposit_percent ?? 30;
  const depositEnabled = settings?.checkout_deposit_enabled !== false;
  const plans = useMemo(
    () => getRentPaymentPlans(depositPercent, depositEnabled),
    [depositPercent, depositEnabled],
  );
  const methods = useMemo(() => getRentPaymentMethods(settings || {}), [settings]);
  const bankAccounts = useMemo(
    () => getEnabledBankAccountsForCheckout(settings?.paymentSettings || settings || {}),
    [settings],
  );
  const selectedBank = useMemo(
    () => resolveBankAccount(settings?.paymentSettings || settings || {}, bankAccountId),
    [settings, bankAccountId],
  );

  useEffect(() => {
    if (!methods.length) return;
    if (!methods.some((m) => m.id === paymentMethod)) {
      setPaymentMethod(methods[0].id);
    }
  }, [methods, paymentMethod]);

  useEffect(() => {
    if (bankAccounts.length && !bankAccountId) {
      setBankAccountId(bankAccounts.find((a) => a.is_default)?.id || bankAccounts[0].id);
    }
  }, [bankAccounts, bankAccountId]);

  // Cash at pickup forces "full" semantics (pay later).
  const effectivePlan =
    paymentMethod === RENT_PAYMENT_CASH ? PAYMENT_PLAN_FULL : paymentPlan;

  const summary = useMemo(
    () =>
      summarizeRentPayment({
        totalEur: totals.total,
        plan: effectivePlan,
        methodId: paymentMethod,
        depositPercent,
      }),
    [totals.total, effectivePlan, paymentMethod, depositPercent],
  );

  const isBank = paymentMethod === PAYMENT_METHOD_BANK;
  const isCash = paymentMethod === RENT_PAYMENT_CASH;
  const isDeposit = effectivePlan === PAYMENT_PLAN_DEPOSIT && !isCash;

  const persistPayment = (patch = {}) => {
    writeRentBookingPrefs({
      wizard_step: 'payment',
      payment_plan: effectivePlan,
      payment_method: paymentMethod,
      payment_bank_account_id: bankAccountId,
      ...patch,
    });
  };

  const validateCard = () => {
    if (paymentMethod !== 'card') return true;
    const digits = card.number.replace(/\D/g, '');
    if (digits.length < 12) {
      toast.error('Συμπλήρωσε έγκυρο αριθμό κάρτας');
      return false;
    }
    if (!/^\d{2}\/\d{2}$/.test(card.expiry.trim())) {
      toast.error('Λήξη κάρτας: ΜΜ/ΕΕ');
      return false;
    }
    if (card.cvv.replace(/\D/g, '').length < 3) {
      toast.error('Συμπλήρωσε CVV');
      return false;
    }
    return true;
  };

  const confirmBooking = async () => {
    if (!vehicle?.id) {
      toast.error('Διάλεξε πρώτα όχημα από τον στόλο.');
      navigate('/rent#rent-guest-fleet');
      return;
    }
    if (!prefs.start_time || !prefs.end_time || !prefs.pickup_location) {
      toast.error('Συμπλήρωσε παραλαβή και ημερομηνίες.');
      navigate('/rent#rent-guest-search');
      return;
    }
    if (!prefs.client_first_name || !prefs.client_email || !prefs.client_phone) {
      toast.error('Συμπλήρωσε πρώτα τα στοιχεία σου.');
      navigate('/rent/book/details');
      return;
    }
    if (!validateCard()) return;

    persistPayment();

    if (!getCustomerToken()) {
      writeRentBookingPrefs({
        wizard_pending_confirm: true,
        wizard_step: 'payment',
        payment_plan: effectivePlan,
        payment_method: paymentMethod,
      });
      navigate('/rent', { state: { from: '/rent/book/payment', rentContinue: true } });
      return;
    }

    if (/^demo-rent-(car|van)-/i.test(String(vehicle.id))) {
      writeRentBookingPrefs({ wizard_pending_confirm: false, wizard_step: 'done', ...selection });
      toast.success('Demo κράτηση — πληρωμή προσομοιώθηκε.');
      navigate('/rent/wallet');
      return;
    }

    setBusy(true);
    try {
      const fullName = `${prefs.client_first_name || ''} ${prefs.client_last_name || ''}`.trim() || getCustomerName();
      const addressLine = [
        prefs.client_street,
        prefs.client_street_no,
        prefs.client_address2,
        prefs.client_postal,
        prefs.client_city,
        prefs.client_country,
      ]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .join(', ');

      await ensureCustomerForRental({
        email: prefs.client_email || getCustomerEmail(),
        name: fullName,
        phone: prefs.client_phone,
      }).catch(() => null);

      const extras = Object.entries(selection)
        .filter(([, on]) => on)
        .map(([key]) => key);

      let notes = addressLine ? `Διεύθυνση: ${addressLine}` : '';
      if (isBank && selectedBank) {
        const ref = buildBankPaymentReference(selectedBank.reference_template || 'RB-{pnr}', {
          pnr: 'PENDING',
          amount: summary.amountPaid,
          name: fullName,
        });
        notes = [notes, `Πληρωμή: ${summary.payment_method_label}`, `Αιτιολογία: ${ref}`]
          .filter(Boolean)
          .join(' · ');
      } else if (summary.payment_method_label) {
        notes = [notes, `Πληρωμή: ${summary.payment_method_label}`].filter(Boolean).join(' · ');
      }

      const booking = await createCustomerRentalBooking({
        vehicle_id: vehicle.id,
        start_time: new Date(prefs.start_time).toISOString(),
        end_time: new Date(prefs.end_time).toISOString(),
        pickup_location: prefs.pickup_location,
        dropoff_location: prefs.dropoff_location || prefs.pickup_location,
        driver_mode: prefs.driver_mode || 'SELF_DRIVE',
        client_phone: prefs.client_phone,
        notes: notes || undefined,
        extras,
        marketing_email: Boolean(prefs.marketing_email),
        marketing_sms: Boolean(prefs.marketing_sms),
        total_cost: totals.total,
        payment_method: paymentMethod,
        payment_plan: effectivePlan,
        deposit_percent: depositPercent,
        amount_paid: summary.amountPaid,
        balance_due: summary.balanceDue,
        payment_status: summary.payment_status,
      });

      writeRentBookingPrefs({ wizard_pending_confirm: false, wizard_step: 'done' });
      toast.success(
        booking?.reference_code
          ? `Κράτηση έτοιμη · ${booking.reference_code}`
          : 'Η κράτηση καταχωρήθηκε',
      );
      navigate('/rent/wallet', { state: { rentBookedAt: Date.now(), highlightBooking: booking?.id } });
    } catch (err) {
      toast.error(err?.message || 'Αποτυχία κράτησης');
    } finally {
      setBusy(false);
    }
  };

  const bankRefPreview = selectedBank
    ? buildBankPaymentReference(selectedBank.reference_template || 'RB-{pnr}', {
        pnr: 'ΝΕΑ-ΚΡΑΤΗΣΗ',
        amount: summary.amountPaid,
        name: `${prefs.client_first_name || ''} ${prefs.client_last_name || ''}`.trim(),
      })
    : '';

  return (
    <div className="rent-wiz rent-wiz--payment">
      <header className="rent-wiz-head">
        <p className="rent-wiz-eyebrow">{brandLabel}</p>
        <h1>Πληρωμή</h1>
        <RentBookingStepper activeId="payment" />
      </header>

      <RentBookingTripSummary prefs={prefs} onEdit={() => navigate('/rent#rent-guest-search')} />

      {!vehicle ? (
        <div className="rent-wiz-empty">
          <p>Δεν έχει επιλεγεί όχημα ακόμα.</p>
          <Link to="/rent#rent-guest-fleet" className="rent-wiz-cta-link">
            Πήγαινε στον στόλο
          </Link>
        </div>
      ) : (
        <div className="rent-wiz-layout">
          <section className="rent-wiz-main" aria-label="Πληρωμή κράτησης">
            {plans.length > 1 && !isCash ? (
              <div className="rent-wiz-form-card">
                <h2>Πλάνο πληρωμής</h2>
                <div className="rent-pay-plans">
                  {plans.map((plan) => {
                    const active = paymentPlan === plan.id;
                    const charge =
                      plan.id === PAYMENT_PLAN_DEPOSIT
                        ? summarizeRentPayment({
                            totalEur: totals.total,
                            plan: PAYMENT_PLAN_DEPOSIT,
                            methodId: 'card',
                            depositPercent,
                          }).amountPaid
                        : totals.total;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        className={`rent-pay-plan${active ? ' is-active' : ''}`}
                        onClick={() => {
                          setPaymentPlan(plan.id);
                          persistPayment({ payment_plan: plan.id });
                        }}
                      >
                        <span className="material-symbols-outlined" aria-hidden>
                          {plan.icon}
                        </span>
                        <span className="rent-pay-plan-copy">
                          <strong>{plan.label}</strong>
                          <em>{plan.description}</em>
                          <small>
                            Τώρα {euroLabel(charge)}
                            {plan.id === PAYMENT_PLAN_DEPOSIT
                              ? ` · υπόλοιπο ${euroLabel(totals.total - charge)} στην παραλαβή`
                              : ''}
                          </small>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {isDeposit ? (
                  <p className="rent-pay-hint">
                    Με την προκαταβολή {depositPercent}% το όχημα δεσμεύεται. Το υπόλοιπο πληρώνεται
                    στην παραλαβή.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="rent-wiz-form-card">
              <h2>{isDeposit ? 'Πληρωμή προκαταβολής' : 'Τρόπος πληρωμής'}</h2>
              <div className="rent-pay-methods">
                {methods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`rent-pay-method${paymentMethod === m.id ? ' is-active' : ''}`}
                    onClick={() => {
                      setPaymentMethod(m.id);
                      persistPayment({ payment_method: m.id });
                    }}
                  >
                    <span className="material-symbols-outlined" aria-hidden>
                      {m.icon}
                    </span>
                    {m.label}
                  </button>
                ))}
              </div>

              {paymentMethod === 'card' ? (
                <div className="rent-pay-card-fields">
                  <label>
                    <span>Αριθμός κάρτας</span>
                    <input
                      inputMode="numeric"
                      placeholder="4242 4242 4242 4242"
                      value={card.number}
                      onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))}
                    />
                  </label>
                  <div className="rent-pay-card-row">
                    <label>
                      <span>Λήξη</span>
                      <input
                        placeholder="MM/YY"
                        value={card.expiry}
                        onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))}
                      />
                    </label>
                    <label>
                      <span>CVV</span>
                      <input
                        inputMode="numeric"
                        placeholder="123"
                        value={card.cvv}
                        onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value }))}
                      />
                    </label>
                  </div>
                  <p className="rent-pay-secure">
                    <span className="material-symbols-outlined" aria-hidden>
                      lock
                    </span>
                    Demo κάρτα — η επεξεργασία γίνεται μέσω ασφαλούς gateway.
                  </p>
                </div>
              ) : null}

              {paymentMethod === 'paypal' ? (
                <p className="rent-pay-soft">Θα ανοίξει PayPal (demo — η κράτηση καταχωρείται τοπικά).</p>
              ) : null}
              {paymentMethod === 'apple' ? (
                <p className="rent-pay-soft">
                  <span className="material-symbols-outlined" aria-hidden>
                    contactless
                  </span>
                  Apple Pay — γρήγορη πληρωμή (demo).
                </p>
              ) : null}

              {isCash ? (
                <p className="rent-pay-hint">
                  Η κράτηση δεσμεύεται τώρα. Πληρώνεις ολόκληρο το ποσό ({euroLabel(totals.total)}) με
                  μετρητά στο γραφείο κατά την παραλαβή.
                </p>
              ) : null}

              {isBank && selectedBank ? (
                <div className="rent-pay-bank">
                  <p className="rent-pay-bank-title">
                    <span className="material-symbols-outlined" aria-hidden>
                      account_balance
                    </span>
                    Στοιχεία κατάθεσης
                  </p>
                  {bankAccounts.length > 1 ? (
                    <label className="rent-pay-bank-select">
                      <span>Λογαριασμός</span>
                      <select
                        value={bankAccountId}
                        onChange={(e) => {
                          setBankAccountId(e.target.value);
                          persistPayment({ payment_bank_account_id: e.target.value });
                        }}
                      >
                        {bankAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.label || acc.bank_name} · {formatIbanDisplay(acc.iban).slice(0, 14)}…
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <dl>
                    <div>
                      <dt>Ποσό τώρα</dt>
                      <dd>{euroLabel(summary.amountPaid)}</dd>
                    </div>
                    <div>
                      <dt>Τράπεζα</dt>
                      <dd>{selectedBank.bank_name}</dd>
                    </div>
                    <div>
                      <dt>Δικαιούχος</dt>
                      <dd>{selectedBank.beneficiary}</dd>
                    </div>
                    <div>
                      <dt>IBAN</dt>
                      <dd className="rent-pay-iban">
                        {formatIbanDisplay(selectedBank.iban)}
                      </dd>
                    </div>
                    {selectedBank.bic ? (
                      <div>
                        <dt>BIC</dt>
                        <dd>{selectedBank.bic}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Αιτιολογία</dt>
                      <dd className="rent-pay-ref">{bankRefPreview}</dd>
                    </div>
                  </dl>
                  {(selectedBank.instructions || settings?.checkout_bank_instructions) && (
                    <p className="rent-pay-bank-note">
                      {selectedBank.instructions || settings.checkout_bank_instructions}
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="rent-pay-due rent-wiz-form-card">
              <div>
                <p className="rent-pay-due-label">Πληρώνεις τώρα</p>
                <p className="rent-pay-due-amount">{euroLabel(summary.amountPaid)}</p>
              </div>
              {summary.balanceDue > 0 ? (
                <div>
                  <p className="rent-pay-due-label">Υπόλοιπο παραλαβής</p>
                  <p className="rent-pay-due-balance">{euroLabel(summary.balanceDue)}</p>
                </div>
              ) : (
                <div>
                  <p className="rent-pay-due-label">Σύνολο</p>
                  <p className="rent-pay-due-balance">{euroLabel(summary.total)}</p>
                </div>
              )}
            </div>

            <button
              type="button"
              className="rent-wiz-next rent-wiz-next--mobile rent-wiz-next--pay"
              disabled={busy}
              onClick={confirmBooking}
            >
              {busy ? 'Καταχώρηση…' : 'Ολοκληρώνω την κράτηση'}
            </button>
          </section>

          <RentBookingVehicleSidebar
            vehicle={vehicle}
            dayCount={dayCount}
            totals={totals}
            selectedLabels={selectedLabels}
            busy={busy}
            ctaLabel="Ολοκληρώνω την κράτηση"
            onChangeVehicle={() => navigate('/rent#rent-guest-fleet')}
            onCta={confirmBooking}
            note={
              summary.balanceDue > 0
                ? `Τώρα ${euroLabel(summary.amountPaid)} · υπόλοιπο ${euroLabel(summary.balanceDue)} στην παραλαβή.`
                : isCash
                  ? `Πληρωμή ${euroLabel(summary.total)} με μετρητά στην παραλαβή.`
                  : 'Μετά την ολοκλήρωση η κράτηση εμφανίζεται στο Rent Wallet.'
            }
          />
        </div>
      )}
    </div>
  );
}
