import { saasFetch } from './saasApi.js';

export const FISCAL_PROVIDERS = [
  {
    id: 'native_aade',
    label: 'myDATA (Native AADE)',
    icon: 'verified_user',
    description: 'Απευθείας έκδοση ΑΠΥ/τιμολογίων μέσω AADE myDATA',
  },
  {
    id: 'prosvasis',
    label: 'Prosvasis GO',
    icon: 'cloud_sync',
    description: 'Έκδοση μέσω SoftOne S1 Cloud / Prosvasis',
  },
  {
    id: 'epsilon',
    label: 'Epsilon Smart',
    icon: 'hub',
    description: 'Έκδοση μέσω Epsilon Smart API',
  },
  {
    id: 'softone',
    label: 'SoftOne eINVOICING',
    icon: 'apartment',
    description: 'Πιστοποιημένος πάροχος SoftOne ECOS (Invoice/json)',
  },
  {
    id: 'impact',
    label: 'Impact EINVOICING',
    icon: 'receipt_long',
    description: 'Πιστοποιημένος πάροχος Impact / SoftOne Impact',
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
