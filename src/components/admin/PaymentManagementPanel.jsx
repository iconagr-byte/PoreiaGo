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
import {
  fetchFiscalQueue,
  fetchFiscalStats,
  downloadFiscalInvoicesCsv,
  fetchFiscalReconciliation,
  downloadFiscalReconciliationCsv,
  abandonFiscalInvoice,
} from '../../services/fiscalQueueApi.js';
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
  { key: 'card', icon: 'credit_card', hint: 'Κάρτα στο checkout' },
  { key: 'paypal', icon: 'account_balance_wallet', hint: 'PayPal wallet' },
  { key: 'apple', icon: 'phone_iphone', hint: 'Apple Pay / Wallet' },
  { key: 'bank_transfer', icon: 'account_balance', hint: 'IBAN & οδηγίες' },
  { key: 'cash_office', icon: 'storefront', hint: 'Πληρωμή στο γκισέ' },
  { key: 'cash_driver', icon: 'directions_bus', hint: 'Είσπραξη από οδηγό' },
];

const DEPOSIT_PRESETS = [20, 30, 50];

const NAV_SECTIONS = [
  { id: 'pay-checkout', label: 'Checkout', icon: 'shopping_cart' },
  { id: 'pay-banks', label: 'Τράπεζες', icon: 'account_balance' },
  { id: 'pay-security', label: 'Ασφάλεια', icon: 'shield' },
  { id: 'pay-pending', label: 'Εκκρεμή', icon: 'hourglass_top' },
  { id: 'pay-fiscal', label: 'Fiscal', icon: 'receipt_long' },
];

const SECURITY_TOGGLES = [
  {
    key: 'require_amount_on_confirm',
    label: 'Υποχρεωτικό ποσό κατά την επιβεβαίωση κατάθεσης',
    hint: 'Ο υπάλληλος πρέπει να καταχωρήσει το ποσό που εμφανίστηκε στον λογαριασμό.',
  },
  {
    key: 'require_reference_on_confirm',
    label: 'Υποχρεωτική αναφορά / PNR κατά την επιβεβαίωση',
    hint: 'Μειώνει λάθη αντιστοίχισης καταθέσεων.',
  },
  {
    key: 'validate_iban_checksum',
    label: 'Έλεγχος εγκυρότητας IBAN (MOD-97)',
    hint: 'Αποτρέπει αποθήκευση λάθους IBAN.',
  },
  {
    key: 'audit_payment_actions',
    label: 'Καταγραφή audit log για επιβεβαιώσεις',
    hint: 'Ιστορικό ποιος επιβεβαίωσε κάθε πληρωμή.',
  },
  {
    key: 'mask_iban_public',
    label: 'Απόκρυψη πλήρους IBAN στο checkout μέχρι κλικ',
    hint: 'Εμφανίζει μόνο μέρος του IBAN δημόσια.',
  },
  {
    key: 'notify_customer_on_payment',
    label: 'Email επιβεβαίωσης στον πελάτη',
    hint: 'Μερική ή πλήρης πληρωμή.',
  },
  {
    key: 'notify_admin_on_payment',
    label: 'Email ειδοποίησης στον διαχειριστή',
    hint: 'Όταν καταχωρείται πληρωμή.',
  },
  {
    key: 'notify_sms_on_fiscal_receipt',
    label: 'SMS στον πελάτη όταν εκδοθεί MARK',
    hint: 'myDATA φορολογική απόδειξη.',
  },
  {
    key: 'notify_push_on_fiscal_receipt',
    label: 'Browser push στον πελάτη (Wallet)',
    hint: 'Όταν εκδοθεί MARK.',
  },
  {
    key: 'notify_erp_on_fiscal_receipt',
    label: 'Webhook ERP σε φορολογική απόδειξη',
    hint: 'Συγχρονισμός με εξωτερικό σύστημα.',
  },
  {
    key: 'notify_admin_on_fiscal_issues',
    label: 'Email admin για αποτυχίες / stuck fiscal',
    hint: 'Digest και alerts.',
  },
];

const SPAM_TOGGLES = [
  { key: 'email_spam_filter_enabled', label: 'Ενεργό φίλτρο spam', hint: 'Ελέγχει αποστολή & checkout.' },
  {
    key: 'block_disposable_emails',
    label: 'Αποκλεισμός disposable / temp mail',
    hint: 'yopmail, mailinator κ.ά.',
  },
  {
    key: 'email_deliverability_headers',
    label: 'Headers anti-spam',
    hint: 'Message-ID, Auto-Submitted…',
  },
];

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const textareaClass = `${inputClass} resize-y min-h-[88px]`;

function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-bold text-slate-800">{label}</span>
      {hint ? <p className="mt-0.5 text-xs text-slate-500 leading-snug">{hint}</p> : null}
      {children}
    </label>
  );
}

function SectionCard({ id, icon, title, description, children, accent = 'bg-primary', action = null }) {
  return (
    <section
      id={id}
      className="scroll-mt-28 overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/[0.04] bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${accent} text-white shadow-sm`}
          >
            <span className="material-symbols-outlined text-[22px]">{icon}</span>
          </span>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 text-[17px] leading-tight">{title}</h3>
            {description ? (
              <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-2xl">{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function ToggleRow({ checked, onChange, title, hint, danger = false }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 transition-colors ${
        danger && checked
          ? 'border-amber-300 bg-amber-50'
          : checked
            ? 'border-primary/20 bg-primary/[0.04]'
            : 'border-slate-200 bg-slate-50/80'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">{title}</p>
        {hint ? <p className="mt-0.5 text-xs text-slate-500 leading-snug">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? (danger ? 'bg-amber-500' : 'bg-primary') : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function StatusChip({ icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    violet: 'border-violet-200 bg-violet-50 text-violet-800',
  };
  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-70">
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}

function BankAccountForm({ form, setForm, onSubmit, onCancel, submitLabel }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white p-4 sm:p-5 space-y-4">
      <div className="grid md:grid-cols-2 gap-3.5">
        <Field label="Ετικέτα λογαριασμού" hint="Εμφανίζεται στο checkout">
          <input
            className={inputClass}
            value={form.label}
            onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
            placeholder="π.χ. Eurobank EUR"
          />
        </Field>
        <Field label="Τράπεζα">
          <input
            required
            className={inputClass}
            value={form.bank_name}
            onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
          />
        </Field>
        <Field label="Δικαιούχος" className="md:col-span-2">
          <input
            required
            className={inputClass}
            value={form.beneficiary}
            onChange={(e) => setForm((p) => ({ ...p, beneficiary: e.target.value }))}
          />
        </Field>
        <Field label="IBAN">
          <input
            required
            className={`${inputClass} font-mono tracking-wide`}
            value={form.iban}
            onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value }))}
          />
        </Field>
        <Field label="BIC / SWIFT">
          <input
            className={`${inputClass} font-mono`}
            value={form.bic}
            onChange={(e) => setForm((p) => ({ ...p, bic: e.target.value }))}
          />
        </Field>
        <Field label="Νόμισμα">
          <input
            className={inputClass}
            value={form.currency}
            onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
          />
        </Field>
        <Field label="Αιτιολογία κατάθεσης" hint="π.χ. VOY-{pnr}">
          <input
            className={`${inputClass} font-mono text-sm`}
            value={form.reference_template}
            onChange={(e) => setForm((p) => ({ ...p, reference_template: e.target.value }))}
          />
        </Field>
        <Field label="Οδηγίες πελάτη" className="md:col-span-2" hint="Εμφανίζονται μαζί με τον λογαριασμό">
          <textarea
            rows={2}
            className={textareaClass}
            value={form.instructions}
            onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
          />
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <ToggleRow
          checked={Boolean(form.enabled)}
          onChange={(v) => setForm((p) => ({ ...p, enabled: v }))}
          title="Ενεργός στο checkout"
          hint="Ο πελάτης μπορεί να τον επιλέξει για έμβασμα."
        />
        <ToggleRow
          checked={Boolean(form.is_default)}
          onChange={(v) => setForm((p) => ({ ...p, is_default: v }))}
          title="Προεπιλεγμένος λογαριασμός"
          hint="Εμφανίζεται πρώτος στις οδηγίες κατάθεσης."
        />
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onSubmit}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary text-white text-sm font-bold shadow-sm hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-full border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Ακύρωση
          </button>
        )}
      </div>
    </div>
  );
}

export default function PaymentManagementPanel() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(normalizePaymentSettings(DEFAULT_PAYMENT_SETTINGS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [activeNav, setActiveNav] = useState('pay-checkout');
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

  const applySettings = useCallback((data, { markClean = false } = {}) => {
    const normalized = normalizePaymentSettings(data);
    setSettings(normalized);
    if (markClean) {
      setDirty(false);
    }
  }, []);

  /** Refresh bank list from server without wiping unsaved checkout/security edits. */
  const mergeBankAccountsFromServer = useCallback(async () => {
    const data = normalizePaymentSettings(await fetchAdminPaymentSettings());
    setSettings((prev) => ({
      ...prev,
      bank_accounts: data.bank_accounts,
    }));
  }, []);

  const patchSettings = useCallback((updater) => {
    setSettings((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
    setDirty(true);
  }, []);

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
      applySettings(data, { markClean: true });
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
  }, [applySettings, loadPending]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ids = NAV_SECTIONS.map((s) => s.id);
    const nodes = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!nodes.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveNav(visible.target.id);
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [loading]);

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
    e?.preventDefault?.();
    setSaving(true);
    try {
      const data = await updatePaymentSettings({
        deposit: settings.deposit,
        methods: settings.methods,
        global_bank_instructions: settings.global_bank_instructions,
        security: settings.security,
      });
      applySettings(data, { markClean: true });
      setLastSavedAt(new Date());
      toast.success('Οι ρυθμίσεις πληρωμών αποθηκεύτηκαν');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  const discardCoreChanges = async () => {
    await load();
    toast.success('Οι αλλαγές απορρίφθηκαν');
  };

  const enabledMethodsCount = useMemo(
    () => METHOD_KEYS.filter(({ key }) => settings.methods[key]?.enabled !== false).length,
    [settings.methods],
  );

  const enabledBanksCount = useMemo(
    () => (settings.bank_accounts || []).filter((a) => a.enabled !== false).length,
    [settings.bank_accounts],
  );

  const scrollTo = (id) => {
    setActiveNav(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const setSecurityFlag = (key, value) => {
    patchSettings((p) => ({
      ...p,
      security: {
        ...(p.security || DEFAULT_PAYMENT_SECURITY),
        [key]: value,
      },
    }));
  };

  const securityChecked = (key) => {
    if (key === 'mask_iban_public') return Boolean(settings.security?.mask_iban_public);
    return settings.security?.[key] !== false;
  };

  const validateBankIban = (iban) => {
    if (settings.security?.validate_iban_checksum === false) return true;
    return validateIbanChecksum(iban);
  };

  const onAddBank = async (e) => {
    e?.preventDefault?.();
    if (!String(bankForm.bank_name || '').trim() || !String(bankForm.beneficiary || '').trim() || !String(bankForm.iban || '').trim()) {
      toast.error('Συμπληρώστε τράπεζα, δικαιούχο και IBAN');
      return;
    }
    if (!validateBankIban(bankForm.iban)) {
      toast.error('Μη έγκυρο IBAN (έλεγχος MOD-97)');
      return;
    }
    try {
      await createBankAccount(bankForm);
      await mergeBankAccountsFromServer();
      setShowAddBank(false);
      setBankForm(emptyBankAccountForm());
      toast.success('Προστέθηκε τραπεζικός λογαριασμός');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία προσθήκης');
    }
  };

  const onUpdateBank = async (e) => {
    e?.preventDefault?.();
    if (!editBankId) return;
    if (!String(bankForm.bank_name || '').trim() || !String(bankForm.beneficiary || '').trim() || !String(bankForm.iban || '').trim()) {
      toast.error('Συμπληρώστε τράπεζα, δικαιούχο και IBAN');
      return;
    }
    if (!validateBankIban(bankForm.iban)) {
      toast.error('Μη έγκυρο IBAN (έλεγχος MOD-97)');
      return;
    }
    try {
      await updateBankAccount(editBankId, bankForm);
      await mergeBankAccountsFromServer();
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
      setSettings((prev) => ({
        ...prev,
        bank_accounts: normalizePaymentSettings(data).bank_accounts,
      }));
      toast.success('Ο λογαριασμός διαγράφηκε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία διαγραφής');
    }
  };

  const onSetDefault = async (accountId) => {
    try {
      await updateBankAccount(accountId, { is_default: true });
      await mergeBankAccountsFromServer();
      toast.success('Ορισμός προεπιλογής');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    }
  };

  const onAbandonFiscal = async (invoiceId) => {
    if (!window.confirm('Κλείσιμο αυτής της εκκρεμούς απόδειξης; Δεν θα εκδοθεί MARK.')) return;
    setRetryingFiscalId(invoiceId);
    try {
      await abandonFiscalInvoice(invoiceId, 'Abandoned by admin from payments panel');
      toast.success('Η εκκρεμότητα έκλεισε');
      await refreshFiscalPanels();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία κλεισίματος');
    } finally {
      setRetryingFiscalId(null);
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
    return (
      <div className="rounded-[24px] border border-black/[0.06] bg-white px-6 py-16 text-center shadow-sm">
        <span className="material-symbols-outlined animate-spin text-primary text-[28px]">
          progress_activity
        </span>
        <p className="mt-3 text-sm text-slate-500">Φόρτωση διαχείρισης πληρωμών…</p>
      </div>
    );
  }

  return (
    <form onSubmit={saveCoreSettings} className="relative space-y-5 pb-24">
      <div className="overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-sm">
        <div className="bg-gradient-to-br from-sky-50 via-white to-emerald-50/50 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700/80">
                Checkout & εισπράξεις
              </p>
              <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Διαχείριση πληρωμών
              </h3>
              <p className="mt-1.5 max-w-xl text-sm text-slate-600">
                Προκαταβολή, τρόποι πληρωμής, τραπεζικοί λογαριασμοί και επιβεβαίωση καταθέσεων — με ένα αποθήκευση.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Ανανέωση
              </button>
              <button
                type="submit"
                disabled={saving || !dirty}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatusChip
              icon="percent"
              label="Προκαταβολή"
              value={settings.deposit.enabled ? `${settings.deposit.percent}%` : 'Ανενεργή'}
              tone={settings.deposit.enabled ? 'sky' : 'slate'}
            />
            <StatusChip
              icon="payments"
              label="Ενεργοί τρόποι"
              value={`${enabledMethodsCount} / ${METHOD_KEYS.length}`}
              tone="emerald"
            />
            <StatusChip
              icon="account_balance"
              label="Τράπεζες"
              value={`${enabledBanksCount} ενεργ${enabledBanksCount === 1 ? 'ή' : 'ές'}`}
              tone="violet"
            />
            <StatusChip
              icon="hourglass_top"
              label="Εκκρεμή"
              value={`${pendingBookings.length + cashDueBookings.length} ανοιχτά`}
              tone={pendingBookings.length + cashDueBookings.length ? 'amber' : 'slate'}
            />
          </div>
        </div>

        <nav className="flex gap-1.5 overflow-x-auto border-t border-black/[0.04] px-3 py-2.5 sm:px-4">
          {NAV_SECTIONS.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <SectionCard
        id="pay-checkout"
        icon="shopping_cart"
        title="Checkout"
        description="Προκαταβολή και τρόποι πληρωμής που βλέπει ο πελάτης."
        accent="bg-sky-600"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/90 to-white p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">Προκαταβολή</p>
                <p className="mt-0.5 text-xs text-slate-500">Ποσοστό που ζητείται στο checkout.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.deposit.enabled}
                onClick={() =>
                  patchSettings((p) => ({
                    ...p,
                    deposit: { ...p.deposit, enabled: !p.deposit.enabled },
                  }))
                }
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                  settings.deposit.enabled ? 'bg-primary' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    settings.deposit.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div
              className={`rounded-2xl border px-4 py-5 text-center transition ${
                settings.deposit.enabled
                  ? 'border-primary/20 bg-primary/[0.04]'
                  : 'border-slate-200 bg-slate-50 opacity-60'
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ποσοστό</p>
              <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-slate-900">
                {settings.deposit.percent}
                <span className="ml-1 text-2xl text-slate-400">%</span>
              </p>
            </div>

            <Field label="Προσαρμογή %" hint="Επιτρεπτό εύρος 5–90%">
              <input
                type="number"
                min={5}
                max={90}
                disabled={!settings.deposit.enabled}
                className={inputClass}
                value={settings.deposit.percent}
                onChange={(e) =>
                  patchSettings((p) => ({
                    ...p,
                    deposit: { ...p.deposit, percent: Number(e.target.value) },
                  }))
                }
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              {DEPOSIT_PRESETS.map((pct) => {
                const active = settings.deposit.percent === pct;
                return (
                  <button
                    key={pct}
                    type="button"
                    disabled={!settings.deposit.enabled}
                    onClick={() =>
                      patchSettings((p) => ({
                        ...p,
                        deposit: { ...p.deposit, percent: pct },
                      }))
                    }
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition disabled:opacity-40 ${
                      active
                        ? 'bg-primary text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {pct}%
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">Τρόποι πληρωμής</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Ενεργοποίηση και όνομα όπως εμφανίζεται στον πελάτη.
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                {enabledMethodsCount} ενεργοί
              </span>
            </div>

            <div className="space-y-2.5">
              {METHOD_KEYS.map(({ key, icon, hint }) => {
                const enabled = settings.methods[key]?.enabled !== false;
                return (
                  <div
                    key={key}
                    className={`flex flex-col gap-3 rounded-2xl border px-3.5 py-3 sm:flex-row sm:items-center transition-colors ${
                      enabled
                        ? 'border-primary/20 bg-primary/[0.03]'
                        : 'border-slate-200 bg-slate-50/70'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          enabled ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{icon}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <input
                          className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 text-sm font-bold text-slate-900 outline-none transition focus:border-slate-200 focus:bg-white focus:px-2"
                          value={settings.methods[key]?.label || ''}
                          onChange={(e) =>
                            patchSettings((p) => ({
                              ...p,
                              methods: {
                                ...p.methods,
                                [key]: { ...p.methods[key], label: e.target.value },
                              },
                            }))
                          }
                          aria-label={`Όνομα τρόπου ${key}`}
                        />
                        <p className="px-1 text-[11px] text-slate-500">{hint}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() =>
                        patchSettings((p) => ({
                          ...p,
                          methods: {
                            ...p.methods,
                            [key]: { ...p.methods[key], enabled: !enabled },
                          },
                        }))
                      }
                      className={`relative h-7 w-12 shrink-0 self-end rounded-full transition-colors sm:self-center ${
                        enabled ? 'bg-primary' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                          enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <Field
            label="Γενικές οδηγίες τραπεζικής κατάθεσης"
            hint="Εμφανίζονται σε όλους τους λογαριασμούς. Οι οδηγίες ανά λογαριασμό προστίθενται από κάτω."
          >
            <textarea
              rows={3}
              className={textareaClass}
              value={settings.global_bank_instructions}
              onChange={(e) =>
                patchSettings((p) => ({ ...p, global_bank_instructions: e.target.value }))
              }
              placeholder="π.χ. Μετά την κατάθεση στείλτε το αποδεικτικό στο…"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        id="pay-banks"
        icon="account_balance"
        title="Τραπεζικοί λογαριασμοί"
        description="IBAN για έμβασμα — αποθηκεύονται αμέσως (ξεχωριστά από το Αποθήκευση πάνω)."
        accent="bg-violet-600"
        action={
          <button
            type="button"
            onClick={() => {
              setShowAddBank(true);
              setEditBankId(null);
              setBankForm(emptyBankAccountForm());
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Νέος λογαριασμός
          </button>
        }
      >
        {showAddBank && (
          <div className="mb-4">
            <BankAccountForm
              form={bankForm}
              setForm={setBankForm}
              onSubmit={onAddBank}
              onCancel={() => setShowAddBank(false)}
              submitLabel="Προσθήκη λογαριασμού"
            />
          </div>
        )}

        {editBankId && editAccount && (
          <div className="mb-4">
            <BankAccountForm
              form={bankForm}
              setForm={setBankForm}
              onSubmit={onUpdateBank}
              onCancel={() => setEditBankId(null)}
              submitLabel="Αποθήκευση αλλαγών"
            />
          </div>
        )}

        <div className="space-y-3">
          {settings.bank_accounts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
              Δεν υπάρχουν λογαριασμοί — προσθέστε έναν για τραπεζική μεταφορά.
            </p>
          ) : (
            settings.bank_accounts.map((acc) => (
              <div
                key={acc.id}
                className={`rounded-2xl border p-4 flex flex-wrap gap-4 justify-between transition ${
                  acc.is_default
                    ? 'border-primary/30 bg-primary/[0.04]'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-bold text-slate-900">{acc.label || acc.bank_name}</p>
                    {acc.is_default && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        Προεπιλογή
                      </span>
                    )}
                    {!acc.enabled && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        Ανενεργός
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">
                    {acc.bank_name} · {acc.beneficiary}
                  </p>
                  <p className="text-sm font-mono text-slate-800 mt-1.5 tracking-wide">
                    {formatIbanDisplay(acc.iban)}
                  </p>
                  {acc.bic ? <p className="text-xs text-slate-500 mt-1">BIC: {acc.bic}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2 items-start">
                  {!acc.is_default && (
                    <button
                      type="button"
                      onClick={() => onSetDefault(acc.id)}
                      className="px-3 py-1.5 rounded-full border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
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
                    className="px-3 py-1.5 rounded-full border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Επεξεργασία
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteBank(acc.id)}
                    className="px-3 py-1.5 rounded-full border border-red-200 text-red-700 text-xs font-bold hover:bg-red-50"
                  >
                    Διαγραφή
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard
        id="pay-security"
        icon="shield"
        title="Ασφάλεια & ειδοποιήσεις"
        description="Έλεγχοι επιβεβαίωσης, απόκρυψη IBAN, emails και φίλτρο spam."
        accent="bg-emerald-600"
      >
        <div className="space-y-2.5">
          {SECURITY_TOGGLES.map(({ key, label, hint }) => (
            <ToggleRow
              key={key}
              checked={securityChecked(key)}
              onChange={(v) => setSecurityFlag(key, v)}
              title={label}
              hint={hint}
            />
          ))}
        </div>

        <div className="mt-5">
          <Field
            label="Email διαχειριστή"
            hint="Κενό = support email πλατφόρμας"
          >
            <input
              type="email"
              className={inputClass}
              value={settings.security?.admin_notification_email || ''}
              onChange={(e) => setSecurityFlag('admin_notification_email', e.target.value)}
              placeholder="admin@company.gr"
            />
          </Field>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200/70 bg-amber-50/40 p-4 sm:p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
              <span className="material-symbols-outlined text-[18px]">mark_email_unread</span>
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">Φίλτρο spam email</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Μπλοκάρει ύποπτες διευθύνσεις στο checkout και στις αποστολές.
              </p>
            </div>
          </div>
          <div className="space-y-2.5">
            {SPAM_TOGGLES.map(({ key, label, hint }) => (
              <ToggleRow
                key={key}
                checked={settings.security?.[key] !== false}
                onChange={(v) => setSecurityFlag(key, v)}
                title={label}
                hint={hint}
              />
            ))}
          </div>
          <div className="grid gap-3.5 md:grid-cols-2 pt-1">
            <Field label="Αποκλεισμένα domains" hint="Ένα ανά γραμμή">
              <textarea
                rows={3}
                className={`${textareaClass} font-mono text-[13px]`}
                value={(settings.security?.blocked_email_domains || []).join('\n')}
                onChange={(e) =>
                  setSecurityFlag(
                    'blocked_email_domains',
                    e.target.value
                      .split(/[\n,;]+/)
                      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
                      .filter(Boolean),
                  )
                }
                placeholder={'spamdomain.gr\ntempmail.net'}
              />
            </Field>
            <Field label="Επιτρεπόμενα domains μόνο" hint="Κενό = όλα εκτός blocklist">
              <textarea
                rows={3}
                className={`${textareaClass} font-mono text-[13px]`}
                value={(settings.security?.allowed_email_domains || []).join('\n')}
                onChange={(e) =>
                  setSecurityFlag(
                    'allowed_email_domains',
                    e.target.value
                      .split(/[\n,;]+/)
                      .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
                      .filter(Boolean),
                  )
                }
                placeholder={'gmail.com\nyahoo.gr'}
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        id="pay-pending"
        icon="hourglass_top"
        title="Εκκρεμείς τραπεζικές καταθέσεις"
        description="Επιβεβαιώστε όταν εμφανιστεί η κατάθεση στον λογαριασμό."
        accent="bg-amber-500"
        action={
          <button
            type="button"
            onClick={loadPending}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[15px]">refresh</span>
            Ανανέωση
          </button>
        }
      >
        {pendingBookings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 px-4 py-8 text-center text-sm text-slate-500">
            Δεν υπάρχουν εκκρεμείς καταθέσεις.
          </p>
        ) : (
          <div className="space-y-3">
            {pendingBookings.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 flex flex-wrap gap-3 justify-between"
              >
                <div>
                  <p className="font-bold text-slate-900">{b.customerName || '—'}</p>
                  <p className="text-sm text-slate-600">
                    {b.tripTitle} · {b.seat || b.seats?.join(', ')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {b.pnr || b.id} · €{Number(b.balanceDue || b.price || 0).toFixed(2)} εκκρεμές
                  </p>
                </div>
                <button
                  type="button"
                  disabled={confirmingId === b.id}
                  onClick={() => setConfirmBooking(b)}
                  className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-bold disabled:opacity-60 self-center hover:bg-emerald-700"
                >
                  {confirmingId === b.id ? '…' : 'Επιβεβαίωση κατάθεσης'}
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon="payments"
        title="Εκκρεμή υπόλοιπα (μετρητά)"
        description="Κρατήσεις με υπόλοιπο προς είσπραξη στο γκισέ ή από τον οδηγό."
        accent="bg-amber-600"
        action={
          <button
            type="button"
            onClick={loadPending}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[15px]">refresh</span>
            Ανανέωση
          </button>
        }
      >

        {cashDueBookings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/40 px-4 py-8 text-center text-sm text-slate-500">
            Δεν υπάρχουν κρατήσεις με εκκρεμές υπόλοιπο.
          </p>
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
                    <p className="font-bold text-slate-900">{b.customerName || '—'}</p>
                    <p className="text-sm text-slate-600">
                      {b.tripTitle} · {b.seat || b.seats?.join(', ')}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {b.pnr || b.id} · υπόλοιπο <strong className="text-amber-800">€{due.toFixed(2)}</strong>
                      {b.amountPaid > 0 && (
                        <span className="text-slate-400"> · πληρώθηκε €{Number(b.amountPaid).toFixed(2)}</span>
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
      </SectionCard>

      <div
        id="pay-fiscal"
        className="scroll-mt-28 bg-white rounded-[24px] border border-violet-200/60 p-6 shadow-sm space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-violet-600">receipt_long</span>
              Φορολογικές εκδόσεις
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
                  <button
                    type="button"
                    disabled={retryingFiscalId === item.invoice_id}
                    onClick={() => onAbandonFiscal(item.invoice_id)}
                    className="px-4 py-2 rounded-full border border-slate-200 text-slate-700 text-sm font-bold disabled:opacity-60"
                  >
                    Κλείσιμο
                  </button>
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

      <div
        className={`sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-md transition ${
          dirty ? 'border-amber-200 bg-white/95' : 'border-slate-200 bg-white/90'
        }`}
      >
        <div className="text-xs font-medium text-slate-600">
          {saving ? (
            <span className="text-slate-500">Αποθήκευση σε εξέλιξη…</span>
          ) : dirty ? (
            <span className="text-amber-800">Υπάρχουν μη αποθηκευμένες αλλαγές</span>
          ) : lastSavedAt ? (
            <span className="text-emerald-700">
              Αποθηκεύτηκε{' '}
              {lastSavedAt.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            <span>Όλα αποθηκευμένα</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={discardCoreChanges}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Απόρριψη
          </button>
          <button
            type="submit"
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση πληρωμών'}
          </button>
        </div>
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
    </form>
  );
}
