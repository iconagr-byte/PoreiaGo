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

const FIELD =
  'mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100';

function SectionCard({ icon, title, subtitle, children, tone = 'default' }) {
  const tones = {
    default: 'border-slate-200/80 bg-white',
    sky: 'border-sky-200/80 bg-gradient-to-b from-sky-50/80 to-white',
    teal: 'border-teal-200/80 bg-gradient-to-b from-teal-50/70 to-white',
    slate: 'border-slate-200 bg-slate-50/60',
  };
  return (
    <section className={`rounded-[22px] border p-5 sm:p-6 space-y-4 ${tones[tone] || tones.default}`}>
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white border border-black/[0.05] text-sky-800 shadow-sm">
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </span>
        <div className="min-w-0">
          <h4 className="font-bold text-slate-900 text-[15px] sm:text-base">{title}</h4>
          {subtitle ? <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function copyText(value, okMsg) {
  const text = String(value || '').trim();
  if (!text) return;
  navigator.clipboard
    ?.writeText(text)
    .then(() => toast.success(okMsg || 'Αντιγράφηκε'))
    .catch(() => toast.error('Αποτυχία αντιγραφής'));
}

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
  const [storageSource, setStorageSource] = useState('file');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);

  const patch = (updater) => {
    setDirty(true);
    setForm((p) => {
      const next = typeof updater === 'function' ? updater(p) : { ...p, ...updater };
      if (Object.prototype.hasOwnProperty.call(next, 'logo_url') && next.logo_url !== p.logo_url) {
        setLogoBroken(false);
      }
      return next;
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTenantBrandingSettings();
      setStorageSource(data.storage_source || 'file');
      setForm((p) => ({ ...p, ...data, dns_instructions: data.dns_instructions || EMPTY_DNS }));
      setDirty(false);
      if (data.css_injection_inline || data.css_injection_url) setShowAdvanced(true);
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
  const primary = form.primary_color || '#0b4f6c';
  const officeCode = form.subdomain || form.slug || '—';
  const platformHost = form.subdomain_fqdn || '—';

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
      setStorageSource(data.storage_source || 'file');
      setDirty(false);
      cacheBranding({
        ...cachePayload,
        display_name: data.display_name,
        primary_color: data.primary_color,
        custom_domain: data.custom_domain,
      });
      toast.success(
        data.storage_source === 'postgres'
          ? 'Domain & branding αποθηκεύτηκαν'
          : 'Branding αποθηκεύτηκε (demo — ενεργοποιήστε Postgres για production domain)',
      );
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    } finally {
      setSaving(false);
    }
  };

  const cnameLine = hasCustomDomain
    ? `${dns.cname_host || form.custom_domain}  CNAME  ${dns.cname_target || DEFAULT_INGRESS_CNAME}`
    : '';

  if (loading) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="h-6 w-48 rounded-full bg-slate-100 animate-pulse" />
        <div className="mt-4 h-28 rounded-[22px] bg-slate-100 animate-pulse" />
        <div className="mt-3 h-40 rounded-[22px] bg-slate-100 animate-pulse" />
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="space-y-4 max-w-3xl">
      <div className="rounded-[28px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden">
        <div className="px-5 sm:px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-sky-50/80 via-white to-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
                <span className="material-symbols-outlined text-[24px]">language</span>
              </span>
              <div className="min-w-0">
                <h3 className="text-xl font-bold tracking-tight text-slate-900">Domain & εμφάνιση</h3>
                <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                  Το domain της ιστοσελίδας του γραφείου, επωνυμία, χρώμα και λογότυπο.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                  storageSource === 'postgres'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {storageSource === 'postgres' ? 'cloud_done' : 'science'}
                </span>
                {storageSource === 'postgres' ? 'Postgres' : 'Demo αρχείο'}
              </span>
              {dirty ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-900">
                  Μη αποθηκευμένες αλλαγές
                </span>
              ) : null}
            </div>
          </div>

          {!getSaasToken() ? (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2.5 mt-4">
              Συνδεθείτε για αποθήκευση στο Postgres.{' '}
              <Link to="/admin/login" className="font-bold underline">
                Σύνδεση
              </Link>
            </p>
          ) : null}

          {/* Live preview strip */}
          <div
            className="mt-4 rounded-[20px] border border-slate-200/80 overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primary}cc 55%, #0f172a 100%)` }}
          >
            <div className="px-4 py-4 flex flex-wrap items-center gap-3 text-white">
              {form.logo_url && !logoBroken ? (
                <img
                  src={form.logo_url}
                  alt=""
                  className="h-10 w-10 rounded-xl object-contain bg-white/95 p-1"
                  onError={() => setLogoBroken(true)}
                />
              ) : (
                <span className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-sm font-bold">
                  {(form.display_name || 'Γ').slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">Προεπισκόπηση</p>
                <p className="font-bold truncate">{form.display_name || 'Επωνυμία γραφείου'}</p>
                <p className="text-xs text-white/80 truncate font-mono">
                  {hasCustomDomain ? form.custom_domain : platformHost}
                </p>
              </div>
              <span className="rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[11px] font-bold">
                {primary}
              </span>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <SectionCard
            tone="sky"
            icon="dns"
            title="Διεύθυνση πλατφόρμας (έτοιμη)"
            subtitle={`Wildcard SSL στο ${form.platform_domain || getPlatformBaseDomain()} — χωρίς DNS ρύθμιση.`}
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-sky-100 bg-white px-3.5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-sky-800/70">Subdomain</p>
                <p className="font-mono text-sm font-bold text-sky-950 mt-1 break-all">{platformHost}</p>
                <button
                  type="button"
                  className="mt-2 text-xs font-bold text-sky-800 hover:underline"
                  onClick={() => copyText(platformHost, 'Αντιγράφηκε το subdomain')}
                >
                  Αντιγραφή
                </button>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-white px-3.5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-sky-800/70">Κωδικός γραφείου</p>
                <p className="font-mono text-sm font-bold text-sky-950 mt-1">{officeCode}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon="public"
            title="Δικό σας domain"
            subtitle="Συνδέστε το domain του γραφείου σας (χωρίς www)."
          >
            <label className="block text-sm">
              <span className="font-bold text-slate-700">Επωνυμία γραφείου</span>
              <input
                className={FIELD}
                value={form.display_name}
                onChange={(e) => patch({ display_name: e.target.value })}
                placeholder="π.χ. Achillio Travel"
              />
            </label>

            <label className="block text-sm">
              <span className="font-bold text-slate-700">Custom domain</span>
              <div className="mt-1.5 flex gap-2">
                <input
                  className={`${FIELD} mt-0 font-mono`}
                  placeholder="bookings.myagency.gr"
                  value={form.custom_domain}
                  onChange={(e) =>
                    patch({
                      custom_domain: e.target.value
                        .trim()
                        .toLowerCase()
                        .replace(/^https?:\/\//, '')
                        .split('/')[0],
                    })
                  }
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">Παράδειγμα: bookings.achillio.gr — όχι www.</p>
            </label>

            <label className="block text-sm">
              <span className="font-bold text-slate-700">Checkout URL</span>
              <input
                className={`${FIELD} font-mono`}
                placeholder={`https://${platformHost !== '—' ? platformHost : `agency.${getPlatformBaseDomain()}`}`}
                value={form.checkout_base_url}
                onChange={(e) => patch({ checkout_base_url: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1.5">Βάση για links πληρωμής / redirect μετά το checkout.</p>
            </label>
          </SectionCard>

          <SectionCard
            icon="palette"
            title="Εμφάνιση white-label"
            subtitle="Χρώμα και λογότυπο στην ιστοσελίδα του γραφείου."
          >
            <div className="grid sm:grid-cols-[auto_1fr] gap-4 items-start">
              <label className="block text-sm">
                <span className="font-bold text-slate-700">Primary χρώμα</span>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="color"
                    className="h-11 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
                    value={primary}
                    onChange={(e) => patch({ primary_color: e.target.value })}
                    aria-label="Επιλογή χρώματος"
                  />
                  <input
                    className={`${FIELD} mt-0 max-w-[8.5rem] font-mono uppercase`}
                    value={primary}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (/^#([0-9a-fA-F]{0,6})$/.test(v)) patch({ primary_color: v });
                    }}
                    spellCheck={false}
                  />
                </div>
              </label>

              <label className="block text-sm min-w-0">
                <span className="font-bold text-slate-700">Logo URL</span>
                <input
                  className={FIELD}
                  placeholder="https://cdn.example/logo.svg"
                  value={form.logo_url}
                  onChange={(e) => patch({ logo_url: e.target.value })}
                />
                {form.logo_url && !logoBroken ? (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <img
                      src={form.logo_url}
                      alt="Logo preview"
                      className="h-8 max-w-[7rem] object-contain"
                      onError={() => setLogoBroken(true)}
                    />
                  </div>
                ) : form.logo_url && logoBroken ? (
                  <p className="mt-1.5 text-xs font-semibold text-rose-600">Μη έγκυρο URL λογότυπου</p>
                ) : null}
              </label>
            </div>
          </SectionCard>

          <SectionCard
            tone="teal"
            icon="route"
            title="Οδηγίες DNS"
            subtitle={
              hasCustomDomain
                ? 'Μετά την αποθήκευση, πρόσθεσε αυτή την εγγραφή στον πάροχο DNS.'
                : 'Συμπλήρωσε custom domain και αποθήκευσε για να εμφανιστεί το CNAME.'
            }
          >
            {hasCustomDomain ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-white border border-teal-100 px-3.5 py-3 font-mono text-xs overflow-x-auto">
                  <p className="text-slate-400 mb-1.5"># Custom domain → platform</p>
                  <p className="text-slate-800 whitespace-pre">{cnameLine}</p>
                  {dns.alternate_www_host ? (
                    <p className="mt-2 text-slate-800">
                      {dns.alternate_www_host}  CNAME  {dns.cname_target || DEFAULT_INGRESS_CNAME}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => copyText(cnameLine, 'CNAME αντιγράφηκε')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-white px-3.5 py-2 text-xs font-bold text-teal-900 hover:bg-teal-50"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  Αντιγραφή CNAME
                </button>
              </div>
            ) : (
              <p className="text-sm text-teal-900/80 rounded-2xl border border-dashed border-teal-200 bg-white/70 px-3.5 py-3">
                Δεν έχει οριστεί ακόμα custom domain.
              </p>
            )}

            {Array.isArray(dns.notes) && dns.notes.length > 0 ? (
              <ul className="text-xs text-teal-950/90 space-y-1.5">
                {dns.notes.map((note) => (
                  <li key={note} className="flex gap-2">
                    <span className="material-symbols-outlined text-[15px] text-teal-700 shrink-0">info</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </SectionCard>

          <div className="rounded-[22px] border border-slate-200 bg-slate-50/50 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
            >
              <span className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                <span className="material-symbols-outlined text-[20px] text-slate-500">code</span>
                Προχωρημένα · CSS injection
              </span>
              <span
                className={`material-symbols-outlined text-slate-500 transition-transform ${
                  showAdvanced ? 'rotate-180' : ''
                }`}
              >
                expand_more
              </span>
            </button>
            {showAdvanced ? (
              <div className="px-5 pb-5 space-y-3 border-t border-slate-200/80 pt-4">
                <label className="block text-sm">
                  <span className="font-bold text-slate-700">CSS URL (εξωτερικό)</span>
                  <input
                    className={FIELD}
                    placeholder="https://cdn.example/brand.css"
                    value={form.css_injection_url}
                    onChange={(e) => patch({ css_injection_url: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-bold text-slate-700">Inline CSS</span>
                  <textarea
                    rows={4}
                    className={`${FIELD} font-mono text-xs`}
                    placeholder=":root { --primary: #0b4f6c; }"
                    value={form.css_injection_inline}
                    onChange={(e) => patch({ css_injection_inline: e.target.value })}
                  />
                </label>
                <p className="text-[11px] text-slate-500">
                  Για τεχνική ομάδα. Env: <code className="bg-white px-1 rounded border">OLYMPUS_INGRESS_CNAME</code>,{' '}
                  <code className="bg-white px-1 rounded border">OLYMPUS_BASE_DOMAIN</code>
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-3 mx-5 sm:mx-6 mb-5 z-10 rounded-[22px] border border-sky-200/70 bg-white/95 backdrop-blur shadow-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {dirty ? 'Υπάρχουν μη αποθηκευμένες αλλαγές.' : 'Όλα αποθηκευμένα.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={load}
              disabled={saving}
              className="px-4 py-2.5 rounded-full border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Επαναφόρτωση
            </button>
            <button
              type="submit"
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-sky-700 text-white text-sm font-bold hover:bg-sky-800 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
