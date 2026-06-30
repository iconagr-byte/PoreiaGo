import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DEFAULT_PLATFORM_SETTINGS,
  fetchPlatformSettings,
  normalizePlatformSettings,
  updatePlatformSettings,
} from '../../services/platformApi.js';
import AbandonedRecoveryPanel from './AbandonedRecoveryPanel.jsx';

const SECTIONS = [
  {
    title: 'Εταιρεία & Locale',
    icon: 'business',
    fields: [
      { key: 'company_name', label: 'Επωνυμία', type: 'text' },
      { key: 'support_email', label: 'Email υποστήριξης', type: 'email' },
      { key: 'default_locale', label: 'Γλώσσα', type: 'text' },
      { key: 'timezone', label: 'Ζώνη ώρας', type: 'text' },
      { key: 'maintenance_mode', label: 'Λειτουργία συντήρησης', type: 'checkbox' },
      { key: 'checkout_base_url', label: 'Checkout base URL (recovery links)', type: 'text' },
    ],
  },
  {
    title: 'Abandoned bookings',
    icon: 'shopping_cart_checkout',
    fields: [
      { key: 'abandoned_pending_minutes', label: 'Εκκρεμείς μετά (λεπτά)', type: 'number', min: 15, max: 1440 },
      { key: 'abandoned_recovery_cooldown_hours', label: 'Cooldown recovery (ώρες)', type: 'number', min: 1, max: 168 },
    ],
  },
  {
    title: 'Dynamic pricing',
    icon: 'sell',
    fields: [
      { key: 'pricing_high_occupancy_threshold', label: 'Όριο υψηλής πληρότητας', type: 'number', min: 0.5, max: 1, step: 0.05 },
      { key: 'pricing_high_occupancy_markup_pct', label: 'Markup %', type: 'number', min: 0, max: 50 },
      { key: 'pricing_low_occupancy_threshold', label: 'Όριο χαμηλής πληρότητας', type: 'number', min: 0, max: 0.5, step: 0.05 },
      { key: 'pricing_low_occupancy_discount_pct', label: 'Έκπτωση %', type: 'number', min: 0, max: 30 },
    ],
  },
  {
    title: 'Ειδοποιήσεις & Integrations',
    icon: 'mail',
    fields: [
      { key: 'master_qr_ttl_hours', label: 'Master QR TTL (ώρες)', type: 'number', min: 1, max: 168 },
      { key: 'webhook_max_retries', label: 'Webhook retries', type: 'number', min: 1, max: 20 },
      { key: 'smtp_from_email', label: 'SMTP From', type: 'email' },
      { key: 'sms_sender_id', label: 'SMS Sender ID', type: 'text' },
    ],
  },
];

export default function PlatformSettingsPanel({ onOpenPayments }) {
  const [form, setForm] = useState(DEFAULT_PLATFORM_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setForm(await fetchPlatformSettings());
    setDirty(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = normalizePlatformSettings(form);
      const { data, source, offline } = await updatePlatformSettings(payload);
      setForm(data);
      setDirty(false);
      setLastSavedAt(new Date());
      if (offline) {
        toast.success('Αποθηκεύτηκε τοπικά — ο server δεν είναι διαθέσιμος');
      } else if (source === 'server') {
        toast.success('Οι ρυθμίσεις πλατφόρμας αποθηκεύτηκαν');
      } else {
        toast.success('Οι ρυθμίσεις αποθηκεύτηκαν');
      }
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-center text-gray-400 py-12">Φόρτωση ρυθμίσεων πλατφόρμας…</p>;
  }

  return (
    <form onSubmit={onSave} className="space-y-8">
      {form.maintenance_mode && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 font-medium">
          Η πλατφόρμα είναι σε λειτουργία συντήρησης — οι πελάτες βλέπουν μήνυμα maintenance.
        </div>
      )}
      {SECTIONS.map((section) => (
        <div key={section.title} className="bg-white rounded-[24px] border border-black/[0.06] p-6 shadow-sm">
          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">{section.icon}</span>
            {section.title}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.fields.map((field) => (
              <label key={field.key} className={field.type === 'checkbox' ? 'md:col-span-2' : ''}>
                <span className="text-sm font-bold text-gray-700">{field.label}</span>
                {field.hint && (
                  <p className="text-xs text-gray-500 mt-0.5">{field.hint}</p>
                )}
                {field.type === 'checkbox' ? (
                  <input
                    type="checkbox"
                    className="mt-2 w-5 h-5"
                    checked={Boolean(form[field.key])}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, [field.key]: e.target.checked }));
                      setDirty(true);
                    }}
                  />
                ) : (
                  <input
                    type={field.type || 'text'}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={form[field.key] ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const v =
                        field.type === 'number'
                          ? raw === ''
                            ? ''
                            : Number(raw)
                          : raw;
                      setForm((p) => ({ ...p, [field.key]: v }));
                      setDirty(true);
                    }}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="bg-white rounded-[24px] border border-primary/15 p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">account_balance</span>
            Διαχείριση πληρωμών
          </h4>
          <p className="text-sm text-gray-500 mt-1">
            Τρόποι πληρωμής, προκαταβολή, τραπεζικοί λογαριασμοί και επιβεβαίωση καταθέσεων — στην καρτέλα «Πληρωμές».
          </p>
        </div>
        {onOpenPayments && (
          <button
            type="button"
            onClick={onOpenPayments}
            className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold"
          >
            Άνοιγμα Πληρωμών
          </button>
        )}
      </div>
      <AbandonedRecoveryPanel pendingMinutes={form.abandoned_pending_minutes} />

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση πλατφόρμας'}
        </button>
        {dirty && !saving && (
          <span className="text-xs text-amber-700 font-medium">Υπάρχουν μη αποθηκευμένες αλλαγές</span>
        )}
        {lastSavedAt && !dirty && (
          <span className="text-xs text-emerald-700 font-medium">
            Αποθηκεύτηκε {lastSavedAt.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </form>
  );
}
