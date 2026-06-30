import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  amenitiesToText,
  DEFAULT_ASIDE_PANEL,
  DEFAULT_SEAT_PRICING,
  formatSeatOverridesText,
  LAYOUT_OPTIONS,
  normalizeAsidePanel,
  parseSeatOverridesText,
  textToAmenities,
} from '../../lib/seats/seatPricing.js';
import { fetchAdminSeatPricing, updateSeatPricing } from '../../services/seatPricingApi.js';

const PANEL_TOGGLES = [
  { key: 'show_trip_card', label: 'Κάρτα εκδρομής' },
  { key: 'show_legend', label: 'Οδηγός χάρτη' },
  { key: 'show_pricing', label: 'Τιμές θέσεων' },
  { key: 'show_amenities', label: 'Παροχές onboard' },
  { key: 'show_availability', label: 'Διαθέσιμες θέσεις (live)' },
  { key: 'show_vehicle_photo', label: 'Φωτογραφία οχήματος' },
  { key: 'show_route_stops', label: 'Δρομολόγιο / στάσεις' },
  { key: 'show_tips', label: 'Συμβουλές / tips' },
  { key: 'show_deposit_note', label: 'Σημείωση προκαταβολής' },
  { key: 'show_selected_seats', label: 'Επιλεγμένες θέσεις' },
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
  return {
    show_popup: true,
    standard_mode: 'trip_price',
    standard_price_eur: '',
    vip_mode: 'markup',
    vip_price_eur: '',
    vip_markup_pct: 25,
    standard_amenities_text: amenitiesToText(DEFAULT_SEAT_PRICING.layouts['luxury-coach'].standard_amenities),
    vip_amenities_text: amenitiesToText(DEFAULT_SEAT_PRICING.layouts['luxury-coach'].vip_amenities),
    overrides_text: '',
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
    standard_amenities_text: amenitiesToText(row.standard_amenities),
    vip_amenities_text: amenitiesToText(row.vip_amenities),
    overrides_text: formatSeatOverridesText(row.seat_overrides),
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
    standard_amenities: textToAmenities(form.standard_amenities_text),
    vip_amenities: textToAmenities(form.vip_amenities_text),
    seat_overrides: parseSeatOverridesText(form.overrides_text),
    aside_panel: asideFormToPayload(form.aside),
  };
}

export default function SeatPricingPanel() {
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
    } catch {
      toast.error('Αποτυχία φόρτωσης ρυθμίσεων θέσεων');
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
    setSaving(true);
    try {
      const payload = formToPayload(form);
      const data = await updateSeatPricing({ [layoutId]: payload });
      setAllLayouts({ ...DEFAULT_SEAT_PRICING.layouts, ...data.layouts });
      toast.success(`Οι ρυθμίσεις (${layoutLabel}) αποθηκεύτηκαν`);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500 py-4">Φόρτωση ρυθμίσεων θέσεων…</p>;
  }

  return (
    <form
      onSubmit={onSave}
      className="bg-white rounded-[24px] border border-black/[0.06] p-6 shadow-sm space-y-5"
    >
      <div>
        <h4 className="font-bold text-gray-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">event_seat</span>
          Θέσεις, τιμές & panel επιλογής
        </h4>
        <p className="text-xs text-gray-500 mt-1">
          Ξεχωριστές ρυθμίσεις ανά τύπο λεωφορείου — τιμές, παροχές και αριστερό panel επιλογής θέσης.
        </p>
      </div>

      <label className="block text-sm max-w-md">
        <span className="font-bold text-gray-700">Διάταξη / τύπος οχήματος</span>
        <select
          className="mt-1 w-full rounded-xl border px-3 py-2.5"
          value={layoutId}
          onChange={(e) => setLayoutId(e.target.value)}
        >
          {LAYOUT_OPTIONS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-3 text-sm font-bold text-gray-700">
        <input
          type="checkbox"
          className="w-5 h-5"
          checked={form.show_popup}
          onChange={(e) => setForm((p) => ({ ...p, show_popup: e.target.checked }))}
        />
        Εμφάνιση popup με τιμή & παροχές κατά την επιλογή θέσης
      </label>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-black/[0.06] p-4 space-y-3 bg-surface-container-lowest">
          <p className="text-sm font-bold text-gray-900">Κανονικές θέσεις</p>
          <label className="block text-sm">
            <span className="font-bold text-gray-600">Τιμολόγηση</span>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={form.standard_mode}
              onChange={(e) => setForm((p) => ({ ...p, standard_mode: e.target.value }))}
            >
              <option value="trip_price">Τιμή εκδρομής (dynamic pricing)</option>
              <option value="fixed">Σταθερή τιμή €</option>
            </select>
          </label>
          {form.standard_mode === 'fixed' && (
            <label className="block text-sm">
              <span className="font-bold text-gray-600">Τιμή €</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.standard_price_eur}
                onChange={(e) => setForm((p) => ({ ...p, standard_price_eur: e.target.value }))}
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="font-bold text-gray-600">Παροχές (μία ανά γραμμή)</span>
            <textarea
              rows={4}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm resize-y"
              value={form.standard_amenities_text}
              onChange={(e) => setForm((p) => ({ ...p, standard_amenities_text: e.target.value }))}
            />
          </label>
        </div>

        <div className="rounded-2xl border border-amber-200/60 p-4 space-y-3 bg-amber-50/40">
          <p className="text-sm font-bold text-gray-900">VIP θέσεις (μπροστινές σειρές)</p>
          <label className="block text-sm">
            <span className="font-bold text-gray-600">Τιμολόγηση VIP</span>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={form.vip_mode}
              onChange={(e) => setForm((p) => ({ ...p, vip_mode: e.target.value }))}
            >
              <option value="markup">Markup % πάνω από τιμή εκδρομής</option>
              <option value="fixed">Σταθερή τιμή €</option>
              <option value="trip_price">Ίδια με εκδρομή</option>
            </select>
          </label>
          {form.vip_mode === 'markup' && (
            <label className="block text-sm">
              <span className="font-bold text-gray-600">Markup VIP %</span>
              <input
                type="number"
                min="0"
                max="200"
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.vip_markup_pct}
                onChange={(e) => setForm((p) => ({ ...p, vip_markup_pct: e.target.value }))}
              />
            </label>
          )}
          {form.vip_mode === 'fixed' && (
            <label className="block text-sm">
              <span className="font-bold text-gray-600">Τιμή VIP €</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-xl border px-3 py-2"
                value={form.vip_price_eur}
                onChange={(e) => setForm((p) => ({ ...p, vip_price_eur: e.target.value }))}
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="font-bold text-gray-600">Παροχές VIP</span>
            <textarea
              rows={4}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm resize-y"
              value={form.vip_amenities_text}
              onChange={(e) => setForm((p) => ({ ...p, vip_amenities_text: e.target.value }))}
            />
          </label>
        </div>
      </div>

      <label className="block text-sm">
        <span className="font-bold text-gray-700">Ειδικές τιμές & παροχές ανά θέση (προαιρετικό)</span>
        <p className="text-xs text-gray-500 mt-0.5">
          <span className="font-mono">1A=95|WiFi, Extra legroom</span> · <span className="font-mono">2B=110</span>
        </p>
        <textarea
          rows={3}
          className="mt-1 w-full rounded-xl border px-3 py-2 font-mono text-sm resize-y"
          placeholder={'1A=95|WiFi, Extra legroom\n2B=110'}
          value={form.overrides_text}
          onChange={(e) => setForm((p) => ({ ...p, overrides_text: e.target.value }))}
        />
      </label>

      <div className="rounded-2xl border border-sky-200/70 bg-sky-50/40 p-5 space-y-4">
        <div>
          <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-sky-600 text-[20px]">view_sidebar</span>
            Αριστερό panel επιλογής θέσης
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Κάθε τύπος οχήματος μπορεί να έχει διαφορετικές παροχές, φωτογραφία, στάσεις και tips.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 gap-y-2">
          {PANEL_TOGGLES.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={Boolean(form.aside[key])}
                onChange={(e) => setAside({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-bold text-gray-600">Τίτλος κάρτας εκδρομής</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={form.aside.trip_card_title}
              onChange={(e) => setAside({ trip_card_title: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="font-bold text-gray-600">Τίτλος παροχών</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={form.aside.amenities_title}
              onChange={(e) => setAside({ amenities_title: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="font-bold text-gray-600">Ετικέτα standard παροχών</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={form.aside.standard_amenities_label}
              onChange={(e) => setAside({ standard_amenities_label: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="font-bold text-gray-600">Ετικέτα VIP παροχών (κενό = theme)</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={form.aside.vip_amenities_label}
              onChange={(e) => setAside({ vip_amenities_label: e.target.value })}
            />
          </label>
        </div>

        {form.aside.show_vehicle_photo && (
          <label className="block text-sm">
            <span className="font-bold text-gray-600">URL φωτογραφίας οχήματος</span>
            <input
              type="url"
              className="mt-1 w-full rounded-xl border px-3 py-2"
              placeholder="https://… ή /uploads/coach.jpg"
              value={form.aside.vehicle_image_url}
              onChange={(e) => setAside({ vehicle_image_url: e.target.value })}
            />
          </label>
        )}

        {form.aside.show_route_stops && (
          <label className="block text-sm">
            <span className="font-bold text-gray-600">Στάσεις / δρομολόγιο (μία ανά γραμμή)</span>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">08:00 | Αθήνα · 10:30 Λαμία</p>
            <textarea
              rows={4}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm resize-y font-mono"
              placeholder={'08:00 | Αθήνα, Πεδίον Άρεως\n10:30 | Στάση Λαμία\n14:00 | Μετέωρα'}
              value={form.aside.route_stops_text}
              onChange={(e) => setAside({ route_stops_text: e.target.value })}
            />
          </label>
        )}

        {form.aside.show_tips && (
          <label className="block text-sm">
            <span className="font-bold text-gray-600">Tips (μία ανά γραμμή)</span>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm resize-y"
              placeholder={'Προτείνουμε VIP για extra legroom\nΟι μπροστινές θέσεις γεμίζουν πρώτες'}
              value={form.aside.tips_text}
              onChange={(e) => setAside({ tips_text: e.target.value })}
            />
          </label>
        )}

        <div className="grid md:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-bold text-gray-600">Υπόδειξη οδηγού χάρτη (προαιρετικό)</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="Κλικ σε θέση για τιμή & παροχές"
              value={form.aside.legend_hint}
              onChange={(e) => setAside({ legend_hint: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="font-bold text-gray-600">Ετικέτα διαθεσιμότητας</span>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-mono"
              placeholder="{count} διαθέσιμες θέσεις"
              value={form.aside.availability_label}
              onChange={(e) => setAside({ availability_label: e.target.value })}
            />
          </label>
        </div>

        {form.aside.show_deposit_note && (
          <label className="block text-sm">
            <span className="font-bold text-gray-600">Κείμενο προκαταβολής (προαιρετικό)</span>
            <p className="text-xs text-gray-500 mt-0.5">Χρησιμοποιήστε {'{percent}'} για το % · κενό = default</p>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="Προκαταβολή {percent}% online — υπόλοιπο στο λεωφορείο."
              value={form.aside.deposit_note}
              onChange={(e) => setAside({ deposit_note: e.target.value })}
            />
          </label>
        )}
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold disabled:opacity-60"
      >
        {saving ? 'Αποθήκευση…' : `Αποθήκευση — ${layoutLabel}`}
      </button>
    </form>
  );
}
