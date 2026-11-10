import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  amenitiesToText,
  DEFAULT_ASIDE_PANEL,
  DEFAULT_SEAT_PRICING,
  LAYOUT_OPTIONS,
  normalizeAsidePanel,
  rowsToSeatOverrides,
  seatOverridesToRows,
  textToAmenities,
} from '../../lib/seats/seatPricing.js';
import { fetchAdminSeatPricing, updateSeatPricing } from '../../services/seatPricingApi.js';

const PANEL_TOGGLES = [
  { key: 'show_trip_card', label: 'Κάρτα εκδρομής', icon: 'confirmation_number' },
  { key: 'show_legend', label: 'Οδηγός χάρτη', icon: 'map' },
  { key: 'show_pricing', label: 'Τιμές θέσεων', icon: 'payments' },
  { key: 'show_amenities', label: 'Παροχές onboard', icon: 'hotel_class' },
  { key: 'show_availability', label: 'Διαθέσιμες θέσεις', icon: 'event_available' },
  { key: 'show_vehicle_photo', label: 'Φωτογραφία οχήματος', icon: 'directions_bus' },
  { key: 'show_route_stops', label: 'Δρομολόγιο / στάσεις', icon: 'route' },
  { key: 'show_tips', label: 'Συμβουλές', icon: 'lightbulb' },
  { key: 'show_deposit_note', label: 'Προκαταβολή', icon: 'account_balance_wallet' },
  { key: 'show_selected_seats', label: 'Επιλεγμένες θέσεις', icon: 'check_circle' },
];

const AMENITY_SUGGESTIONS = [
  'Κλιματισμός',
  'USB θύρες',
  'USB & 220V',
  'WiFi',
  'Extra legroom',
  'Αποσκευές κάτω από θέση',
  'Ανακλινόμενα leather seats',
  'Προτεραιότητα επιβίβασης',
  'Ψυγείο nearby',
  'WC onboard',
  'Premium audio',
];

function emptyAsideForm() {
  return {
    show_trip_card: true,
    show_legend: true,
    show_pricing: true,
    show_amenities: true,
    show_availability: true,
    show_vehicle_photo: false,
    show_route_stops: false,
    show_tips: true,
    show_deposit_note: true,
    show_selected_seats: true,
    trip_card_title: DEFAULT_ASIDE_PANEL.trip_card_title,
    amenities_title: DEFAULT_ASIDE_PANEL.amenities_title,
    standard_amenities_label: DEFAULT_ASIDE_PANEL.standard_amenities_label,
    vip_amenities_label: '',
    vehicle_image_url: '',
    route_stops_text: '',
    tips_text: '',
    legend_hint: '',
    deposit_note: '',
    availability_label: '',
  };
}

function asideToForm(panel) {
  const p = normalizeAsidePanel(panel);
  return {
    show_trip_card: p.show_trip_card,
    show_legend: p.show_legend,
    show_pricing: p.show_pricing,
    show_amenities: p.show_amenities,
    show_availability: p.show_availability,
    show_vehicle_photo: p.show_vehicle_photo,
    show_route_stops: p.show_route_stops,
    show_tips: p.show_tips,
    show_deposit_note: p.show_deposit_note,
    show_selected_seats: p.show_selected_seats,
    trip_card_title: p.trip_card_title,
    amenities_title: p.amenities_title,
    standard_amenities_label: p.standard_amenities_label,
    vip_amenities_label: p.vip_amenities_label,
    vehicle_image_url: p.vehicle_image_url,
    route_stops_text: amenitiesToText(p.route_stops),
    tips_text: amenitiesToText(p.tips),
    legend_hint: p.legend_hint,
    deposit_note: p.deposit_note,
    availability_label: p.availability_label,
  };
}

function asideFormToPayload(form) {
  return normalizeAsidePanel({
    show_trip_card: form.show_trip_card,
    show_legend: form.show_legend,
    show_pricing: form.show_pricing,
    show_amenities: form.show_amenities,
    show_availability: form.show_availability,
    show_vehicle_photo: form.show_vehicle_photo,
    show_route_stops: form.show_route_stops,
    show_tips: form.show_tips,
    show_deposit_note: form.show_deposit_note,
    show_selected_seats: form.show_selected_seats,
    trip_card_title: form.trip_card_title,
    amenities_title: form.amenities_title,
    standard_amenities_label: form.standard_amenities_label,
    vip_amenities_label: form.vip_amenities_label,
    vehicle_image_url: form.vehicle_image_url,
    route_stops: textToAmenities(form.route_stops_text),
    tips: textToAmenities(form.tips_text),
    legend_hint: form.legend_hint,
    deposit_note: form.deposit_note,
    availability_label: form.availability_label,
  });
}

function emptyLayoutForm() {
  const defaults = DEFAULT_SEAT_PRICING.layouts['luxury-coach'];
  return {
    show_popup: true,
    standard_mode: 'trip_price',
    standard_price_eur: '',
    vip_mode: 'markup',
    vip_price_eur: '',
    vip_markup_pct: 25,
    standard_amenities: [...(defaults.standard_amenities || [])],
    vip_amenities: [...(defaults.vip_amenities || [])],
    override_rows: [],
    aside: emptyAsideForm(),
  };
}

function layoutToForm(row) {
  return {
    show_popup: row.show_popup !== false,
    standard_mode: row.standard_mode || 'trip_price',
    standard_price_eur: row.standard_price_eur ?? '',
    vip_mode: row.vip_mode || 'markup',
    vip_price_eur: row.vip_price_eur ?? '',
    vip_markup_pct: row.vip_markup_pct ?? 25,
    standard_amenities: [...(row.standard_amenities || [])],
    vip_amenities: [...(row.vip_amenities || [])],
    override_rows: seatOverridesToRows(row.seat_overrides),
    aside: asideToForm(row.aside_panel),
  };
}

function formToPayload(form) {
  const standardPrice = form.standard_price_eur === '' ? null : Number(form.standard_price_eur);
  const vipPrice = form.vip_price_eur === '' ? null : Number(form.vip_price_eur);
  return {
    show_popup: Boolean(form.show_popup),
    standard_mode: form.standard_mode,
    standard_price_eur: Number.isFinite(standardPrice) ? standardPrice : null,
    vip_mode: form.vip_mode,
    vip_price_eur: Number.isFinite(vipPrice) ? vipPrice : null,
    vip_markup_pct: Number(form.vip_markup_pct) || 0,
    standard_amenities: (form.standard_amenities || []).map((a) => String(a).trim()).filter(Boolean),
    vip_amenities: (form.vip_amenities || []).map((a) => String(a).trim()).filter(Boolean),
    seat_overrides: rowsToSeatOverrides(form.override_rows),
    aside_panel: asideFormToPayload(form.aside),
  };
}

function Field({ label, hint, children }) {
  return (
    <label className="block text-sm">
      <span className="font-semibold text-slate-700">{label}</span>
      {hint ? <span className="block text-xs text-slate-500 mt-0.5 font-normal">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function inputClass(extra = '') {
  return `w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 ${extra}`;
}

function AmenityEditor({ items, onChange, accent = 'blue' }) {
  const [draft, setDraft] = useState('');
  const accentChip =
    accent === 'amber'
      ? 'bg-amber-50 text-amber-900 border-amber-200/80'
      : 'bg-slate-50 text-slate-800 border-slate-200';
  const accentBtn =
    accent === 'amber'
      ? 'bg-amber-500 hover:bg-amber-600 text-white'
      : 'bg-blue-600 hover:bg-blue-700 text-white';

  const add = (value) => {
    const next = String(value || '').trim();
    if (!next) return;
    if (items.some((a) => a.toLowerCase() === next.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...items, next]);
    setDraft('');
  };

  const suggestions = AMENITY_SUGGESTIONS.filter(
    (s) => !items.some((a) => a.toLowerCase() === s.toLowerCase()),
  ).slice(0, 6);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
        {items.length ? (
          items.map((item) => (
            <span
              key={item}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${accentChip}`}
            >
              {item}
              <button
                type="button"
                className="opacity-60 hover:opacity-100 -mr-0.5"
                aria-label={`Αφαίρεση ${item}`}
                onClick={() => onChange(items.filter((a) => a !== item))}
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </span>
          ))
        ) : (
          <span className="text-xs text-slate-400 py-1">Καμία παροχή ακόμα</span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          className={inputClass('flex-1')}
          placeholder="Νέα παροχή…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            }
          }}
        />
        <button
          type="button"
          onClick={() => add(draft)}
          className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-bold transition ${accentBtn}`}
        >
          Προσθήκη
        </button>
      </div>

      {suggestions.length ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LineListEditor({ items, onChange, placeholder, addLabel = 'Προσθήκη' }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const next = draft.trim();
    if (!next) return;
    onChange([...items, next]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li
            key={`${item}-${idx}`}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <span className="material-symbols-outlined text-slate-400 text-[18px] shrink-0">fiber_manual_record</span>
            <span className="flex-1 min-w-0 text-slate-800">{item}</span>
            <button
              type="button"
              className="text-slate-400 hover:text-rose-600"
              aria-label="Αφαίρεση"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          className={inputClass('flex-1')}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-bold text-white hover:bg-slate-800"
        >
          {addLabel}
        </button>
      </div>
    </div>
  );
}

function SeatOverridesEditor({ rows, onChange }) {
  const updateRow = (index, patch) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    onChange([
      ...rows,
      {
        key: `new-${Date.now()}`,
        seat: '',
        price_eur: '',
        amenities: [],
      },
    ]);
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-slate-700">Χωρίς ειδικές θέσεις</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Προσθέστε π.χ. 1A με σταθερή τιμή ή έξτρα παροχές — χωρίς σύνταξη κειμένου.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={row.key || `${row.seat}-${index}`}
              className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-[7rem_1fr] gap-2 flex-1 min-w-0">
                  <Field label="Θέση">
                    <input
                      className={inputClass('font-mono font-bold uppercase tracking-wide')}
                      placeholder="1A"
                      maxLength={4}
                      value={row.seat}
                      onChange={(e) =>
                        updateRow(index, {
                          seat: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''),
                        })
                      }
                    />
                  </Field>
                  <Field label="Τιμή €" hint="Κενό = τιμή κατηγορίας">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={inputClass('pr-8')}
                        placeholder="π.χ. 95"
                        value={row.price_eur}
                        onChange={(e) => updateRow(index, { price_eur: e.target.value })}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        €
                      </span>
                    </div>
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  className="mt-7 shrink-0 rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Διαγραφή θέσης"
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
              <Field label="Παροχές θέσης" hint="Κενό = παροχές κατηγορίας (Standard / VIP)">
                <AmenityEditor
                  items={row.amenities || []}
                  onChange={(amenities) => updateRow(index, { amenities })}
                  accent="blue"
                />
              </Field>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        Προσθήκη θέσης
      </button>
    </div>
  );
}

function pricingSummary(form) {
  if (form.standard_mode === 'fixed' && form.standard_price_eur !== '') {
    return `Standard ${form.standard_price_eur}€`;
  }
  if (form.vip_mode === 'markup') {
    return `VIP +${Number(form.vip_markup_pct) || 0}% · Standard από εκδρομή`;
  }
  if (form.vip_mode === 'fixed' && form.vip_price_eur !== '') {
    return `VIP ${form.vip_price_eur}€ · Standard από εκδρομή`;
  }
  return 'Τιμές από dynamic pricing εκδρομής';
}

export default function SeatPricingPanel() {
  const formId = useId();
  const [layoutId, setLayoutId] = useState(LAYOUT_OPTIONS[0]?.id || 'luxury-coach');
  const [allLayouts, setAllLayouts] = useState({ ...DEFAULT_SEAT_PRICING.layouts });
  const [form, setForm] = useState(emptyLayoutForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminSeatPricing();
      setAllLayouts({ ...DEFAULT_SEAT_PRICING.layouts, ...data.layouts });
    } catch (err) {
      const detail = String(err?.message || '').trim();
      toast.error(
        detail && detail !== 'Request failed'
          ? detail
          : 'Αποτυχία φόρτωσης ρυθμίσεων θέσεων',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const row = allLayouts[layoutId] || DEFAULT_SEAT_PRICING.layouts[layoutId];
    setForm(layoutToForm(row));
  }, [layoutId, allLayouts]);

  const layoutLabel = useMemo(
    () => LAYOUT_OPTIONS.find((l) => l.id === layoutId)?.label || layoutId,
    [layoutId],
  );

  const setAside = (patch) => setForm((p) => ({ ...p, aside: { ...p.aside, ...patch } }));

  const onSave = async (e) => {
    e.preventDefault();
    const badSeat = (form.override_rows || []).find(
      (r) => (r.price_eur !== '' || (r.amenities || []).length) && !String(r.seat || '').trim(),
    );
    if (badSeat) {
      toast.error('Συμπληρώστε τον κωδικό θέσης (π.χ. 1A) στις ειδικές τιμές');
      return;
    }
    setSaving(true);
    try {
      const payload = formToPayload(form);
      const data = await updateSeatPricing({ [layoutId]: payload });
      setAllLayouts({ ...DEFAULT_SEAT_PRICING.layouts, ...data.layouts });
      toast.success(`Αποθηκεύτηκε: ${layoutLabel}`);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
        Φόρτωση ρυθμίσεων θέσεων…
      </div>
    );
  }

  return (
    <form
      id={formId}
      onSubmit={onSave}
      className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)]"
    >
      {/* Header */}
      <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-blue-50/60 px-5 py-5 sm:px-7 sm:py-6">
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-blue-400/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">
              <span className="material-symbols-outlined text-[16px]">event_seat</span>
              Seat desk
            </div>
            <h4 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
              Θέσεις, τιμές & panel
            </h4>
            <p className="mt-1 max-w-xl text-sm text-slate-500 leading-relaxed">
              Ρυθμίσεις ανά τύπο λεωφορείου — χωρίς κρυφή σύνταξη. Παροχές με chips, ειδικές θέσεις με φόρμα.
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-600">{pricingSummary(form)}</p>
          </div>

          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, show_popup: !p.show_popup }))}
            className={`inline-flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left text-sm font-bold transition ${
              form.show_popup
                ? 'border-blue-200 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                form.show_popup ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {form.show_popup ? 'touch_app' : 'do_not_touch'}
              </span>
            </span>
            <span>
              Popup επιλογής
              <span className="block text-[11px] font-semibold opacity-70">
                {form.show_popup ? 'Ενεργό κατά το κλικ θέσης' : 'Απενεργοποιημένο'}
              </span>
            </span>
          </button>
        </div>

        {/* Vehicle type tabs */}
        <div className="relative mt-5 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {LAYOUT_OPTIONS.map((l) => {
            const active = l.id === layoutId;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLayoutId(l.id)}
                className={`shrink-0 rounded-2xl border px-3.5 py-2.5 text-sm font-bold transition ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-6 px-5 py-5 sm:px-7 sm:py-6">
        {/* Standard / VIP */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <span className="material-symbols-outlined">airline_seat_recline_normal</span>
              </span>
              <div>
                <h5 className="font-extrabold text-slate-900">Κανονικές θέσεις</h5>
                <p className="text-xs text-slate-500">Standard σειρές</p>
              </div>
            </div>

            <Field label="Τιμολόγηση">
              <select
                className={inputClass()}
                value={form.standard_mode}
                onChange={(e) => setForm((p) => ({ ...p, standard_mode: e.target.value }))}
              >
                <option value="trip_price">Τιμή εκδρομής (dynamic pricing)</option>
                <option value="fixed">Σταθερή τιμή €</option>
              </select>
            </Field>

            {form.standard_mode === 'fixed' ? (
              <Field label="Τιμή €">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass()}
                  value={form.standard_price_eur}
                  onChange={(e) => setForm((p) => ({ ...p, standard_price_eur: e.target.value }))}
                />
              </Field>
            ) : null}

            <Field label="Παροχές">
              <AmenityEditor
                items={form.standard_amenities}
                onChange={(standard_amenities) => setForm((p) => ({ ...p, standard_amenities }))}
              />
            </Field>
          </section>

          <section className="rounded-3xl border border-amber-200/80 bg-gradient-to-b from-amber-50/90 to-white p-4 sm:p-5 space-y-4 shadow-[inset_0_1px_0_rgba(251,191,36,0.35)]">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-white">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  star
                </span>
              </span>
              <div>
                <h5 className="font-extrabold text-slate-900">VIP θέσεις</h5>
                <p className="text-xs text-amber-800/80">Μπροστινές σειρές</p>
              </div>
            </div>

            <Field label="Τιμολόγηση VIP">
              <select
                className={inputClass()}
                value={form.vip_mode}
                onChange={(e) => setForm((p) => ({ ...p, vip_mode: e.target.value }))}
              >
                <option value="markup">Markup % πάνω από τιμή εκδρομής</option>
                <option value="fixed">Σταθερή τιμή €</option>
                <option value="trip_price">Ίδια με εκδρομή</option>
              </select>
            </Field>

            {form.vip_mode === 'markup' ? (
              <Field label="Markup VIP %" hint="Π.χ. 25 → VIP = τιμή εκδρομής × 1.25">
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    className="flex-1 accent-amber-500"
                    value={Number(form.vip_markup_pct) || 0}
                    onChange={(e) => setForm((p) => ({ ...p, vip_markup_pct: e.target.value }))}
                  />
                  <input
                    type="number"
                    min="0"
                    max="200"
                    className={inputClass('w-20 text-center font-bold')}
                    value={form.vip_markup_pct}
                    onChange={(e) => setForm((p) => ({ ...p, vip_markup_pct: e.target.value }))}
                  />
                </div>
              </Field>
            ) : null}

            {form.vip_mode === 'fixed' ? (
              <Field label="Τιμή VIP €">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass()}
                  value={form.vip_price_eur}
                  onChange={(e) => setForm((p) => ({ ...p, vip_price_eur: e.target.value }))}
                />
              </Field>
            ) : null}

            <Field label="Παροχές VIP">
              <AmenityEditor
                items={form.vip_amenities}
                onChange={(vip_amenities) => setForm((p) => ({ ...p, vip_amenities }))}
                accent="amber"
              />
            </Field>
          </section>
        </div>

        {/* Seat overrides */}
        <section className="rounded-3xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h5 className="font-extrabold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">tune</span>
                Ειδικές θέσεις
              </h5>
              <p className="text-xs text-slate-500 mt-1">
                Προαιρετικά — σταθερή τιμή ή έξτρα παροχές σε συγκεκριμένες θέσεις (1A, 2B…).
              </p>
            </div>
            <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              {form.override_rows.length} θέσ{form.override_rows.length === 1 ? 'η' : 'εις'}
            </span>
          </div>
          <SeatOverridesEditor
            rows={form.override_rows}
            onChange={(override_rows) => setForm((p) => ({ ...p, override_rows }))}
          />
        </section>

        {/* Aside panel */}
        <section className="rounded-3xl border border-sky-200/80 bg-gradient-to-b from-sky-50/70 to-white p-4 sm:p-5 space-y-5">
          <div>
            <h5 className="font-extrabold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-sky-600">view_sidebar</span>
              Αριστερό panel επιλογής
            </h5>
            <p className="text-xs text-slate-500 mt-1">
              Τι εμφανίζεται δίπλα στον χάρτη θέσεων για αυτόν τον τύπο οχήματος.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {PANEL_TOGGLES.map(({ key, label, icon }) => {
              const on = Boolean(form.aside[key]);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAside({ [key]: !on })}
                  className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                    on
                      ? 'border-sky-300 bg-white text-sky-950 shadow-sm'
                      : 'border-transparent bg-white/50 text-slate-500 hover:bg-white'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                      on ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{icon}</span>
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">{label}</span>
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      on ? 'text-sky-600' : 'text-slate-300'
                    }`}
                  >
                    {on ? 'check_circle' : 'circle'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Τίτλος κάρτας εκδρομής">
              <input
                className={inputClass()}
                value={form.aside.trip_card_title}
                onChange={(e) => setAside({ trip_card_title: e.target.value })}
              />
            </Field>
            <Field label="Τίτλος παροχών">
              <input
                className={inputClass()}
                value={form.aside.amenities_title}
                onChange={(e) => setAside({ amenities_title: e.target.value })}
              />
            </Field>
            <Field label="Ετικέτα standard">
              <input
                className={inputClass()}
                value={form.aside.standard_amenities_label}
                onChange={(e) => setAside({ standard_amenities_label: e.target.value })}
              />
            </Field>
            <Field label="Ετικέτα VIP" hint="Κενό = από theme">
              <input
                className={inputClass()}
                value={form.aside.vip_amenities_label}
                onChange={(e) => setAside({ vip_amenities_label: e.target.value })}
              />
            </Field>
          </div>

          {form.aside.show_vehicle_photo ? (
            <Field label="URL φωτογραφίας οχήματος">
              <input
                type="url"
                className={inputClass()}
                placeholder="https://… ή /uploads/coach.jpg"
                value={form.aside.vehicle_image_url}
                onChange={(e) => setAside({ vehicle_image_url: e.target.value })}
              />
            </Field>
          ) : null}

          {form.aside.show_route_stops ? (
            <Field
              label="Στάσεις / δρομολόγιο"
              hint="Π.χ. 08:00 | Αθήνα · ή 10:30 Λαμία"
            >
              <LineListEditor
                items={textToAmenities(form.aside.route_stops_text)}
                onChange={(lines) => setAside({ route_stops_text: amenitiesToText(lines) })}
                placeholder="08:00 | Αθήνα, Πεδίον Άρεως"
              />
            </Field>
          ) : null}

          {form.aside.show_tips ? (
            <Field label="Tips">
              <LineListEditor
                items={textToAmenities(form.aside.tips_text)}
                onChange={(lines) => setAside({ tips_text: amenitiesToText(lines) })}
                placeholder="Προτείνουμε VIP για extra legroom"
              />
            </Field>
          ) : null}

          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Υπόδειξη οδηγού χάρτη">
              <input
                className={inputClass()}
                placeholder="Κλικ σε θέση για τιμή & παροχές"
                value={form.aside.legend_hint}
                onChange={(e) => setAside({ legend_hint: e.target.value })}
              />
            </Field>
            <Field label="Ετικέτα διαθεσιμότητας" hint="Χρησιμοποιήστε {count}">
              <input
                className={inputClass('font-mono text-[13px]')}
                placeholder="{count} διαθέσιμες θέσεις"
                value={form.aside.availability_label}
                onChange={(e) => setAside({ availability_label: e.target.value })}
              />
            </Field>
          </div>

          {form.aside.show_deposit_note ? (
            <Field label="Κείμενο προκαταβολής" hint="Χρησιμοποιήστε {percent} · κενό = default">
              <input
                className={inputClass()}
                placeholder="Προκαταβολή {percent}% online — υπόλοιπο στο λεωφορείο."
                value={form.aside.deposit_note}
                onChange={(e) => setAside({ deposit_note: e.target.value })}
              />
            </Field>
          ) : null}
        </section>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
        <p className="text-xs text-slate-500">
          Αποθήκευση μόνο για <span className="font-bold text-slate-800">{layoutLabel}</span>
        </p>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">
            {saving ? 'progress_activity' : 'save'}
          </span>
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </button>
      </div>
    </form>
  );
}
