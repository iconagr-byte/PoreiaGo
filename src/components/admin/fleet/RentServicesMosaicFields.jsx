/**
 * Controlled fields for /rent services mosaic — used by desk editor + Page Studio Builder.
 */
import ImageDropField from '../ImageDropField.jsx';
import {
  DEFAULT_RENT_SERVICES_MOSAIC_CARDS,
  DEFAULT_RENT_SERVICES_MOSAIC_CTA,
  RENT_SERVICES_MOSAIC_LINK_PRESETS,
  RENT_SERVICES_MOSAIC_MAX,
  resolveRentServicesMosaic,
} from '../../../lib/rental/rentServicesMosaic.js';
import { uploadSiteAsset } from '../../../services/siteAppearanceApi.js';

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

/** Normalize appearance-shaped form so cards always exist for editing. */
export function ensureRentServicesMosaicForm(form = {}) {
  const resolved = resolveRentServicesMosaic(form);
  const cards = Array.isArray(form.rent_services_mosaic_cards)
    ? form.rent_services_mosaic_cards.map((c) => ({ ...c }))
    : [];
  return {
    rent_services_mosaic_enabled: form.rent_services_mosaic_enabled !== false,
    rent_services_mosaic_kicker:
      form.rent_services_mosaic_kicker ?? resolved.kicker,
    rent_services_mosaic_title: form.rent_services_mosaic_title ?? resolved.title,
    rent_services_mosaic_lead: form.rent_services_mosaic_lead ?? resolved.lead,
    rent_services_mosaic_cards: cards.length
      ? cards
      : resolved.cards.map((c) => ({ ...c })),
  };
}

export default function RentServicesMosaicFields({
  form,
  setForm,
  compact = false,
}) {
  const mosaic = ensureRentServicesMosaicForm(form);
  const cards = mosaic.rent_services_mosaic_cards;

  const setField = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const updateCard = (index, patch) => {
    setForm((p) => {
      const current = ensureRentServicesMosaicForm(p);
      return {
        ...p,
        ...current,
        rent_services_mosaic_cards: current.rent_services_mosaic_cards.map((row, i) =>
          i === index ? { ...row, ...patch } : row,
        ),
      };
    });
  };

  const addCard = () => {
    setForm((p) => {
      const current = ensureRentServicesMosaicForm(p);
      if (current.rent_services_mosaic_cards.length >= RENT_SERVICES_MOSAIC_MAX) {
        return p;
      }
      return {
        ...p,
        ...current,
        rent_services_mosaic_cards: [
          ...current.rent_services_mosaic_cards,
          blankCard(),
        ],
      };
    });
  };

  const removeCard = (index) => {
    setForm((p) => {
      const current = ensureRentServicesMosaicForm(p);
      return {
        ...p,
        ...current,
        rent_services_mosaic_cards: current.rent_services_mosaic_cards.filter(
          (_, i) => i !== index,
        ),
      };
    });
  };

  const resetDefaults = () => {
    setForm((p) => ({
      ...p,
      rent_services_mosaic_cards: DEFAULT_RENT_SERVICES_MOSAIC_CARDS.map((c) => ({
        ...c,
      })),
    }));
  };

  const inputClass = compact
    ? 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm'
    : 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2';

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <input
          type="checkbox"
          checked={Boolean(mosaic.rent_services_mosaic_enabled)}
          onChange={(e) => setField('rent_services_mosaic_enabled', e.target.checked)}
        />
        Εμφάνιση ενότητας στο /rent
      </label>

      <div className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
        <label className="block text-sm">
          <span className="font-semibold text-slate-700">Eyebrow</span>
          <input
            className={inputClass}
            value={mosaic.rent_services_mosaic_kicker}
            onChange={(e) => setField('rent_services_mosaic_kicker', e.target.value)}
            placeholder="Γραφείο"
          />
        </label>
        <label className={`block text-sm ${compact ? '' : 'sm:col-span-2'}`}>
          <span className="font-semibold text-slate-700">Τίτλος</span>
          <input
            className={inputClass}
            value={mosaic.rent_services_mosaic_title}
            onChange={(e) => setField('rent_services_mosaic_title', e.target.value)}
            placeholder="Υπηρεσίες του γραφείου μας"
          />
        </label>
        <label className={`block text-sm ${compact ? '' : 'sm:col-span-2'}`}>
          <span className="font-semibold text-slate-700">Υπότιτλος</span>
          <textarea
            className={inputClass}
            rows={2}
            value={mosaic.rent_services_mosaic_lead}
            onChange={(e) => setField('rent_services_mosaic_lead', e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-900 hover:bg-teal-100 disabled:opacity-50"
          onClick={addCard}
          disabled={cards.length >= RENT_SERVICES_MOSAIC_MAX}
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
        {cards.map((card, index) => (
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
            <div className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
              <label className={`block text-sm ${compact ? '' : 'sm:col-span-2'}`}>
                <span className="font-semibold text-slate-700">Τίτλος</span>
                <input
                  className={inputClass}
                  value={card.title || ''}
                  onChange={(e) => updateCard(index, { title: e.target.value })}
                />
              </label>
              <label className={`block text-sm ${compact ? '' : 'sm:col-span-2'}`}>
                <span className="font-semibold text-slate-700">Σύντομο κείμενο (κάρτα)</span>
                <textarea
                  className={inputClass}
                  rows={2}
                  value={card.subtitle || ''}
                  onChange={(e) => updateCard(index, { subtitle: e.target.value })}
                />
              </label>
              <label className={`block text-sm ${compact ? '' : 'sm:col-span-2'}`}>
                <span className="font-semibold text-slate-700">Λεπτομέρειες (popup)</span>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={card.body || ''}
                  onChange={(e) => updateCard(index, { body: e.target.value })}
                  placeholder="Αν συμπληρωθεί, το «Μάθετε περισσότερα» ανοίγει popup με αυτό το κείμενο."
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-slate-700">Κείμενο κουμπιού</span>
                <input
                  className={inputClass}
                  value={card.cta_label || DEFAULT_RENT_SERVICES_MOSAIC_CTA}
                  onChange={(e) => updateCard(index, { cta_label: e.target.value })}
                  placeholder={DEFAULT_RENT_SERVICES_MOSAIC_CTA}
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-slate-700">Προεπιλογή link</span>
                <select
                  className={inputClass}
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
              <label className={`block text-sm ${compact ? '' : 'sm:col-span-2'}`}>
                <span className="font-semibold text-slate-700">Link (URL, /διαδρομή ή #άγκυρα)</span>
                <input
                  className={inputClass}
                  value={card.href || ''}
                  onChange={(e) => updateCard(index, { href: e.target.value })}
                  placeholder="#rent-guest-search"
                />
              </label>
            </div>
            <ImageDropField
              label="Φωτογραφία κάρτας"
              hint="Προαιρετικό — χωρίς φωτό εμφανίζεται coastal gradient + icon"
              value={card.image_url || ''}
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
    </div>
  );
}
