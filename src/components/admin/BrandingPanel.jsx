import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { fetchTenantBrandingSettings, updateTenantBrandingSettings } from '../../services/growthApi.js';
import { getSaasToken } from '../../services/saasApi.js';
import { cacheBranding } from '../../lib/branding/applyBranding.js';
import { DEFAULT_INGRESS_CNAME, getPlatformBaseDomain } from '../../lib/platform/domain.js';

const EMPTY_DNS = {
  cname_host: '',
  cname_target: '',
  notes: [],
};

export default function BrandingPanel() {
  const [form, setForm] = useState({
    display_name: '',
    slug: '',
    subdomain: '',
    platform_domain: '',
    subdomain_fqdn: '',
    custom_domain: '',
    primary_color: '#0040df',
    logo_url: '',
    css_injection_url: '',
    css_injection_inline: '',
    checkout_base_url: '',
    dns_instructions: EMPTY_DNS,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usingPostgres, setUsingPostgres] = useState(false);
  const [storageSource, setStorageSource] = useState('file');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTenantBrandingSettings();
      setUsingPostgres(data.storage_source === 'postgres');
      setStorageSource(data.storage_source || 'file');
      setForm((p) => ({ ...p, ...data, dns_instructions: data.dns_instructions || EMPTY_DNS }));
      if (getSaasToken() && data.storage_source === 'file') {
        toast(
          'Demo branding (αρχείο). Για Postgres domain: seed + επανασύνδεση στο /admin/login',
          { icon: 'ℹ️', duration: 5000 },
        );
      }
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης branding');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dns = form.dns_instructions || EMPTY_DNS;
  const hasCustomDomain = Boolean(form.custom_domain?.trim());

  const cachePayload = useMemo(
    () => ({
      display_name: form.display_name,
      slug: form.slug,
      primary_color: form.primary_color,
      custom_domain: form.custom_domain,
      logo_url: form.logo_url,
      css_injection_url: form.css_injection_url,
      css_injection_inline: form.css_injection_inline,
      checkout_base_url: form.checkout_base_url,
    }),
    [form],
  );

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await updateTenantBrandingSettings({
        display_name: form.display_name,
        custom_domain: form.custom_domain || '',
        primary_color: form.primary_color,
        logo_url: form.logo_url || '',
        css_injection_url: form.css_injection_url || '',
        css_injection_inline: form.css_injection_inline || '',
        checkout_base_url: form.checkout_base_url || '',
      });
      setForm((p) => ({ ...p, ...data, dns_instructions: data.dns_instructions || EMPTY_DNS }));
      setUsingPostgres(data.storage_source === 'postgres');
      setStorageSource(data.storage_source || 'file');
      cacheBranding({
        ...cachePayload,
        display_name: data.display_name,
        primary_color: data.primary_color,
        custom_domain: data.custom_domain,
      });
      toast.success(
        data.storage_source === 'postgres'
          ? 'Domain & branding αποθηκεύτηκαν στο tenant (Postgres)'
          : 'Branding αποθηκεύτηκε (demo — ενεργοποιήστε Postgres για production domain)',
      );
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-gray-500 py-4">Φόρτωση branding…</p>;

  return (
    <form onSubmit={onSave} className="bg-white rounded-[24px] border border-black/[0.06] p-6 shadow-sm space-y-6">
      <div>
        <h4 className="font-bold text-gray-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">language</span>
          Domains & white-label
        </h4>
        <p className="text-xs text-gray-500 mt-1">
          Το custom domain συγχρονίζεται με{' '}
          <code className="text-[11px] bg-gray-100 px-1 rounded">tenants.custom_domain</code>{' '}
          για το PoreiaGo middleware & Traefik TLS.
        </p>
        {!getSaasToken() && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-3">
            Συνδεθείτε με SaaS JWT για αποθήκευση στο Postgres.{' '}
            <Link to="/admin/login" className="font-bold underline">
              Σύνδεση
            </Link>
          </p>
        )}
        {getSaasToken() && storageSource === 'file' && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-3">
            Προβολή demo (αρχείο). Για <code className="text-[11px]">tenants.custom_domain</code>: τρέξτε{' '}
            <code className="text-[11px]">python -m scripts.seed_saas_dev</code> και ξανασυνδεθείτε.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4 space-y-3">
        <p className="text-sm font-bold text-sky-950 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">dns</span>
          Platform subdomain (αυτόματο)
        </p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-sky-800/70 font-semibold uppercase tracking-wide">Subdomain</p>
            <p className="font-mono font-bold text-sky-950 mt-1">{form.subdomain_fqdn || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-sky-800/70 font-semibold uppercase tracking-wide">Κωδικός γραφείου</p>
            <p className="font-mono font-bold text-sky-950 mt-1">{form.subdomain || form.slug || '—'}</p>
          </div>
        </div>
        <p className="text-xs text-sky-900/80">
          Wildcard SSL στο <strong>{form.platform_domain || getPlatformBaseDomain()}</strong> — δεν χρειάζεται DNS
          ρύθμιση.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="block text-sm md:col-span-2">
          <span className="font-bold text-gray-700">Επωνυμία γραφείου</span>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={form.display_name}
            onChange={(e) => setForm((p) => ({ ...p, display_name: e.target.value }))}
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="font-bold text-gray-700">Custom domain (δικό σας)</span>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 font-mono"
            placeholder="travel.myagency.gr"
            value={form.custom_domain}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                custom_domain: e.target.value.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0],
              }))
            }
          />
          <p className="text-xs text-gray-500 mt-1">Χωρίς www — π.χ. bookings.achillio.gr</p>
        </label>
        <label className="block text-sm">
          <span className="font-bold text-gray-700">Primary color</span>
          <input
            type="color"
            className="mt-1 w-full h-10 rounded-xl border"
            value={form.primary_color}
            onChange={(e) => setForm((p) => ({ ...p, primary_color: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="font-bold text-gray-700">Logo URL</span>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="https://cdn.example/logo.svg"
            value={form.logo_url}
            onChange={(e) => setForm((p) => ({ ...p, logo_url: e.target.value }))}
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="font-bold text-gray-700">Checkout base URL</span>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 font-mono text-sm"
            placeholder={`https://${form.subdomain_fqdn || `agency.${getPlatformBaseDomain()}`}`}
            value={form.checkout_base_url}
            onChange={(e) => setForm((p) => ({ ...p, checkout_base_url: e.target.value }))}
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="font-bold text-gray-700">CSS injection (inline)</span>
          <textarea
            rows={4}
            className="mt-1 w-full rounded-xl border px-3 py-2 font-mono text-xs"
            placeholder=":root { --primary: #0040df; }"
            value={form.css_injection_inline}
            onChange={(e) => setForm((p) => ({ ...p, css_injection_inline: e.target.value }))}
          />
        </label>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 space-y-4">
        <p className="text-sm font-bold text-emerald-950 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">route</span>
          Οδηγίες DNS (μετά την αποθήκευση)
        </p>

        {hasCustomDomain ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-white/80 border border-emerald-100 p-3 font-mono text-xs overflow-x-auto">
              <p className="text-gray-500 mb-1"># Custom domain → platform ingress</p>
              <p>
                <span className="text-emerald-800 font-bold">{dns.cname_host || form.custom_domain}</span>
                {'  CNAME  '}
                <span className="text-indigo-700 font-bold">{dns.cname_target || DEFAULT_INGRESS_CNAME}</span>
              </p>
              {dns.alternate_www_host && (
                <p className="mt-2">
                  <span className="text-emerald-800 font-bold">{dns.alternate_www_host}</span>
                  {'  CNAME  '}
                  <span className="text-indigo-700 font-bold">{dns.cname_target || DEFAULT_INGRESS_CNAME}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-emerald-900/80">
            Συμπληρώστε custom domain παραπάνω και αποθηκεύστε — εδώ θα εμφανιστούν οι εγγραφές CNAME.
          </p>
        )}

        {Array.isArray(dns.notes) && dns.notes.length > 0 && (
          <ul className="text-xs text-emerald-900/90 space-y-1 list-disc list-inside">
            {dns.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}

        <p className="text-xs text-emerald-800/80">
          Env server: <code className="bg-white/70 px-1 rounded">OLYMPUS_INGRESS_CNAME</code>,{' '}
          <code className="bg-white/70 px-1 rounded">OLYMPUS_BASE_DOMAIN</code>
        </p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold disabled:opacity-60"
      >
        {saving ? 'Αποθήκευση…' : 'Αποθήκευση domain & branding'}
      </button>
    </form>
  );
}
