import { DEFAULT_BANK_TRANSFER_SETTINGS } from './bankTransfer.js';
import { DEFAULT_PAYMENT_SECURITY, normalizePaymentSecurity } from './paymentSecurity.js';

export const DEFAULT_PAYMENT_METHODS = {
  card: { enabled: true, label: 'Πιστωτική / Χρεωστική' },
  paypal: { enabled: true, label: 'PayPal' },
  apple: { enabled: true, label: 'Apple Pay' },
  bank_transfer: { enabled: true, label: 'Τραπεζική μεταφορά' },
  cash_office: { enabled: true, label: 'Μετρητά — γκισέ' },
  cash_driver: { enabled: true, label: 'Μετρητά — οδηγός / λεωφορείο' },
};

export const DEFAULT_PAYMENT_SETTINGS = {
  deposit: { enabled: true, percent: 30 },
  methods: { ...DEFAULT_PAYMENT_METHODS },
  bank_accounts: [
    {
      id: 'bank-default',
      label: 'Eurobank EUR',
      bank_name: 'Eurobank',
      beneficiary: 'PoreiaGo Travel AE',
      iban: 'GR1601101250000000012300695',
      bic: 'ERBKGRAA',
      currency: 'EUR',
      enabled: true,
      is_default: true,
      reference_template: 'VOY-{pnr}',
      instructions: DEFAULT_BANK_TRANSFER_SETTINGS.checkout_bank_instructions,
    },
  ],
  global_bank_instructions: '',
  security: { ...DEFAULT_PAYMENT_SECURITY },
};

export function normalizePaymentSettings(raw = {}) {
  const merged = {
    deposit: {
      ...DEFAULT_PAYMENT_SETTINGS.deposit,
      ...(raw.deposit || {}),
    },
    methods: { ...DEFAULT_PAYMENT_METHODS },
    bank_accounts: [],
    global_bank_instructions: String(raw.global_bank_instructions || '').trim(),
    security: normalizePaymentSecurity(raw.security),
  };

  if (raw.methods && typeof raw.methods === 'object') {
    for (const [key, val] of Object.entries(raw.methods)) {
      merged.methods[key] = {
        ...DEFAULT_PAYMENT_METHODS[key],
        ...val,
        enabled: val?.enabled !== false,
        label: String(val?.label || DEFAULT_PAYMENT_METHODS[key]?.label || key).trim(),
      };
    }
  }

  if (Array.isArray(raw.bank_accounts)) {
    merged.bank_accounts = raw.bank_accounts
      .map(normalizeBankAccount)
      .filter(Boolean);
  }

  if (!merged.bank_accounts.length) {
    merged.bank_accounts = [...DEFAULT_PAYMENT_SETTINGS.bank_accounts];
  }

  let pct = parseInt(String(merged.deposit.percent ?? 30), 10);
  if (!Number.isFinite(pct)) pct = 30;
  merged.deposit.percent = Math.max(5, Math.min(90, pct));
  merged.deposit.enabled = merged.deposit.enabled !== false;

  return merged;
}

export function normalizeBankAccount(raw) {
  if (!raw) return null;
  const iban = String(raw.iban || '').replace(/\s/g, '').trim();
  if (!iban) return null;
  return {
    id: String(raw.id || `bank-${Date.now()}`),
    label: String(raw.label || raw.bank_name || 'Τραπεζικός λογαριασμός').trim(),
    bank_name: String(raw.bank_name || '').trim(),
    beneficiary: String(raw.beneficiary || '').trim(),
    iban,
    bic: String(raw.bic || '').trim(),
    currency: String(raw.currency || 'EUR').trim().toUpperCase() || 'EUR',
    enabled: raw.enabled !== false,
    is_default: Boolean(raw.is_default),
    reference_template: String(raw.reference_template || 'VOY-{pnr}').trim(),
    instructions: String(raw.instructions || '').trim(),
  };
}

export function getEnabledBankAccounts(settings) {
  return (settings?.bank_accounts || []).filter((a) => a.enabled !== false && a.iban);
}

export function getDefaultBankAccount(settings) {
  const enabled = getEnabledBankAccounts(settings);
  return enabled.find((a) => a.is_default) || enabled[0] || null;
}

export function toLegacyCheckoutShape(settings) {
  const normalized = normalizePaymentSettings(settings);
  const account = getDefaultBankAccount(normalized);
  return {
    checkout_deposit_enabled: normalized.deposit.enabled,
    checkout_deposit_percent: normalized.deposit.percent,
    checkout_bank_transfer_enabled: normalized.methods.bank_transfer?.enabled !== false,
    checkout_bank_name: account?.bank_name || '',
    checkout_bank_beneficiary: account?.beneficiary || '',
    checkout_bank_iban: account?.iban || '',
    checkout_bank_bic: account?.bic || '',
    checkout_bank_instructions: account?.instructions || normalized.global_bank_instructions || '',
    checkout_bank_reference_template: account?.reference_template || 'VOY-{pnr}',
    paymentSettings: normalized,
  };
}

export function isPendingBankTransfer(booking) {
  if (!booking) return false;
  const ps = String(booking.paymentStatus || '').toUpperCase();
  const pm = String(booking.paymentMethod || '');
  return (
    booking.status === 'Εκκρεμής' ||
    (ps.includes('PENDING') &&
      (ps.includes('BANK') || ps.includes('ΤΡΑΠΕΖ') || pm.includes('Τραπεζ') || pm.includes('τράπεζ')))
  );
}

export function emptyBankAccountForm() {
  return {
    label: '',
    bank_name: '',
    beneficiary: '',
    iban: '',
    bic: '',
    currency: 'EUR',
    enabled: true,
    is_default: false,
    reference_template: 'VOY-{pnr}',
    instructions: '',
  };
}
