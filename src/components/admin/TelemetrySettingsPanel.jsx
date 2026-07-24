import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  fetchTelemetrySettings,
  updateTelemetrySettings,
  DEFAULT_TELEMETRY_SETTINGS,
} from '../../services/telemetryApi.js';

const pillInputClass =
  'w-full rounded-full border border-slate-200/90 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-none outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15';
const checkClass =
  'h-4 w-4 shrink-0 rounded-[5px] border-slate-300 text-primary accent-primary focus:ring-primary/30';

const SECTIONS = [
  {
    id: 'geofence',
    title: 'Geofencing & Διαδρομή',
    icon: 'route',
    tone: 'cyan',
    blurb: 'Corridor buffer, στάσεις και φιλτράρισμα ψευδών alerts.',
    fields: [
      {
        key: 'corridor_buffer_m',
        label: 'Buffer διαδρομής',
        unit: 'm',
        hint: '50–100m συνιστάται για λεωφορεία',
        min: 30,
        max: 200,
      },
      {
        key: 'geofence_radius_m',
        label: 'Ακτίνα στάσης',
        unit: 'm',
        hint: 'Άφιξη σε σημείο ενδιαφέροντος',
        min: 30,
        max: 200,
      },
      {
        key: 'corridor_min_speed_kmh',
        label: 'Ελάχ. ταχύτητα ελέγχου',
        unit: 'km/h',
        hint: 'Κάτω από αυτή δεν ελέγχεται corridor',
        min: 0,
        max: 40,
        step: 1,
      },
      {
        key: 'corridor_debounce_points',
        label: 'Debouncing',
        unit: 'σημεία GPS',
        hint: 'Λιγότερα ψευδή alerts',
        min: 1,
        max: 10,
        step: 1,
      },
    ],
  },
  {
    id: 'behavior',
    title: 'Οδηγική συμπεριφορά',
    icon: 'health_and_safety',
    tone: 'emerald',
    blurb: 'Όρια επιτάχυνσης και προτεραιότητα events από tracker.',
    fields: [
      {
        key: 'gforce_spike_threshold_g',
        label: 'G-force threshold',
        unit: 'g',
        hint: 'Μόνο αν δεν υπάρχει tracker event',
        min: 0.1,
        max: 2,
        step: 0.05,
      },
      {
        key: 'prefer_tracker_events',
        label: 'Προτεραιότητα Teltonika events',
        type: 'checkbox',
        hint: 'Event 101/102/103 αντί υπολογισμού G από GPS',
      },
    ],
  },
  {
    id: 'idle',
    title: 'Ρελαντί & Καύσιμα',
    icon: 'local_gas_station',
    tone: 'amber',
    blurb: 'Alerts ρελαντί και εκτίμηση κόστους καυσίμου.',
    fields: [
      {
        key: 'idle_alert_seconds',
        label: 'Alert ρελαντί',
        unit: 'δευτ.',
        min: 60,
        max: 3600,
        step: 60,
      },
      {
        key: 'idle_fuel_liters_per_hour',
        label: 'Καύσιμο ρελαντί',
        unit: 'L/h',
        min: 0.5,
        max: 10,
        step: 0.1,
      },
      {
        key: 'fuel_price_eur_per_liter',
        label: 'Τιμή καυσίμου',
        unit: '€/L',
        min: 0.5,
        max: 5,
        step: 0.01,
      },
      {
        key: 'driver_stale_seconds',
        label: 'Stale οδηγού',
        unit: 'δευτ.',
        hint: 'Χωρίς GPS μετά από αυτό → offline / stale',
        min: 30,
        max: 600,
        step: 10,
      },
    ],
  },
  {
    id: 'digest',
    title: 'Ειδοποιήσεις digest',
    icon: 'notifications_active',
    tone: 'rose',
    blurb: 'Ημερήσιο digest λήξεων και alerts στο γραφείο.',
    fields: [
      {
        key: 'fleet_digest_enabled',
        label: 'Ενεργό digest στόλου',
        type: 'checkbox',
        hint: 'Συλλογή ημερήσιου digest για το γραφείο',
      },
      {
        key: 'fleet_digest_email_enabled',
        label: 'Αποστολή digest με email',
        type: 'checkbox',
        hint: 'Στέλνει το digest στο email του γραφείου',
      },
      {
        key: 'fleet_digest_sms_enabled',
        label: 'Αποστολή digest με SMS',
        type: 'checkbox',
        hint: 'Προαιρετικό SMS για κρίσιμα digest',
      },
    ],
  },
];

const TONE = {
  cyan: {
    card: 'border-cyan-200/70 from-cyan-50/70',
    icon: 'bg-cyan-100 text-cyan-700',
    chip: 'bg-cyan-50 text-cyan-800 border-cyan-200/70',
  },
  emerald: {
    card: 'border-emerald-200/70 from-emerald-50/60',
    icon: 'bg-emerald-100 text-emerald-700',
    chip: 'bg-emerald-50 text-emerald-800 border-emerald-200/70',
  },
  amber: {
    card: 'border-amber-200/70 from-amber-50/60',
    icon: 'bg-amber-100 text-amber-700',
    chip: 'bg-amber-50 text-amber-900 border-amber-200/70',
  },
  rose: {
    card: 'border-rose-200/70 from-rose-50/50',
    icon: 'bg-rose-100 text-rose-700',
    chip: 'bg-rose-50 text-rose-800 border-rose-200/70',
  },
};

const PRESETS = [
  {
    id: 'bus',
    label: 'Λεωφορείο',
    icon: 'directions_bus',
    values: {
      corridor_buffer_m: 75,
      geofence_radius_m: 50,
      corridor_min_speed_kmh: 8,
      corridor_debounce_points: 3,
      gforce_spike_threshold_g: 0.45,
      idle_alert_seconds: 300,
    },
  },
  {
    id: 'van',
    label: 'Van / μικρό',
    icon: 'airport_shuttle',
    values: {
      corridor_buffer_m: 50,
      geofence_radius_m: 40,
      corridor_min_speed_kmh: 5,
      corridor_debounce_points: 2,
      gforce_spike_threshold_g: 0.4,
      idle_alert_seconds: 240,
    },
  },
  {
    id: 'strict',
    label: 'Αυστηρό',
    icon: 'shield',
    values: {
      corridor_buffer_m: 50,
      geofence_radius_m: 40,
      corridor_min_speed_kmh: 10,
      corridor_debounce_points: 4,
      gforce_spike_threshold_g: 0.35,
      idle_alert_seconds: 180,
    },
  },
];

function parseFieldValue(field, raw) {
  if (field.step && field.step < 1) return parseFloat(raw);
  return parseInt(raw, 10);
}

function FieldControl({ field, value, onChange }) {
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-start gap-3 rounded-[20px] border border-slate-200/90 bg-white px-4 py-3.5 cursor-pointer transition hover:border-primary/25">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(field.key, e.target.checked)}
          className={`${checkClass} mt-0.5`}
        />
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-800">{field.label}</span>
          {field.hint && <span className="mt-0.5 block text-xs text-slate-500 leading-relaxed">{field.hint}</span>}
        </span>
      </label>
    );
  }

  const min = field.min ?? 0;
  const max = field.max ?? 100;
  const step = field.step ?? 1;
  const numeric = Number.isFinite(Number(value)) ? Number(value) : min;

  return (
    <div className="rounded-[20px] border border-slate-200/90 bg-white p-4 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800">{field.label}</p>
          {field.hint && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{field.hint}</p>}
        </div>
        {field.unit && (
          <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">
            {field.unit}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numeric}
          onChange={(e) => onChange(field.key, parseFieldValue(field, e.target.value))}
          className="min-w-0 flex-1 accent-primary"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value ?? ''}
          onChange={(e) => onChange(field.key, parseFieldValue(field, e.target.value))}
          className={`${pillInputClass} w-[6.5rem] shrink-0 text-center font-semibold tabular-nums`}
        />
      </div>
    </div>
  );
}

export default function TelemetrySettingsPanel() {
  const navigate = useNavigate();
  const [form, setForm] = useState(DEFAULT_TELEMETRY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchTelemetrySettings();
    setForm(data);
    setDirty(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const applyPreset = (preset) => {
    setForm((prev) => ({ ...prev, ...preset.values }));
    setDirty(true);
    toast.success(`Εφαρμόστηκε προφίλ «${preset.label}» — αποθηκεύστε για ισχύ`);
  };

  const onSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const updated = await updateTelemetrySettings(form);
      setForm(updated);
      setDirty(false);
      toast.success('Οι ρυθμίσεις αποθηκεύτηκαν');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    setForm({ ...DEFAULT_TELEMETRY_SETTINGS });
    setDirty(true);
  };

  const changedCount = useMemo(() => {
    if (!dirty) return 0;
    return Object.keys(DEFAULT_TELEMETRY_SETTINGS).filter(
      (key) => form[key] !== DEFAULT_TELEMETRY_SETTINGS[key] && key !== 'google_maps_configured',
    ).length;
  }, [dirty, form]);

  if (loading) {
    return (
      <section className="bg-white rounded-[28px] border border-slate-200/70 p-8 text-center text-slate-400 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        Φόρτωση ρυθμίσεων…
      </section>
    );
  }

  return (
    <section className="bg-white rounded-[28px] border border-slate-200/70 shadow-[0_8px_30px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-cyan-50/80 via-white to-white">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
            <span className="material-symbols-outlined text-[24px]">tune</span>
          </span>
          <div className="min-w-0">
            <h3 className="font-bold text-xl tracking-tight text-slate-900">
              Ρυθμίσεις Telematics (PoreiaGo)
            </h3>
            <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
              Geofence · G-force · ETA · ρελαντί — ισχύουν άμεσα στο fleet pipeline
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {form.google_maps_configured ? (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Google Maps ενεργό
            </span>
          ) : (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              Mock ETA (χωρίς GOOGLE_MAPS_API_KEY)
            </span>
          )}
          <button
            type="button"
            onClick={() => navigate('/admin', { state: { activeTab: 'fleet_live_map' } })}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[16px] text-cyan-600">map</span>
            Ζωντανός χάρτης
          </button>
        </div>
      </div>

      <form onSubmit={onSave} className="p-6 space-y-6">
        <div className="rounded-[22px] border border-sky-200/80 bg-gradient-to-r from-sky-50/90 to-white px-4 py-3.5 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <span className="material-symbols-outlined text-[20px]">lock</span>
          </span>
          <div>
            <div className="text-sm font-bold text-slate-900">Live refresh κλειδωμένο στα 5 δευτ.</div>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              ETA, χάρτης στόλου και live panels ανανεώνονται κάθε 5 δευτερόλεπτα σε όλη την πλατφόρμα.
            </p>
          </div>
        </div>

        <div className="rounded-[22px] border border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">Γρήγορα προφίλ</p>
            <p className="text-xs text-slate-500">Εφαρμόζουν τιμές · χρειάζεται αποθήκευση</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 transition hover:border-primary/30 hover:bg-primary/[0.04]"
              >
                <span className="material-symbols-outlined text-[18px] text-primary/80">{preset.icon}</span>
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {SECTIONS.map((section) => {
            const tone = TONE[section.tone] || TONE.cyan;
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  setActiveSection(section.id);
                  document.getElementById(`telematics-section-${section.id}`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold transition ${
                  active ? `${tone.chip} shadow-sm` : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{section.icon}</span>
                {section.title}
              </button>
            );
          })}
        </div>

        {SECTIONS.map((section) => {
          const tone = TONE[section.tone] || TONE.cyan;
          return (
            <div
              key={section.id}
              id={`telematics-section-${section.id}`}
              className={`rounded-[22px] border bg-gradient-to-b ${tone.card} to-white p-5 space-y-4 scroll-mt-24`}
            >
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}>
                  <span className="material-symbols-outlined text-[22px]">{section.icon}</span>
                </span>
                <div>
                  <h4 className="font-bold text-slate-900">{section.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{section.blurb}</p>
                </div>
              </div>
              <div
                className={`grid grid-cols-1 gap-3 ${
                  section.fields.every((f) => f.type === 'checkbox') ? '' : 'md:grid-cols-2'
                }`}
              >
                {section.fields.map((field) => (
                  <div
                    key={field.key}
                    className={field.type === 'checkbox' ? 'md:col-span-2' : undefined}
                  >
                    <FieldControl field={field} value={form[field.key]} onChange={onChange} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div
          className={`sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-[22px] border px-4 py-3 shadow-lg backdrop-blur ${
            dirty
              ? 'border-primary/25 bg-white/95'
              : 'border-slate-200/80 bg-white/90'
          }`}
        >
          <button
            type="submit"
            disabled={saving || !dirty}
            className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-sm disabled:opacity-50 hover:opacity-90 shadow-sm"
          >
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση ρυθμίσεων'}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50"
          >
            Επαναφορά προεπιλογών
          </button>
          <button
            type="button"
            onClick={load}
            className="px-4 py-2.5 rounded-full text-primary font-bold text-sm hover:bg-primary/[0.06]"
          >
            Ανανέωση
          </button>
          {dirty && (
            <span className="ml-auto text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
              Μη αποθηκευμένες αλλαγές{changedCount ? ` · ${changedCount}` : ''}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
