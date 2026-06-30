import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  confirmBankTransferPayment,
  loadBookings,
  recordCashPayment,
} from '../../lib/ticketing/bookingStore.js';
import { formatIbanDisplay } from '../../lib/payments/bankTransfer.js';
import {
  DEFAULT_PAYMENT_SETTINGS,
  emptyBankAccountForm,
  isPendingBankTransfer,
  normalizePaymentSettings,
} from '../../lib/payments/paymentSettings.js';
import { fetchAdminBookings, retryFiscalInvoice, issueFiscalReceipt } from '../../services/adminBookingsApi.js';
import { fetchFiscalQueue, fetchFiscalStats, downloadFiscalInvoicesCsv, fetchFiscalReconciliation, downloadFiscalReconciliationCsv } from '../../services/fiscalQueueApi.js';
import FiscalPipelineHelp from './FiscalPipelineHelp.jsx';
import {
  createBankAccount,
  deleteBankAccount,
  fetchAdminPaymentSettings,
  fetchPaymentAuditLog,
  downloadPaymentAuditCsv,
  updateBankAccount,
  updatePaymentSettings,
} from '../../services/paymentSettingsApi.js';
import ConfirmBankDepositModal from './ConfirmBankDepositModal.jsx';
import RecordCashPaymentModal from './RecordCashPaymentModal.jsx';
import { canRecordCashPayment } from '../../lib/bookingDisplay.js';
import { validateIbanChecksum } from '../../lib/payments/ibanValidation.js';
import { DEFAULT_PAYMENT_SECURITY } from '../../lib/payments/paymentSecurity.js';
import { fiscalInvoiceKindLabel, fiscalProviderLabel, fiscalReceiptStatusLabel } from '../../lib/fiscal/fiscalDisplay.js';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PAYMENT_AUDIT_ACTION_LABELS = {
  bank_deposit_confirmed: 'Επιβεβαίωση κατάθεσης',
  cash_payment_recorded: 'Καταχώρηση μετρητών',
  fiscal_receipt_issued: 'Έκδοση φορολογικής απόδειξης',
  fiscal_receipt_failed: 'Αποτυχία φορολογικής',
  fiscal_receipt_retry: 'Επανάληψη έκδοσης',
  fiscal_manual_issue: 'Χειροκίνητη έκδοση',
};

function paymentAuditActionLabel(action) {
  return PAYMENT_AUDIT_ACTION_LABELS[action] || action;
}

const FISCAL_CSV_STATUS_OPTIONS = [
  { value: '', label: 'Όλες οι καταστάσεις' },
  { value: 'issued', label: 'Εκδόθηκαν' },
  { value: 'failed', label: 'Αποτυχίες' },
  { value: 'pending', label: 'Εκκρεμεί' },
  { value: 'queued', label: 'Σε ουρά' },
];

const RECON_STATUS_LABELS = {
  matched: 'Συμφωνία',
  missing_fiscal: 'Λείπει fiscal',
  failed_receipt: 'Αποτυχία',
  in_progress: 'Σε εξέλιξη',
  no_payment: 'Χωρίς πληρωμή',
};

const RECON_VIEW_OPTIONS = [
  { value: 'gaps', label: 'Μόνο κενά' },
  { value: 'all', label: 'Όλες οι κρατήσεις' },
];

const METHOD_KEYS = [
  { key: 'card', icon: 'credit_card' },
  { key: 'paypal', icon: 'account_balance_wallet' },
  { key: 'apple', icon: 'phone_iphone' },
  { key: 'bank_transfer', icon: 'account_balance' },
  { key: 'cash_office', icon: 'storefront' },
  { key: 'cash_driver', icon: 'directions_bus' },
];

function BankAccountForm({ form, setForm, onSubmit, onCancel, submitLabel }) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-black/[0.08] bg-surface-container-lowest p-4 space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="font-bold text-gray-700">Ετικέτα λογαριασμού</span>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            placeholder="π.χ. Eurobank EUR"
          />
        </label>
        <label className="block text-sm">
          <span className="font-bold text-gray-700">Τράπεζα</span>
          <input
            required
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.bank_name}
            onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="font-bold text-gray-700">Δικαιούχος</span>
          <input
            required
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.beneficiary}
            onChange={(e) => setForm((p) => ({ ...p, beneficiary: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="font-bold text-gray-700">IBAN</span>
          <input
            required
            className="mt-1 w-full rounded-xl border px-3 py-2 font-mono"
            value={form.iban}
            onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="font-bold text-gray-700">BIC / SWIFT</span>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 font-mono"
            value={form.bic}
            onChange={(e) => setForm((p) => ({ ...p, bic: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="font-bold text-gray-700">Νόμισμα</span>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.currency}
            onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="font-bold text-gray-700">Αιτιολογία κατάθεσης</span>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 font-mono text-sm"
            value={form.reference_template}
            onChange={(e) => setForm((p) => ({ ...p, reference_template: e.target.value }))}
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="font-bold text-gray-700">Οδηγίες πελάτη</span>
          <textarea
            rows={2}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm resize-y"
            value={form.instructions}
            onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
        <input
          type="checkbox"
          checked={Boolean(form.enabled)}
          onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
        />
        Ενεργός στο checkout
      </label>
      <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
        <input
          type="checkbox"
          checked={Boolean(form.is_default)}
          onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))}
        />
        Προεπιλεγμένος λογαριασμός
      </label>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="px-4 py-2 rounded-full bg-primary text-white text-sm font-bold">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-full border text-sm font-bold">
            Ακύρωση
          </button>
        )}
      </div>
    </form>
  );
}

export default function PaymentManagementPanel() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(normalizePaymentSettings(DEFAULT_PAYMENT_SETTINGS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [showAddBank, setShowAddBank] = useState(false);
  const [editBankId, setEditBankId] = useState(null);
  const [bankForm, setBankForm] = useState(emptyBankAccountForm());
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmBooking, setConfirmBooking] = useState(null);
  const [cashBooking, setCashBooking] = useState(null);
  const [cashConfirmingId, setCashConfirmingId] = useState(null);
  const [cashDueBookings, setCashDueBookings] = useState([]);
  const [fiscalQueue, setFiscalQueue] = useState([]);
  const [fiscalStats, setFiscalStats] = useState(null);
  const [fiscalReconciliation, setFiscalReconciliation] = useState(null);
  const [fiscalCsvStatus, setFiscalCsvStatus] = useState('');
  const [fiscalExporting, setFiscalExporting] = useState(false);
  const [reconExporting, setReconExporting] = useState(false);
  const [reconOnlyGaps, setReconOnlyGaps] = useState(true);
  const [reconActionId, setReconActionId] = useState(null);
  const [retryingFiscalId, setRetryingFiscalId] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [auditExporting, setAuditExporting] = useState(false);

  const refreshFiscalPanels = useCallback(async () => {
    try {
      setFiscalQueue(await fetchFiscalQueue(50));
    } catch {
      setFiscalQueue([]);
    }
    try {
      setFiscalStats(await fetchFiscalStats(30));
    } catch {
      setFiscalStats(null);
    }
    try {
      setFiscalReconciliation(
        await fetchFiscalReconciliation({
          days: 90,
          onlyGaps: reconOnlyGaps,
          limit: reconOnlyGaps ? 50 : 200,
        }),
      );
    } catch {
      setFiscalReconciliation(null);
    }
  }, [reconOnlyGaps]);

  const loadPending = useCallback(async () => {
    const local = loadBookings().filter(isPendingBankTransfer);
    const localCash = loadBookings().filter(canRecordCashPayment);
    try {
      const remote = await fetchAdminBookings();
      const merged = new Map();
      [...local, ...remote.filter(isPendingBankTransfer)].forEach((b) => merged.set(b.id, b));
      setPendingBookings([...merged.values()]);

      const cashMap = new Map();
      [...localCash, ...remote.filter(canRecordCashPayment)].forEach((b) => cashMap.set(b.id, b));
      setCashDueBookings([...cashMap.values()]);
    } catch {
      setPendingBookings(local);
      setCashDueBookings(localCash);
    }
    await refreshFiscalPanels();
  }, [refreshFiscalPanels]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminPaymentSettings();
      setSettings(data);
      await loadPending();
      try {
        setAuditLog(await fetchPaymentAuditLog(30));
      } catch {
        setAuditLog([]);
      }
    } catch {
      toast.error('Αποτυχία φόρτωσης ρυθμίσεων πληρωμών');
    } finally {
      setLoading(false);
    }
  }, [loadPending]);

  useEffect(() => {
    load();
  }, [load]);

  const fiscalPipelineBusy = useMemo(() => {
    const reconBusy = (fiscalReconciliation?.in_progress || 0) > 0;
    const queueBusy = fiscalQueue.some((item) => {
      const status = String(item.status || '').toLowerCase();
      return status === 'pending' || status === 'queued';
    });
    return reconBusy || queueBusy;
  }, [fiscalReconciliation?.in_progress, fiscalQueue]);

  useEffect(() => {
    if (!fiscalPipelineBusy) return undefined;
    const timer = setInterval(() => {
      refreshFiscalPanels();
    }, 8000);
    return () => clearInterval(timer);
  }, [fiscalPipelineBusy, refreshFiscalPanels]);

  const editAccount = useMemo(
    () => settings.bank_accounts.find((a) => a.id === editBankId) || null,
    [settings.bank_accounts, editBankId],
  );

  useEffect(() => {
    if (!editAccount) return;
    setBankForm({
      label: editAccount.label,
      bank_name: editAccount.bank_name,
      beneficiary: editAccount.beneficiary,
      iban: editAccount.iban,
      bic: editAccount.bic,
      currency: editAccount.currency,
      enabled: editAccount.enabled,
      is_default: editAccount.is_default,
      reference_template: editAccount.reference_template,
      instructions: editAccount.instructions,
    });
  }, [editAccount]);

  const saveCoreSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await updatePaymentSettings({
        deposit: settings.deposit,
        methods: settings.methods,
        global_bank_instructions: settings.global_bank_instructions,
        security: settings.security,
      });
      setSettings(data);
      toast.success('Οι ρυθμίσεις πληρωμών αποθηκεύτηκαν');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  const validateBankIban = (iban) => {
    if (settings.security?.validate_iban_checksum === false) return true;
    return validateIbanChecksum(iban);
  };

  const onAddBank = async (e) => {
    e.preventDefault();
    if (!validateBankIban(bankForm.iban)) {
      toast.error('Μη έγκυρο IBAN (έλεγχος MOD-97)');
      return;
    }
    try {
      await createBankAccount(bankForm);
      setSettings(await fetchAdminPaymentSettings());
      setShowAddBank(false);
      setBankForm(emptyBankAccountForm());
      toast.success('Προστέθηκε τραπεζικός λογαριασμός');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία προσθήκης');
    }
  };

  const onUpdateBank = async (e) => {
    e.preventDefault();
    if (!editBankId) return;
    if (!validateBankIban(bankForm.iban)) {
      toast.error('Μη έγκυρο IBAN (έλεγχος MOD-97)');
      return;
    }
    try {
      await updateBankAccount(editBankId, bankForm);
      setSettings(await fetchAdminPaymentSettings());
      setEditBankId(null);
      toast.success('Ο λογαριασμός ενημερώθηκε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ενημέρωσης');
    }
  };

  const onDeleteBank = async (accountId) => {
    if (!window.confirm('Διαγραφή τραπεζικού λογαριασμού;')) return;
    try {
      const data = await deleteBankAccount(accountId);
      setSettings(data);
      toast.success('Ο λογαριασμός διαγράφηκε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία διαγραφής');
    }
  };

  const onSetDefault = async (accountId) => {
    try {
      await updateBankAccount(accountId, { is_default: true });
      setSettings(await fetchAdminPaymentSettings());
      toast.success('Ορισμός προεπιλογής');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    }
  };

  const onRetryFiscal = async (invoiceId) => {
    setRetryingFiscalId(invoiceId);
    try {
      await retryFiscalInvoice(invoiceId);
      toast.success('Η επανάληψη έκδοσης ξεκίνησε');
      await refreshFiscalPanels();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία επανάληψης');
    } finally {
      setRetryingFiscalId(null);
    }
  };

  const onExportAudit = async (fiscalOnly = false) => {
    setAuditExporting(true);
    try {
      await downloadPaymentAuditCsv({ limit: 200, fiscalOnly });
      toast.success(fiscalOnly ? 'Εξήχθη fiscal audit CSV' : 'Εξήχθη audit CSV');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία εξαγωγής');
    } finally {
      setAuditExporting(false);
    }
  };

  const onExportFiscalInvoices = async (status = fiscalCsvStatus) => {
    setFiscalExporting(true);
    try {
      await downloadFiscalInvoicesCsv({ days: 90, status });
      toast.success('Εξήχθη CSV αποδείξεων');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία εξαγωγής');
    } finally {
      setFiscalExporting(false);
    }
  };

  const onExportReconciliation = async () => {
    setReconExporting(true);
    try {
      await downloadFiscalReconciliationCsv({ days: 90, onlyGaps: reconOnlyGaps });
      toast.success(
        reconOnlyGaps ? 'Εξήχθη reconciliation CSV (κενά)' : 'Εξήχθη reconciliation CSV (όλες)',
      );
    } catch (err) {
      toast.error(err.message || 'Αποτυχία εξαγωγής');
    } finally {
      setReconExporting(false);
    }
  };

  const onReconViewChange = async (e) => {
    const onlyGaps = e.target.value === 'gaps';
    setReconOnlyGaps(onlyGaps);
    try {
      setFiscalReconciliation(
        await fetchFiscalReconciliation({
          days: 90,
          onlyGaps,
          limit: onlyGaps ? 50 : 200,
        }),
      );
    } catch {
      setFiscalReconciliation(null);
    }
  };

  const onReconIssue = async (bookingId) => {
    setReconActionId(`issue:${bookingId}`);
    try {
      await issueFiscalReceipt(bookingId);
      toast.success('Η έκδοση απόδειξης ξεκίνησε');
      await refreshFiscalPanels();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία έκδοσης');
    } finally {
      setReconActionId(null);
    }
  };

  const onReconRetry = async (invoiceId) => {
    setReconActionId(`retry:${invoiceId}`);
    try {
      await retryFiscalInvoice(invoiceId);
      toast.success('Η επανάληψη έκδοσης ξεκίνησε');
      await refreshFiscalPanels();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία επανάληψης');
    } finally {
      setReconActionId(null);
    }
  };

  const openReconBooking = (item) => {
    navigate('/admin', {
      state: {
        activeTab: 'bookings',
        bookingId: item.booking_id,
        bookingPnr: item.pnr,
      },
    });
  };

  const onConfirmDeposit = async (confirmation) => {
    if (!confirmBooking) return;
    setConfirmingId(confirmBooking.id);
    try {
      await confirmBankTransferPayment(confirmBooking.id, confirmation);
      toast.success('Η κατάθεση επιβεβαιώθηκε');
      setConfirmBooking(null);
      await loadPending();
      try {
        setAuditLog(await fetchPaymentAuditLog(30));
      } catch {
        /* ignore */
      }
    } catch (err) {
      toast.error(err.message || 'Αποτυχία επιβεβαίωσης');
    } finally {
      setConfirmingId(null);
    }
  };

  const onConfirmCash = async (payload) => {
    if (!cashBooking) return;
    setCashConfirmingId(cashBooking.id);
    try {
      await recordCashPayment(cashBooking.id, payload);
      toast.success('Η είσπραξη μετρητών καταχωρήθηκε');
      setCashBooking(null);
      await loadPending();
      try {
        setAuditLog(await fetchPaymentAuditLog(30));
      } catch {
        /* ignore */
      }
    } catch (err) {
      toast.error(err.message || 'Αποτυχία καταχώρησης');
    } finally {
      setCashConfirmingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500 py-4">Φόρτωση διαχείρισης πληρωμών…</p>;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={saveCoreSettings} className="bg-white rounded-[24px] border border-black/[0.06] p-6 shadow-sm space-y-5">
        <div>
          <h4 className="font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">payments</span>
            Διαχείριση πληρωμών
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            Τρόποι πληρωμής, προκαταβολή, τραπεζικοί λογαριασμοί και εκκρεμείς καταθέσεις.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-black/[0.06] p-4 space-y-3">
            <p className="text-sm font-bold text-gray-900">Προκαταβολή</p>
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <input
                type="checkbox"
                checked={settings.deposit.enabled}
                onChange={(e) =>
                  setSettings((p) => ({ ...p, deposit: { ...p.deposit, enabled: e.target.checked } }))
                }
              />
              Ενεργή στο checkout
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-600">Ποσοστό %</span>
              <input
                type="number"
                min={5}
                max={90}
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={settings.deposit.percent}
                onChange={(e) =>
                  setSettings((p) => ({
                    ...p,
                    deposit: { ...p.deposit, percent: Number(e.target.value) },
                  }))
                }
              />
            </label>
          </div>

          <div className="rounded-2xl border border-black/[0.06] p-4 space-y-3">
            <p className="text-sm font-bold text-gray-900">Online τρόποι πληρωμής</p>
            {METHOD_KEYS.map(({ key, icon }) => (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={settings.methods[key]?.enabled !== false}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      methods: {
                        ...p.methods,
                        [key]: { ...p.methods[key], enabled: e.target.checked },
                      },
                    }))
                  }
                />
                <span className="material-symbols-outlined text-[18px] text-gray-500">{icon}</span>
                <input
                  className="flex-1 rounded-lg border px-2 py-1 text-sm"
                  value={settings.methods[key]?.label || ''}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      methods: {
                        ...p.methods,
                        [key]: { ...p.methods[key], label: e.target.value },
                      },
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <label className="block text-sm">
          <span className="font-bold text-gray-700">Γενικές οδηγίες τραπεζικής κατάθεσης</span>
          <textarea
            rows={2}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm resize-y"
            value={settings.global_bank_instructions}
            onChange={(e) => setSettings((p) => ({ ...p, global_bank_instructions: e.target.value }))}
          />
        </label>

        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 p-4 space-y-3">
          <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-700">shield</span>
            Ασφάλεια πληρωμών
          </p>
          {[
            {
              key: 'require_amount_on_confirm',
              label: 'Υποχρεωτικό ποσό κατά την επιβεβαίωση κατάθεσης',
            },
            {
              key: 'require_reference_on_confirm',
              label: 'Υποχρεωτική αναφορά / PNR κατά την επιβεβαίωση',
            },
            {
              key: 'validate_iban_checksum',
              label: 'Έλεγχος εγκυρότητας IBAN (MOD-97)',
            },
            {
              key: 'audit_payment_actions',
              label: 'Καταγραφή audit log για επιβεβαιώσεις',
            },
            {
              key: 'mask_iban_public',
              label: 'Απόκρυψη πλήρους IBAN στο checkout μέχρι κλικ',
            },
            {
              key: 'notify_customer_on_payment',
              label: 'Email επιβεβαίωσης στον πελάτη (μερική / πλήρης πληρωμή)',
            },
            {
              key: 'notify_admin_on_payment',
              label: 'Email ειδοποίησης στον διαχειριστή',
            },
            {
              key: 'notify_sms_on_fiscal_receipt',
              label: 'SMS στον πελάτη όταν εκδοθεί MARK (myDATA)',
            },
            {
              key: 'notify_push_on_fiscal_receipt',
              label: 'Browser push στον πελάτη όταν εκδοθεί MARK (Wallet)',
            },
            {
              key: 'notify_erp_on_fiscal_receipt',
              label: 'Webhook ERP όταν εκδοθεί φορολογική απόδειξη',
            },
            {
              key: 'notify_admin_on_fiscal_issues',
              label: 'Email admin για αποτυχίες / stuck fiscal (digest + alerts)',
            },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={
                  key === 'mask_iban_public'
                    ? Boolean(settings.security?.mask_iban_public)
                    : key.startsWith('notify_')
                      ? settings.security?.[key] !== false
                      : settings.security?.[key] !== false
                }
                onChange={(e) =>
                  setSettings((p) => ({
                    ...p,
                    security: {
                      ...(p.security || DEFAULT_PAYMENT_SECURITY),
                      [key]: e.target.checked,
                    },
                  }))
                }
              />
              {label}
            </label>
          ))}
          <label className="block text-sm pt-1">
            <span className="font-bold text-gray-700">Email διαχειριστή (κενό = support email πλατφόρμας)</span>
            <input
              type="email"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={settings.security?.admin_notification_email || ''}
              onChange={(e) =>
                setSettings((p) => ({
                  ...p,
                  security: {
                    ...(p.security || DEFAULT_PAYMENT_SECURITY),
                    admin_notification_email: e.target.value,
                  },
                }))
              }
              placeholder="admin@company.gr"
            />
          </label>

          <div className="pt-3 mt-2 border-t border-emerald-200/60 space-y-3">
            <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">mark_email_unread</span>
              Φίλτρο spam email
            </p>
            {[
              { key: 'email_spam_filter_enabled', label: 'Ενεργό φίλτρο spam (αποστολή & checkout)' },
              { key: 'block_disposable_emails', label: 'Αποκλεισμός disposable / temp mail (yopmail, mailinator…)' },
              { key: 'email_deliverability_headers', label: 'Headers anti-spam (Message-ID, Auto-Submitted…)' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={settings.security?.[key] !== false}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      security: {
                        ...(p.security || DEFAULT_PAYMENT_SECURITY),
                        [key]: e.target.checked,
                      },
                    }))
                  }
                />
                {label}
              </label>
            ))}
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Αποκλεισμένα domains (ένα ανά γραμμή)</span>
              <textarea
                rows={3}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-mono resize-y"
                value={(settings.security?.blocked_email_domains || []).join('\n')}
                onChange={(e) =>
                  setSettings((p) => ({
                    ...p,
                    security: {
                      ...(p.security || DEFAULT_PAYMENT_SECURITY),
                      blocked_email_domains: e.target.value
                        .split(/[\n,;]+/)
                        .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
                        .filter(Boolean),
                    },
                  }))
                }
                placeholder="spamdomain.gr&#10;tempmail.net"
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Επιτρεπόμενα domains μόνο (κενό = όλα εκτός blocklist)</span>
              <textarea
                rows={2}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-mono resize-y"
                value={(settings.security?.allowed_email_domains || []).join('\n')}
                onChange={(e) =>
                  setSettings((p) => ({
                    ...p,
                    security: {
                      ...(p.security || DEFAULT_PAYMENT_SECURITY),
                      allowed_email_domains: e.target.value
                        .split(/[\n,;]+/)
                        .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
                        .filter(Boolean),
                    },
                  }))
                }
                placeholder="gmail.com&#10;yahoo.gr"
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold disabled:opacity-60"
        >
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση ρυθμίσεων'}
        </button>
      </form>

      <div className="bg-white rounded-[24px] border border-black/[0.06] p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">account_balance</span>
              Τραπεζικοί λογαριασμοί
            </h4>
            <p className="text-xs text-gray-500 mt-1">Προσθήκη, επεξεργασία και αφαίρεση λογαριασμών για έμβασμα.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowAddBank(true);
              setEditBankId(null);
              setBankForm(emptyBankAccountForm());
            }}
            className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-bold"
          >
            + Νέος λογαριασμός
          </button>
        </div>

        {showAddBank && (
          <BankAccountForm
            form={bankForm}
            setForm={setBankForm}
            onSubmit={onAddBank}
            onCancel={() => setShowAddBank(false)}
            submitLabel="Προσθήκη λογαριασμού"
          />
        )}

        {editBankId && editAccount && (
          <BankAccountForm
            form={bankForm}
            setForm={setBankForm}
            onSubmit={onUpdateBank}
            onCancel={() => setEditBankId(null)}
            submitLabel="Αποθήκευση αλλαγών"
          />
        )}

        <div className="space-y-3">
          {settings.bank_accounts.map((acc) => (
            <div
              key={acc.id}
              className={`rounded-2xl border p-4 flex flex-wrap gap-4 justify-between ${
                acc.is_default ? 'border-primary/30 bg-primary/[0.04]' : 'border-black/[0.06]'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="font-bold text-gray-900">{acc.label || acc.bank_name}</p>
                  {acc.is_default && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      Προεπιλογή
                    </span>
                  )}
                  {!acc.enabled && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      Ανενεργός
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{acc.bank_name} · {acc.beneficiary}</p>
                <p className="text-sm font-mono text-gray-800 mt-1">{formatIbanDisplay(acc.iban)}</p>
                {acc.bic && <p className="text-xs text-gray-500 mt-1">BIC: {acc.bic}</p>}
              </div>
              <div className="flex flex-wrap gap-2 items-start">
                {!acc.is_default && (
                  <button
                    type="button"
                    onClick={() => onSetDefault(acc.id)}
                    className="px-3 py-1.5 rounded-full border text-xs font-bold"
                  >
                    Προεπιλογή
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditBankId(acc.id);
                    setShowAddBank(false);
                  }}
                  className="px-3 py-1.5 rounded-full border text-xs font-bold"
                >
                  Επεξεργασία
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteBank(acc.id)}
                  className="px-3 py-1.5 rounded-full border border-red-200 text-red-700 text-xs font-bold"
                >
                  Διαγραφή
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[24px] border border-amber-200/60 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">hourglass_top</span>
              Εκκρεμείς τραπεζικές καταθέσεις
            </h4>
            <p className="text-xs text-gray-500 mt-1">Επιβεβαιώστε όταν εμφανιστεί η κατάθεση στον λογαριασμό.</p>
          </div>
          <button
            type="button"
            onClick={loadPending}
            className="px-3 py-1.5 rounded-full border text-xs font-bold"
          >
            Ανανέωση
          </button>
        </div>

        {pendingBookings.length === 0 ? (
          <p className="text-sm text-gray-500">Δεν υπάρχουν εκκρεμείς καταθέσεις.</p>
        ) : (
          <div className="space-y-3">
            {pendingBookings.map((b) => (
              <div key={b.id} className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 flex flex-wrap gap-3 justify-between">
                <div>
                  <p className="font-bold text-gray-900">{b.customerName || '—'}</p>
                  <p className="text-sm text-gray-600">{b.tripTitle} · {b.seat || b.seats?.join(', ')}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {b.pnr || b.id} · €{Number(b.balanceDue || b.price || 0).toFixed(2)} εκκρεμές
                  </p>
                </div>
                <button
                  type="button"
                  disabled={confirmingId === b.id}
                  onClick={() => setConfirmBooking(b)}
                  className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-bold disabled:opacity-60 self-center"
                >
                  {confirmingId === b.id ? '…' : 'Επιβεβαίωση κατάθεσης'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-[24px] border border-amber-200/60 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">payments</span>
              Εκκρεμή υπόλοιπα (μετρητά)
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Κρατήσεις με υπόλοιπο προς είσπραξη στο γκισέ ή από τον οδηγό.
            </p>
          </div>
          <button
            type="button"
            onClick={loadPending}
            className="px-3 py-1.5 rounded-full border text-xs font-bold"
          >
            Ανανέωση
          </button>
        </div>

        {cashDueBookings.length === 0 ? (
          <p className="text-sm text-gray-500">Δεν υπάρχουν κρατήσεις με εκκρεμές υπόλοιπο.</p>
        ) : (
          <div className="space-y-3">
            {cashDueBookings.map((b) => {
              const due = Number(b.balanceDue || 0) || Math.max(0, Number(b.price || 0) - Number(b.amountPaid || 0));
              return (
                <div
                  key={b.id}
                  className="rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50/80 to-white p-4 flex flex-wrap gap-3 justify-between"
                >
                  <div>
                    <p className="font-bold text-gray-900">{b.customerName || '—'}</p>
                    <p className="text-sm text-gray-600">{b.tripTitle} · {b.seat || b.seats?.join(', ')}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {b.pnr || b.id} · υπόλοιπο <strong className="text-amber-800">€{due.toFixed(2)}</strong>
                      {b.amountPaid > 0 && (
                        <span className="text-gray-400"> · πληρώθηκε €{Number(b.amountPaid).toFixed(2)}</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={cashConfirmingId === b.id}
                    onClick={() => setCashBooking(b)}
                    className="px-4 py-2 rounded-full bg-amber-600 text-white text-sm font-bold disabled:opacity-60 self-center hover:bg-amber-700 transition-colors"
                  >
                    {cashConfirmingId === b.id ? '…' : 'Καταχώρηση μετρητών'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-[24px] border border-violet-200/60 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-violet-600">receipt_long</span>
              Φορολογικές εκκολήσεις
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Αποδείξεις σε ουρά, εκκρεμείς ή αποτυχημένες — myDATA MARK.
              Αυτόματη επανάληψη αποτυχιών κάθε ~15 λεπτά · recovery stuck κάθε 10 λεπτά.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <FiscalPipelineHelp />
            <select
              value={fiscalCsvStatus}
              onChange={(e) => setFiscalCsvStatus(e.target.value)}
              className="rounded-full border px-3 py-1.5 text-xs font-bold"
            >
              {FISCAL_CSV_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={fiscalExporting}
              onClick={() => onExportFiscalInvoices()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-bold disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              {fiscalExporting ? '…' : 'CSV αποδείξεων'}
            </button>
            <button
              type="button"
              onClick={loadPending}
              className="px-3 py-1.5 rounded-full border text-xs font-bold"
            >
              Ανανέωση
            </button>
          </div>
        </div>

        {fiscalStats ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-xs flex flex-wrap items-center gap-3 ${
              fiscalStats.health === 'ok'
                ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
                : fiscalStats.health === 'degraded'
                  ? 'border-red-200 bg-red-50/40 text-red-800'
                  : 'border-amber-200 bg-amber-50/50 text-amber-900'
            }`}
          >
            <span className="font-bold uppercase tracking-wide">
              Pipeline:{' '}
              {fiscalStats.health === 'ok'
                ? 'Υγιές'
                : fiscalStats.health === 'degraded'
                  ? 'Αποτυχίες'
                  : 'Σε επεξεργασία'}
            </span>
            {fiscalStats.stuck_candidates > 0 ? (
              <span>Stuck: {fiscalStats.stuck_candidates}</span>
            ) : null}
            {fiscalStats.oldest_open_minutes != null ? (
              <span>Παλαιότερο ανοιχτό: {fiscalStats.oldest_open_minutes} λεπτά</span>
            ) : null}
            {fiscalStats.pipeline ? (
              <span className="text-[11px] opacity-80">
                auto-retry {fiscalStats.pipeline.auto_retry_enabled ? 'on' : 'off'} · recovery{' '}
                {fiscalStats.pipeline.stuck_recovery_enabled ? 'on' : 'off'}
              </span>
            ) : null}
          </div>
        ) : null}

        {fiscalStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Εκδόθηκαν</div>
              <div className="text-2xl font-bold text-emerald-900 tabular-nums">{fiscalStats.issued}</div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                €{Number(fiscalStats.issued_amount_eur || 0).toLocaleString('el-GR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-violet-50/50 px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-violet-700">Επιτυχία</div>
              <div className="text-2xl font-bold text-violet-900 tabular-nums">
                {fiscalStats.success_rate_pct != null ? `${fiscalStats.success_rate_pct}%` : '—'}
              </div>
              <div className="text-[11px] text-violet-600 mt-0.5">τελευταίες {fiscalStats.window_days} ημέρες</div>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Ανοιχτές</div>
              <div className="text-2xl font-bold text-amber-900 tabular-nums">{fiscalStats.open}</div>
              <div className="text-[11px] text-amber-700 mt-0.5">
                {fiscalStats.pending} εκκρεμεί · {fiscalStats.queued} ουρά
              </div>
            </div>
            <div className="rounded-2xl border border-red-100 bg-red-50/40 px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-red-700">Αποτυχίες</div>
              <div className="text-2xl font-bold text-red-900 tabular-nums">{fiscalStats.failed}</div>
              <div className="text-[11px] text-red-600 mt-0.5">
                {fiscalStats.issued_last_7_days} έκδοσες τελευταία 7ημέρα
              </div>
            </div>
          </div>
        ) : null}

        {fiscalStats?.daily?.length > 0 ? (
          <div className="rounded-2xl border border-violet-100 bg-gradient-to-b from-white to-violet-50/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-800">
                Ιστορικό εκδόσεων (14 ημέρες)
              </p>
              <p className="text-[11px] text-gray-500">Εκδόθηκαν vs αποτυχίες ανά ημέρα</p>
            </div>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fiscalStats.daily} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9e5ff" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value, name) => [
                      name === 'amount_eur' ? `€${Number(value).toFixed(2)}` : value,
                      name === 'issued' ? 'Εκδόθηκαν' : name === 'failed' ? 'Αποτυχίες' : 'Ποσό',
                    ]}
                    labelFormatter={(label) => `Ημέρα ${label}`}
                  />
                  <Legend
                    formatter={(value) => (value === 'issued' ? 'Εκδόθηκαν' : 'Αποτυχίες')}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  <Bar dataKey="issued" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="failed" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {fiscalReconciliation ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-800">
                  Reconciliation πληρωμών vs fiscal (90 ημέρες)
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Πληρώθηκε €{Number(fiscalReconciliation.total_paid_eur || 0).toFixed(2)} · εκδόθηκε €
                  {Number(fiscalReconciliation.total_issued_eur || 0).toFixed(2)} · κενό €
                  {Number(fiscalReconciliation.total_gap_eur || 0).toFixed(2)}
                  {fiscalPipelineBusy ? (
                    <span className="ml-2 inline-flex items-center gap-1 text-violet-700 font-semibold">
                      <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                      ανανέωση…
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={reconOnlyGaps ? 'gaps' : 'all'}
                  onChange={onReconViewChange}
                  className="rounded-full border px-3 py-1.5 text-xs font-bold bg-white"
                >
                  {RECON_VIEW_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={reconExporting}
                  onClick={onExportReconciliation}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-800 text-white text-xs font-bold disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  {reconExporting ? '…' : 'CSV reconciliation'}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                Συμφωνία {fiscalReconciliation.matched}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-bold">
                Λείπει fiscal {fiscalReconciliation.with_gaps}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold">
                Αποτυχία {fiscalReconciliation.failed}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                Σε εξέλιξη {fiscalReconciliation.in_progress}
              </span>
            </div>
            {fiscalReconciliation.items?.length ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {fiscalReconciliation.items.map((item) => (
                  <div
                    key={item.booking_id}
                    className="rounded-xl border border-white bg-white px-3 py-2 text-xs text-gray-600 flex flex-wrap justify-between gap-2"
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => openReconBooking(item)}
                        className="font-bold text-violet-700 hover:text-violet-900 hover:underline"
                        title="Άνοιγμα κράτησης"
                      >
                        {item.booking_id}
                      </button>
                      {item.pnr ? (
                        <span className="text-gray-500">
                          {' · '}
                          <button
                            type="button"
                            onClick={() => openReconBooking(item)}
                            className="hover:text-gray-800 hover:underline"
                          >
                            {item.pnr}
                          </button>
                        </span>
                      ) : null}
                      {' · '}
                      {item.customer_name}
                      <span className="block text-gray-500">{item.trip_title}</span>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full font-bold ${
                          item.status === 'matched'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'missing_fiscal'
                            ? 'bg-orange-100 text-orange-800'
                            : item.status === 'failed_receipt'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {RECON_STATUS_LABELS[item.status] || item.status}
                      </span>
                      <p className="tabular-nums">
                        πληρώθηκε €{Number(item.amount_paid_eur).toFixed(2)} · fiscal €
                        {Number(item.issued_fiscal_eur).toFixed(2)}
                        {item.gap_eur > 0 ? ` · κενό €${Number(item.gap_eur).toFixed(2)}` : ''}
                      </p>
                      {item.status === 'missing_fiscal' && !item.failed_invoice_id ? (
                        <button
                          type="button"
                          disabled={reconActionId === `issue:${item.booking_id}`}
                          onClick={() => onReconIssue(item.booking_id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                          {reconActionId === `issue:${item.booking_id}` ? '…' : 'Έκδοση'}
                        </button>
                      ) : null}
                      {item.failed_invoice_id ? (
                        <button
                          type="button"
                          disabled={reconActionId === `retry:${item.failed_invoice_id}`}
                          onClick={() => onReconRetry(item.failed_invoice_id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[14px]">replay</span>
                          {reconActionId === `retry:${item.failed_invoice_id}` ? '…' : 'Επανάληψη'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-emerald-700">
                {reconOnlyGaps
                  ? 'Δεν υπάρχουν κενά πληρωμής/fiscal.'
                  : 'Δεν βρέθηκαν κρατήσεις με πληρωμή στο παράθυρο 90 ημερών.'}
              </p>
            )}
          </div>
        ) : null}

        {fiscalQueue.length === 0 ? (
          <p className="text-sm text-gray-500">Όλες οι αποδείξεις εκδόθηκαν επιτυχώς.</p>
        ) : (
          <div className="space-y-3">
            {fiscalQueue.map((item) => (
              <div
                key={item.invoice_id}
                className={`rounded-2xl border p-4 flex flex-wrap gap-3 justify-between ${
                  item.status === 'failed'
                    ? 'border-red-200 bg-red-50/40'
                    : 'border-violet-100 bg-violet-50/30'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">{item.customer_name || '—'}</p>
                  <p className="text-sm text-gray-600">{item.trip_title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.pnr} · {fiscalInvoiceKindLabel(item.invoice_kind)} · €
                    {Number(item.amount || 0).toFixed(2)}
                    {item.channel ? ` · ${item.channel}` : ''}
                  </p>
                  <p className="text-xs mt-1">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full font-bold border ${
                        item.status === 'failed'
                          ? 'bg-red-100 text-red-800 border-red-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}
                    >
                      {fiscalReceiptStatusLabel(item.status)}
                    </span>
                    {item.provider ? (
                      <span className="ml-2 text-gray-500">{fiscalProviderLabel(item.provider)}</span>
                    ) : null}
                  </p>
                  {item.error_message ? (
                    <p className="text-[11px] text-red-600 mt-1 line-clamp-2" title={item.error_message}>
                      {item.error_message}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 self-center">
                  {item.status === 'failed' ? (
                    <button
                      type="button"
                      disabled={retryingFiscalId === item.invoice_id}
                      onClick={() => onRetryFiscal(item.invoice_id)}
                      className="px-4 py-2 rounded-full bg-red-600 text-white text-sm font-bold disabled:opacity-60"
                    >
                      {retryingFiscalId === item.invoice_id ? '…' : 'Επανάληψη'}
                    </button>
                  ) : (
                    <span className="text-xs text-violet-700 font-medium text-center">Σε επεξεργασία…</span>
                  )}
                  <span className="text-[10px] font-mono text-gray-400 text-center">{item.booking_id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-[24px] border border-black/[0.06] p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-gray-600">history</span>
              Audit log πληρωμών
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Καταγραφή επιβεβαιώσεων καταθέσεων, μετρητών και φορολογικών ενεργειών.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={auditExporting}
              onClick={() => onExportAudit(false)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-bold disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              {auditExporting ? '…' : 'CSV όλων'}
            </button>
            <button
              type="button"
              disabled={auditExporting}
              onClick={() => onExportAudit(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-violet-600 text-white text-xs font-bold disabled:opacity-50 hover:bg-violet-700"
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              Fiscal CSV
            </button>
          </div>
        </div>
        {auditLog.length === 0 ? (
          <p className="text-sm text-gray-500">Δεν υπάρχουν καταγραφές ακόμα.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {auditLog.map((row) => (
              <div key={row.id} className="rounded-xl border border-black/[0.06] px-3 py-2 text-xs text-gray-600">
                <span className="font-bold text-gray-800">{row.booking_id}</span>
                {' · '}
                €{Number(row.amount_eur || 0).toFixed(2)}
                {row.reference && ` · ${row.reference}`}
                <span className="block text-gray-400 mt-0.5">
                  {new Date(row.at).toLocaleString('el-GR')} · {paymentAuditActionLabel(row.action)}
                  {row.detail ? ` · ${row.detail}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmBankDepositModal
        booking={confirmBooking}
        security={settings.security || DEFAULT_PAYMENT_SECURITY}
        open={Boolean(confirmBooking)}
        onClose={() => setConfirmBooking(null)}
        onConfirm={onConfirmDeposit}
        confirming={Boolean(confirmingId)}
      />

      <RecordCashPaymentModal
        booking={cashBooking}
        security={settings.security || DEFAULT_PAYMENT_SECURITY}
        open={Boolean(cashBooking)}
        onClose={() => setCashBooking(null)}
        onConfirm={onConfirmCash}
        confirming={Boolean(cashConfirmingId)}
      />
    </div>
  );
}
