/**
 * Office admin — configure the /rent services mosaic under the fleet list.
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ImageDropField from '../ImageDropField.jsx';
import {
  DEFAULT_RENT_SERVICES_MOSAIC_CARDS,
  DEFAULT_RENT_SERVICES_MOSAIC_CTA,
  RENT_SERVICES_MOSAIC_LINK_PRESETS,
  RENT_SERVICES_MOSAIC_MAX,
  normalizeRentServicesMosaicCard,
  resolveRentServicesMosaic,
} from '../../../lib/rental/rentServicesMosaic.js';
import {
  fetchAdminSiteAppearance,
  updateSiteAppearance,
  uploadSiteAsset,
} from '../../../services/siteAppearanceApi.js';

function blankCard() {
  return {
    id: `svc-${Date.now()}`,
    title: '',
    subtitle: '',
    body: '',
    href: '#rent-guest-search',
    cta_label: DEFAULT_RENT_SERVICES_MOSAIC_CTA,
    image_url: '',
    icon: 'spa',
  };
}

function formFromAppearance(data) {
  const mosaic = resolveRentServicesMosaic(data || {});
  return {
    rent_services_mosaic_enabled: mosaic.enabled,
    rent_services_mosaic_kicker: mosaic.kicker,
    rent_services_mosaic_title: mosaic.title,
    rent_services_mosaic_lead: mosaic.lead,
    rent_services_mosaic_cards: mosaic.cards.map((c) => ({ ...c })),
  };
}

export default function RentServicesMosaicEditor({ embedded = false, onSaved } = {}) {
  const [form, setForm] = useState(() => formFromAppearance(null));
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminSiteAppearance();
      const next = formFromAppearance(data);
      setForm(next);
      setSaved(JSON.stringify(next));
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

  const setField = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const updateCard = (index, patch) => {
    setForm((p) => ({
      ...p,
      rent_services_mosaic_cards: p.rent_services_mosaic_cards.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));
  };

  const addCard = () => {
    setForm((p) => {
      if (p.rent_services_mosaic_cards.length >= RENT_SERVICES_MOSAIC_MAX) return p;
      return {
        ...p,
        rent_services_mosaic_cards: [...p.rent_services_mosaic_cards, blankCard()],
      };
    });
  };

  const removeCard = (index) => {
    setForm((p) => ({
      ...p,
      rent_services_mosaic_cards: p.rent_services_mosaic_cards.filter((_, i) => i !== index),
    }));
  };

  const resetDefaults = () => {
    setForm((p) => ({
      ...p,
      rent_services_mosaic_cards: DEFAULT_RENT_SERVICES_MOSAIC_CARDS.map((c) => ({ ...c })),
    }));
  };

  const save = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const cards = form.rent_services_mosaic_cards
        .map((row, i) => normalizeRentServicesMosaicCard(row, i))
        .filter(Boolean);
      const patch = {
        rent_services_mosaic_enabled: Boolean(form.rent_services_mosaic_enabled),
        rent_services_mosaic_kicker: String(form.rent_services_mosaic_kicker || '').trim(),
        rent_services_mosaic_title: String(form.rent_services_mosaic_title || '').trim(),
        rent_services_mosaic_lead: String(form.rent_services_mosaic_lead || '').trim(),
        rent_services_mosaic_cards: cards,
      };
      const result = await updateSiteAppearance(patch);
      const next = formFromAppearance(result?.data || { ...form, ...patch });
      setForm(next);
      setSaved(JSON.stringify(next));
      onSaved?.(result?.data || patch);
      toast.success('Οι υπηρεσίες στο /rent αποθηκεύτηκαν');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Φόρτωση…</p>;
  }

  return (
    <form
      onSubmit={save}
      className={embedded ? 'space-y-4' : 'space-y-4 rounded-2xl border border-teal-100 bg-white p-4 sm:p-5'}
    >
      {!embedded ? (
        <div>
          <h3 className="text-base font-bold text-slate-900">Υπηρεσίες κάτω από τον στόλο</h3>
          <p className="mt-1 text-sm text-slate-500">
            Εμφανίζονται στο /rent κάτω από τα αυτοκίνητα. Αλλάξτε τίτλους, κείμενα, φωτό και πού
            οδηγεί το «Μάθετε περισσότερα» — αποθηκεύστε και φαίνονται αμέσως.
          </p>
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <input
          type="checkbox"
          checked={Boolean(form.rent_services_mosaic_enabled)}
          onChange={(e) => setField('rent_services_mosaic_enabled', e.target.checked)}
        />
        Εμφάνιση ενότητας στο /rent
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-semibold text-slate-700">Eyebrow</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={form.rent_services_mosaic_kicker}
            onChange={(e) => setField('rent_services_mosaic_kicker', e.target.value)}
            placeholder="Γραφείο"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-semibold text-slate-700">Τίτλος</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            value={form.rent_services_mosaic_title}
            onChange={(e) => setField('rent_services_mosaic_title', e.target.value)}
            placeholder="Υπηρεσίες του γραφείου μας"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-semibold text-slate-700">Υπότιτλος</span>
          <textarea
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            rows={2}
            value={form.rent_services_mosaic_lead}
            onChange={(e) => setField('rent_services_mosaic_lead', e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-900 hover:bg-teal-100 disabled:opacity-50"
          onClick={addCard}
          disabled={form.rent_services_mosaic_cards.length >= RENT_SERVICES_MOSAIC_MAX}
        >
          + Κάρτα
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={resetDefaults}
        >
          Επαναφορά προεπιλογών
        </button>
      </div>

      <div className="space-y-4">
        {form.rent_services_mosaic_cards.map((card, index) => (
          <div
            key={card.id || index}
            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-800">Κάρτα {index + 1}</p>
              <button
                type="button"
                className="text-sm font-semibold text-rose-600 hover:underline"
                onClick={() => removeCard(index)}
              >
                Διαγραφή
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">Τίτλος</span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  value={card.title}
                  onChange={(e) => updateCard(index, { title: e.target.value })}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">Σύντομο κείμενο (κάρτα)</span>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  rows={2}
                  value={card.subtitle}
                  onChange={(e) => updateCard(index, { subtitle: e.target.value })}
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">Λεπτομέρειες (popup)</span>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  rows={3}
                  value={card.body || ''}
                  onChange={(e) => updateCard(index, { body: e.target.value })}
                  placeholder="Αν συμπληρωθεί, το «Μάθετε περισσότερα» ανοίγει popup με αυτό το κείμενο."
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-slate-700">Κείμενο κουμπιού</span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  value={card.cta_label || DEFAULT_RENT_SERVICES_MOSAIC_CTA}
                  onChange={(e) => updateCard(index, { cta_label: e.target.value })}
                  placeholder={DEFAULT_RENT_SERVICES_MOSAIC_CTA}
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-slate-700">Προεπιλογή link</span>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  value={
                    RENT_SERVICES_MOSAIC_LINK_PRESETS.some((p) => p.value === card.href)
                      ? card.href
                      : '__custom__'
                  }
                  onChange={(e) => {
                    if (e.target.value === '__custom__') return;
                    updateCard(index, { href: e.target.value });
                  }}
                >
                  {RENT_SERVICES_MOSAIC_LINK_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                  <option value="__custom__">Προσαρμοσμένο URL…</option>
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">Link (URL, /διαδρομή ή #άγκυρα)</span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  value={card.href}
                  onChange={(e) => updateCard(index, { href: e.target.value })}
                  placeholder="#rent-guest-search"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-semibold text-slate-700">Icon (Material)</span>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  value={card.icon}
                  onChange={(e) => updateCard(index, { icon: e.target.value })}
                  placeholder="verified_user"
                />
              </label>
            </div>
            <ImageDropField
              label="Φωτογραφία κάρτας"
              hint="Προαιρετικό — χωρίς φωτό εμφανίζεται coastal gradient + icon"
              value={card.image_url}
              onChange={(url) => updateCard(index, { image_url: url })}
              onUpload={async (file) => {
                const kind = `rent_svc_${index}`;
                const result = await uploadSiteAsset(kind, file);
                return result?.url || result;
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={!dirty || saving}
          className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση υπηρεσιών'}
        </button>
        {dirty ? <span className="text-xs font-semibold text-amber-700">Μη αποθηκευμένες αλλαγές</span> : null}
      </div>
    </form>
  );
}
