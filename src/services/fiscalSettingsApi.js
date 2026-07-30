import { saasFetch } from './saasApi.js';

/**
 * Fiscal issuance channels.
 *
 * AADE "πάροχοι ΥΠΑΗΕΣ" = licensed e-invoicing providers (SoftOne EINVOICING, Impact, …).
 * Native AADE = direct myDATA (NOT a provider).
 * Prosvasis GO / Epsilon Smart = ERP/API channels (not the ΥΠΑΗΕΣ product names).
 */
export const FISCAL_PROVIDERS = [
  {
    id: 'softone',
    group: 'ypahes',
    label: 'SoftOne EINVOICING',
    icon: 'apartment',
    description: 'Αδειοδοτημένος πάροχος ΑΑΔΕ (ENTERSOFTONE) · Invoice/json',
  },
  {
    id: 'impact',
    group: 'ypahes',
    label: 'Impact eINVOICING',
    icon: 'receipt_long',
    description: 'Αδειοδοτημένος πάροχος ΑΑΔΕ (IMPACT) · Invoice/json',
  },
  {
    id: 'native_aade',
    group: 'direct',
    label: 'myDATA απευθείας',
    icon: 'verified_user',
    description: 'Απευθείας διαβίβαση στην ΑΑΔΕ · δεν είναι πάροχος ΥΠΑΗΕΣ',
  },
  {
    id: 'prosvasis',
    group: 'erp',
    label: 'Prosvasis GO (ERP)',
    icon: 'cloud_sync',
    description: 'Κανάλι SoftOne S1 Cloud / Prosvasis ERP — όχι το προϊόν ΥΠΑΗΕΣ',
  },
  {
    id: 'epsilon',
    group: 'erp',
    label: 'Epsilon Smart (ERP)',
    icon: 'hub',
    description: 'Κανάλι Epsilon Smart API — όχι το EPSILONDIGITAL πάροχος',
  },
];

export const FISCAL_PROVIDER_GROUPS = [
  {
    id: 'ypahes',
    title: 'Πιστοποιημένοι πάροχοι (ΥΠΑΗΕΣ)',
    subtitle: 'Αδειοδοτημένα λογισμικά παρόχου ηλεκτρονικής τιμολόγησης ΑΑΔΕ.',
  },
  {
    id: 'direct',
    title: 'Απευθείας myDATA',
    subtitle: 'Χωρίς πάροχο — διαβίβαση με δικά σας credentials ΑΑΔΕ.',
  },
  {
    id: 'erp',
    title: 'ERP / εναλλακτικά κανάλια',
    subtitle: 'Τεχνικές διασυνδέσεις ERP· δεν αντιστοιχούν στα προϊόντα ΥΠΑΗΕΣ.',
  },
];

const EINVOICE_DEFAULT = {
  api_url: '',
  issuer_name: '',
  branch_code: 0,
  item_code: '',
  api_key_configured: false,
};

export const DEFAULT_FISCAL_SETTINGS = {
  provider: 'native_aade',
  issuer_vat: '',
  series_retail: 'ΑΠΥ',
  series_invoice: 'ΤΠΥ',
  prosvasis: {
    api_url: 'https://go.s1cloud.net',
    app_id: '',
    series_retail: 7001,
    series_invoice: 7021,
    branch: 1000,
    default_trdr: 1,
    service_mtrl_code: '',
    payment_codes: {
      cash: '1001',
      credit_card: '1003',
      bank_transfer: '1005',
    },
    s1code_configured: false,
    bearer_token_configured: false,
  },
  epsilon: {
    smart_url: 'https://epsilonsmart.epsilonnet.gr/',
    retail_item_code: '',
    wholesale_item_code: '',
    jwt_configured: false,
    subscription_key_configured: false,
  },
  softone: {
    ...EINVOICE_DEFAULT,
    api_url: 'https://einvoice.s1ecos.gr',
  },
  impact: {
    ...EINVOICE_DEFAULT,
    api_url: 'https://einvoiceapi.impact.gr',
  },
};

export function normalizeFiscalSettings(data) {
  const base = { ...DEFAULT_FISCAL_SETTINGS, ...(data || {}) };
  return {
    ...base,
    prosvasis: { ...DEFAULT_FISCAL_SETTINGS.prosvasis, ...(base.prosvasis || {}) },
    epsilon: { ...DEFAULT_FISCAL_SETTINGS.epsilon, ...(base.epsilon || {}) },
    softone: { ...DEFAULT_FISCAL_SETTINGS.softone, ...(base.softone || {}) },
    impact: { ...DEFAULT_FISCAL_SETTINGS.impact, ...(base.impact || {}) },
  };
}

export async function fetchFiscalSettings() {
  const data = await saasFetch('/api/v1/settings/fiscal');
  return normalizeFiscalSettings(data);
}

export async function updateFiscalSettings(patch) {
  const data = await saasFetch('/api/v1/settings/fiscal', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return normalizeFiscalSettings(data);
}

/** Login-only SoftOne/Impact check (no invoice). */
export async function testFiscalConnection(body) {
  return saasFetch('/api/v1/settings/fiscal/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const YPAHES_PROVIDERS = FISCAL_PROVIDERS.filter((p) => p.group === 'ypahes');

export const PROVIDER_DEFAULT_URLS = {
  softone: {
    prod: 'https://einvoice.s1ecos.gr',
    demo: 'https://einvoice-demo.s1ecos.gr',
  },
  impact: {
    prod: 'https://einvoiceapi.impact.gr',
    demo: 'https://einvoiceapiuat.impact.gr',
  },
};
