export const PAYMENT_METHOD_BANK = 'bank_transfer';

export const DEFAULT_BANK_TRANSFER_SETTINGS = {
  checkout_bank_transfer_enabled: true,
  checkout_bank_name: 'Eurobank',
  checkout_bank_beneficiary: 'PoreiaGo Travel AE',
  checkout_bank_iban: 'GR1601101250000000012300695',
  checkout_bank_bic: 'ERBKGRAA',
  checkout_bank_instructions:
    'Μετά την κατάθεση, στείλτε την απόδειξη στο email υποστήριξης. Η κράτηση επιβεβαιώνεται εντός 24 ωρών.',
  checkout_bank_reference_template: 'VOY-{pnr}',
};

const METHOD_META = {
  card: { id: 'card', icon: 'credit_card' },
  paypal: { id: 'paypal', icon: 'account_balance_wallet' },
  apple: { id: 'apple', icon: 'phone_iphone' },
  bank_transfer: { id: PAYMENT_METHOD_BANK, icon: 'account_balance' },
};

/** Flat legacy shape from checkoutSettingsApi */
export function normalizeBankTransferSettings(raw = {}) {
  const merged = { ...DEFAULT_BANK_TRANSFER_SETTINGS, ...raw };
  merged.checkout_bank_transfer_enabled =
    merged.checkout_bank_transfer_enabled !== undefined
      ? Boolean(merged.checkout_bank_transfer_enabled)
      : DEFAULT_BANK_TRANSFER_SETTINGS.checkout_bank_transfer_enabled;
  merged.checkout_bank_name = String(merged.checkout_bank_name || DEFAULT_BANK_TRANSFER_SETTINGS.checkout_bank_name).trim();
  merged.checkout_bank_beneficiary = String(
    merged.checkout_bank_beneficiary || DEFAULT_BANK_TRANSFER_SETTINGS.checkout_bank_beneficiary,
  ).trim();
  merged.checkout_bank_iban = String(merged.checkout_bank_iban || DEFAULT_BANK_TRANSFER_SETTINGS.checkout_bank_iban)
    .replace(/\s/g, '')
    .trim();
  merged.checkout_bank_bic = String(merged.checkout_bank_bic || DEFAULT_BANK_TRANSFER_SETTINGS.checkout_bank_bic).trim();
  merged.checkout_bank_instructions = String(
    merged.checkout_bank_instructions || DEFAULT_BANK_TRANSFER_SETTINGS.checkout_bank_instructions,
  ).trim();
  merged.checkout_bank_reference_template = String(
    merged.checkout_bank_reference_template || DEFAULT_BANK_TRANSFER_SETTINGS.checkout_bank_reference_template,
  ).trim();
  return merged;
}

export function isBankTransferAvailable(settings) {
  if (settings?.methods && settings?.bank_accounts) {
    const enabled = settings.methods.bank_transfer?.enabled !== false;
    const accounts = (settings.bank_accounts || []).filter((a) => a.enabled !== false && a.iban);
    return enabled && accounts.length > 0;
  }
  const bank = normalizeBankTransferSettings(settings);
  return bank.checkout_bank_transfer_enabled && Boolean(bank.checkout_bank_iban);
}

/** @param {object} settings payment settings or legacy checkout bundle */
export function getCheckoutPaymentMethods(settings) {
  const methods = [];
  if (settings?.methods) {
    for (const [key, meta] of Object.entries(METHOD_META)) {
      const row = settings.methods[key];
      if (!row || row.enabled === false) continue;
      if (key === 'bank_transfer' && !isBankTransferAvailable(settings)) continue;
      methods.push({
        id: meta.id,
        icon: meta.icon,
        label: row.label || key,
      });
    }
    return methods;
  }
  if (settings?.checkout_deposit_enabled !== undefined || settings?.checkout_bank_iban) {
    const legacy = normalizeBankTransferSettings(settings);
    methods.push(
      { id: 'card', label: 'Πιστωτική / Χρεωστική', icon: 'credit_card' },
      { id: 'paypal', label: 'PayPal', icon: 'account_balance_wallet' },
      { id: 'apple', label: 'Apple Pay', icon: 'phone_iphone' },
    );
    if (isBankTransferAvailable(legacy)) {
      methods.push({
        id: PAYMENT_METHOD_BANK,
        label: 'Τραπεζική μεταφορά',
        icon: 'account_balance',
      });
    }
    return methods;
  }
  return [
    { id: 'card', label: 'Πιστωτική / Χρεωστική', icon: 'credit_card' },
    { id: 'paypal', label: 'PayPal', icon: 'account_balance_wallet' },
    { id: 'apple', label: 'Apple Pay', icon: 'phone_iphone' },
  ];
}

export function resolveBankAccount(settings, accountId) {
  if (settings?.bank_accounts?.length) {
    const enabled = settings.bank_accounts.filter((a) => a.enabled !== false && a.iban);
    if (accountId) {
      return enabled.find((a) => a.id === accountId) || enabled.find((a) => a.is_default) || enabled[0];
    }
    return enabled.find((a) => a.is_default) || enabled[0] || null;
  }
  const legacy = normalizeBankTransferSettings(settings);
  if (!legacy.checkout_bank_iban) return null;
  return {
    id: 'legacy-default',
    label: legacy.checkout_bank_name,
    bank_name: legacy.checkout_bank_name,
    beneficiary: legacy.checkout_bank_beneficiary,
    iban: legacy.checkout_bank_iban,
    bic: legacy.checkout_bank_bic,
    reference_template: legacy.checkout_bank_reference_template,
    instructions: legacy.checkout_bank_instructions,
  };
}

/** @param {string} template @param {{ pnr?: string, amount?: number, name?: string }} vars */
export function buildBankPaymentReference(template, vars = {}) {
  const tpl = template || DEFAULT_BANK_TRANSFER_SETTINGS.checkout_bank_reference_template;
  return String(tpl)
    .replace(/\{pnr\}/g, vars.pnr || '')
    .replace(/\{amount\}/g, vars.amount != null ? Number(vars.amount).toFixed(2) : '')
    .replace(/\{name\}/g, vars.name || '');
}

export function formatIbanDisplay(iban) {
  return String(iban || '')
    .replace(/\s/g, '')
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

export function getEnabledBankAccountsForCheckout(settings) {
  if (settings?.bank_accounts) {
    return settings.bank_accounts.filter((a) => a.enabled !== false && a.iban);
  }
  const one = resolveBankAccount(settings);
  return one ? [one] : [];
}
