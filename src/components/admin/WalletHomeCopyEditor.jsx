/**
 * Office admin — My Wallet «Αρχική» marketing copy (remote config per tenant).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DEFAULT_SITE_APPEARANCE,
  fetchAdminSiteAppearance,
  updateSiteAppearance,
} from '../../services/siteAppearanceApi.js';
import { resolveWalletHomeFeed } from '../../lib/wallet/walletHomeFeed.js';

const DEFAULT_SERVICES = DEFAULT_SITE_APPEARANCE.wallet_home_services || [];

function blankService() {
  return { icon: 'check_circle', title: '', body: '' };
}

function formFromAppearance(data) {
  const services = Array.isArray(data?.wallet_home_services)
    ? data.wallet_home_services
        .map((row) => ({
          icon: String(row?.icon || 'check_circle').trim() || 'check_circle',
          title: String(row?.title || '').trim(),
          body: String(row?.body || row?.description || '').trim(),
        }))
        .filter((row) => row.title || row.body)
    : [];
  return {
    wallet_home_hook: String(data?.wallet_home_hook || '').trim(),
    wallet_home_headline: String(data?.wallet_home_headline || '').trim(),
    wallet_home_body: String(data?.wallet_home_body || '').trim(),
    wallet_home_trips_title: String(data?.wallet_home_trips_title || '').trim(),
    wallet_home_show_trips: data?.wallet_home_show_trips !== false,
    wallet_home_services: services.length ? services : DEFAULT_SERVICES.map((s) => ({ ...s })),
  };
}

export default function WalletHomeCopyEditor({ embedded = false, onSaved } = {}) {
  const [form, setForm] = useState(() => formFromAppearance(null));
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [officeName, setOfficeName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminSiteAppearance();
      const next = formFromAppearance(data);
      setForm(next);
      setSaved(JSON.stringify(next));
      setOfficeName(
        String(data?.footer_brand_name || data?.display_name || '').trim() || 'Το γραφείο',
      );
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = JSON.stringify(form) !== saved;
  const preview = useMemo(
    () =>
      resolveWalletHomeFeed(
        {
          ...form,
          footer_brand_name: officeName,
        },
        { officeName },
      ),
    [form, officeName],
  );

  const setField = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const updateService = (index, patch) => {
    setForm((p) => ({
      ...p,
      wallet_home_services: p.wallet_home_services.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));
  };

  const addService = () => {
    setForm((p) => ({
      ...p,
      wallet_home_services: [...p.wallet_home_services, blankService()].slice(0, 6),
    }));
  };

  const removeService = (index) => {
    setForm((p) => ({
      ...p,
      wallet_home_services: p.wallet_home_services.filter((_, i) => i !== index),
    }));
  };

  const resetToDefaults = () => {
    const next = formFromAppearance({
      wallet_home_services: DEFAULT_SERVICES,
      wallet_home_show_trips: true,
      wallet_home_trips_title: 'Επερχόμενες εκδρομές',
    });
    setForm(next);
  };

  const onSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const services = form.wallet_home_services
        .map((row, i) => ({
          id: `svc-${i}`,
          icon: String(row.icon || 'check_circle').trim() || 'check_circle',
          title: String(row.title || '').trim(),
          body: String(row.body || '').trim(),
        }))
        .filter((row) => row.title || row.body);
      const payload = {
        wallet_home_hook: form.wallet_home_hook.trim(),
        wallet_home_headline: form.wallet_home_headline.trim(),
        wallet_home_body: form.wallet_home_body.trim(),
        wallet_home_trips_title:
          form.wallet_home_trips_title.trim() || 'Επερχόμενες εκδρομές',
        wallet_home_show_trips: Boolean(form.wallet_home_show_trips),
        wallet_home_services: services.length ? services : DEFAULT_SERVICES.map((s) => ({ ...s })),
      };
      const result = await updateSiteAppearance(payload);
      const next = formFromAppearance({ ...form, ...(result?.data || payload) });
      setForm(next);
      setSaved(JSON.stringify(next));
      onSaved?.(result?.data || payload);
      toast.success('Αποθηκεύτηκε — η Αρχική του Wallet ενημερώθηκε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
        <span className="material-symbols-outlined animate-spin text-base" aria-hidden>
          progress_activity
        </span>
        Φόρτωση κειμένων Wallet…
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="space-y-5">
      {!embedded ? (
        <header className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4 sm:p-5">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-sky-700">
            My Wallet · Αρχική
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-900 tracking-tight">
            Κείμενα χωρίς rebuild
          </h3>
          <p className="mt-1 text-sm text-slate-600 leading-relaxed max-w-2xl">
            Αλλάξτε hook, τίτλο, περιγραφή και παροχές — εμφανίζονται αμέσως στην εφαρμογή πελάτη
            μετά την αποθήκευση. Κενά πεδία πέφτουν στα κείμενα του hero της ιστοσελίδας.
          </p>
        </header>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Ετικέτα (hook)</span>
            <input
              type="text"
              value={form.wallet_home_hook}
              onChange={(e) => setField('wallet_home_hook', e.target.value)}
              placeholder="π.χ. Premium ταξιδιωτική εμπειρία"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Τίτλος</span>
            <input
              type="text"
              value={form.wallet_home_headline}
              onChange={(e) => setField('wallet_home_headline', e.target.value)}
              placeholder={officeName || 'Όνομα γραφείου'}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Κύριο κείμενο</span>
            <textarea
              rows={4}
              value={form.wallet_home_body}
              onChange={(e) => setField('wallet_home_body', e.target.value)}
              placeholder="Μία–δύο προτάσεις κάτω από τον τίτλο"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 resize-y"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Τίτλος εκδρομών</span>
            <input
              type="text"
              value={form.wallet_home_trips_title}
              onChange={(e) => setField('wallet_home_trips_title', e.target.value)}
              placeholder="Επερχόμενες εκδρομές"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.wallet_home_show_trips}
              onChange={(e) => setField('wallet_home_show_trips', e.target.checked)}
              className="rounded border-slate-300"
            />
            Εμφάνιση λίστας επερχόμενων εκδρομών
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500 mb-3">
            Προεπισκόπηση
          </p>
          <div className="rounded-2xl bg-gradient-to-br from-sky-700 via-sky-600 to-indigo-700 text-white p-4 shadow-sm">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-sky-100/90">
              {preview.hook || '—'}
            </p>
            <p className="mt-2 text-xl font-bold tracking-tight">{preview.headline}</p>
            <p className="mt-2 text-sm text-sky-50/95 leading-relaxed">{preview.body}</p>
          </div>
          {preview.services?.length ? (
            <ul className="mt-3 space-y-2">
              {preview.services.slice(0, 3).map((svc) => (
                <li
                  key={svc.id || svc.title}
                  className="rounded-xl bg-white border border-slate-200 px-3 py-2.5 flex gap-2"
                >
                  <span className="material-symbols-outlined text-sky-600 text-[1.25rem]" aria-hidden>
                    {svc.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">{svc.title}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{svc.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h4 className="text-sm font-bold text-slate-900">Παροχές</h4>
          <button
            type="button"
            onClick={addService}
            disabled={form.wallet_home_services.length >= 6}
            className="text-xs font-semibold text-sky-700 hover:text-sky-900 disabled:opacity-40"
          >
            + Προσθήκη
          </button>
        </div>
        <div className="space-y-3">
          {form.wallet_home_services.map((row, index) => (
            <div
              key={`svc-edit-${index}`}
              className="rounded-xl border border-slate-200 bg-white p-3 grid gap-2 sm:grid-cols-[7rem_1fr_1fr_auto]"
            >
              <label className="block">
                <span className="text-[0.65rem] font-semibold text-slate-500">Icon</span>
                <input
                  type="text"
                  value={row.icon}
                  onChange={(e) => updateService(index, { icon: e.target.value })}
                  className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  placeholder="qr_code_2"
                />
              </label>
              <label className="block">
                <span className="text-[0.65rem] font-semibold text-slate-500">Τίτλος</span>
                <input
                  type="text"
                  value={row.title}
                  onChange={(e) => updateService(index, { title: e.target.value })}
                  className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-[0.65rem] font-semibold text-slate-500">Κείμενο</span>
                <input
                  type="text"
                  value={row.body}
                  onChange={(e) => updateService(index, { body: e.target.value })}
                  className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => removeService(index)}
                className="self-end mb-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Διαγραφή παροχής"
              >
                <span className="material-symbols-outlined text-[1.15rem]">delete</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={!dirty || saving}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </button>
        <button
          type="button"
          onClick={resetToDefaults}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
        >
          Επαναφορά προεπιλογών
        </button>
        {dirty ? (
          <span className="text-xs font-medium text-amber-700">Μη αποθηκευμένες αλλαγές</span>
        ) : null}
      </div>
    </form>
  );
}
