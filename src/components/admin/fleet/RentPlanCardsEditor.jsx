/**
 * Edit marketing cards for PoreiaGo Rent (standalone + add-on) shown on /grafeia.
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DEFAULT_RENT_SECTION_TITLE,
  RENT_ADDON,
  RENT_STANDALONE_PLAN,
  mergeRentPlanCatalog,
} from '../../../lib/billing/planCatalog.js';
import {
  fetchAdminRentPlanCatalog,
  updateRentPlanCatalog,
} from '../../../services/rentPlanCatalogApi.js';

function cardToForm(card) {
  return {
    badge: card.badge || '',
    name: card.name || '',
    tagline: card.tagline || '',
    monthlyEur: card.monthlyEur ?? '',
    featuresText: (card.features || []).join('\n'),
    ctaLoggedIn: card.ctaLoggedIn || '',
    ctaGuest: card.ctaGuest || '',
    servicesLinkLabel: card.servicesLinkLabel || '',
    visible: card.visible !== false,
  };
}

function formToCard(form) {
  const monthly = Number(form.monthlyEur);
  return {
    badge: String(form.badge || '').trim(),
    name: String(form.name || '').trim(),
    tagline: String(form.tagline || '').trim(),
    monthlyEur: Number.isFinite(monthly) ? monthly : 0,
    features: String(form.featuresText || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
    ctaLoggedIn: String(form.ctaLoggedIn || '').trim(),
    ctaGuest: String(form.ctaGuest || '').trim(),
    servicesLinkLabel: String(form.servicesLinkLabel || '').trim(),
    visible: Boolean(form.visible),
  };
}

function CardEditor({ title, form, onChange, showServicesLink }) {
  const set = (patch) => onChange({ ...form, ...patch });
  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-bold text-gray-900">{title}</h4>
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={form.visible}
            onChange={(e) => set({ visible: e.target.checked })}
            className="rounded border-gray-300"
          />
          Εμφάνιση
        </label>
      </div>
      <label className="block text-xs font-bold text-gray-500">
        Badge
        <input
          className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
          value={form.badge}
          onChange={(e) => set({ badge: e.target.value })}
        />
      </label>
      <label className="block text-xs font-bold text-gray-500">
        Τίτλος
        <input
          className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>
      <label className="block text-xs font-bold text-gray-500">
        Υπότιτλος
        <input
          className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
          value={form.tagline}
          onChange={(e) => set({ tagline: e.target.value })}
        />
      </label>
      <label className="block text-xs font-bold text-gray-500">
        Τιμή (€ / μήνα)
        <input
          type="number"
          min="0"
          step="1"
          className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold tabular-nums"
          value={form.monthlyEur}
          onChange={(e) => set({ monthlyEur: e.target.value })}
        />
      </label>
      <label className="block text-xs font-bold text-gray-500">
        Features (μία γραμμή το καθένα)
        <textarea
          rows={6}
          className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-mono leading-relaxed"
          value={form.featuresText}
          onChange={(e) => set({ featuresText: e.target.value })}
        />
      </label>
      <label className="block text-xs font-bold text-gray-500">
        Κουμπί (συνδεδεμένος)
        <input
          className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
          value={form.ctaLoggedIn}
          onChange={(e) => set({ ctaLoggedIn: e.target.value })}
        />
      </label>
      <label className="block text-xs font-bold text-gray-500">
        Κουμπί (επισκέπτης)
        <input
          className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
          value={form.ctaGuest}
          onChange={(e) => set({ ctaGuest: e.target.value })}
        />
      </label>
      {showServicesLink ? (
        <label className="block text-xs font-bold text-gray-500">
          Link υπηρεσιών
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
            value={form.servicesLinkLabel}
            onChange={(e) => set({ servicesLinkLabel: e.target.value })}
          />
        </label>
      ) : null}
    </div>
  );
}

export default function RentPlanCardsEditor() {
  const [sectionTitle, setSectionTitle] = useState(DEFAULT_RENT_SECTION_TITLE);
  const [standalone, setStandalone] = useState(cardToForm(RENT_STANDALONE_PLAN));
  const [addon, setAddon] = useState(cardToForm(RENT_ADDON));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminRentPlanCatalog();
      setSectionTitle(data.sectionTitle);
      setStandalone(cardToForm(data.standalone));
      setAddon(cardToForm(data.addon));
    } catch {
      toast.error('Αποτυχία φόρτωσης καρτών Rent');
      const fallback = mergeRentPlanCatalog(null);
      setSectionTitle(fallback.sectionTitle);
      setStandalone(cardToForm(fallback.standalone));
      setAddon(cardToForm(fallback.addon));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await updateRentPlanCatalog({
        sectionTitle,
        standalone: formToCard(standalone),
        addon: formToCard(addon),
      });
      setSectionTitle(saved.sectionTitle);
      setStandalone(cardToForm(saved.standalone));
      setAddon(cardToForm(saved.addon));
      toast.success('Οι κάρτες Rent αποθηκεύτηκαν');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-black/[0.06] p-6 text-sm text-gray-500">
        Φόρτωση καρτών συμβολαίων…
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div className="bg-white rounded-2xl border border-black/[0.06] p-4 md:p-5 space-y-3">
        <div>
          <h3 className="font-bold text-gray-900">Κάρτες συμβολαίων Rent</h3>
          <p className="text-sm text-gray-500 mt-1">
            Εμφανίζονται στη σελίδα συμβολαίων (/grafeia) και στις δημόσιες υπηρεσίες Rent. Η τιμή
            εδώ είναι για εμφάνιση — το Stripe checkout δεν αλλάζει αυτόματα.
          </p>
        </div>
        <label className="block text-xs font-bold text-gray-500">
          Τίτλος ενότητας
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
            value={sectionTitle}
            onChange={(e) => setSectionTitle(e.target.value)}
          />
        </label>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <CardEditor title="Αυτόνομο (PoreiaGo Rent)" form={standalone} onChange={setStandalone} />
        <CardEditor
          title="Add-on σε λεωφορεία"
          form={addon}
          onChange={setAddon}
          showServicesLink
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-teal-700 text-white text-sm font-bold hover:bg-teal-800 disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </button>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-black/10 text-sm font-bold text-gray-700 hover:bg-gray-50"
        >
          Επαναφόρτωση
        </button>
        <a
          href="/grafeia"
          target="_blank"
          rel="noreferrer"
          className="text-sm font-bold text-teal-800 hover:underline"
        >
          Προεπισκόπηση /grafeia →
        </a>
      </div>
    </form>
  );
}
