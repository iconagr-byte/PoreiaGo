import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchTelemetrySettings,
  updateTelemetrySettings,
  DEFAULT_TELEMETRY_SETTINGS,
} from '../../services/telemetryApi.js';

const SECTIONS = [
  {
    title: 'Geofencing & Διαδρομή',
    icon: 'route',
    fields: [
      { key: 'corridor_buffer_m', label: 'Buffer διαδρομής (m)', hint: '50–100m συνιστάται για λεωφορεία', min: 30, max: 200 },
      { key: 'geofence_radius_m', label: 'Ακτίνα στάσης (m)', hint: 'Άφιξη σε σημείο ενδιαφέροντος', min: 30, max: 200 },
      { key: 'corridor_min_speed_kmh', label: 'Ελάχ. ταχύτητα ελέγχου (km/h)', hint: 'Κάτω από αυτή δεν ελέγχεται corridor', min: 0, max: 40, step: 1 },
      { key: 'corridor_debounce_points', label: 'Debouncing (σημεία GPS)', hint: 'Λιγότερα ψευδή alerts', min: 1, max: 10, step: 1 },
    ],
  },
  {
    title: 'Οδηγική συμπεριφορά',
    icon: 'health_and_safety',
    fields: [
      { key: 'gforce_spike_threshold_g', label: 'G-force threshold', hint: 'Μόνο αν δεν υπάρχει tracker event', min: 0.1, max: 2, step: 0.05 },
      { key: 'prefer_tracker_events', label: 'Προτεραιότητα Teltonika events', type: 'checkbox', hint: 'Event 101/102/103 αντί υπολογισμού G' },
    ],
  },
  {
    title: 'Ρελαντί & Καύσιμα',
    icon: 'local_gas_station',
    fields: [
      { key: 'idle_alert_seconds', label: 'Alert ρελαντί (δευτ.)', min: 60, max: 3600, step: 60 },
      { key: 'idle_fuel_liters_per_hour', label: 'Καύσιμο ρελαντί (L/h)', min: 0.5, max: 10, step: 0.1 },
      { key: 'fuel_price_eur_per_liter', label: 'Τιμή καυσίμου (€/L)', min: 0.5, max: 5, step: 0.01 },
    ],
  },
  {
    title: 'ETA & Επιβάτες',
    icon: 'schedule',
    fields: [
      { key: 'eta_refresh_seconds', label: 'Ανανέωση traffic API (δευτ.)', min: 60, max: 900, step: 30 },
      { key: 'eta_ws_push_seconds', label: 'WebSocket push ETA (δευτ.)', min: 10, max: 120, step: 5 },
    ],
  },
];

export default function TelemetrySettingsPanel() {
  const [form, setForm] = useState(DEFAULT_TELEMETRY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

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

  const onSave = async (e) => {
    e.preventDefault();
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

  if (loading) {
    return (
      <section className="bg-white rounded-[28px] border p-8 text-center text-gray-400">
        Φόρτωση ρυθμίσεων…
      </section>
    );
  }

  return (
    <section className="bg-white rounded-[28px] border border-black/[0.06] shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-primary/5 to-white">
        <div>
          <h3 className="font-bold text-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">tune</span>
            Ρυθμίσεις Telematics (PoreiaGo)
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Geofence · G-force · ETA · ρελαντί — ισχύουν άμεσα στο fleet pipeline
          </p>
        </div>
        {form.google_maps_configured ? (
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Google Maps ενεργό
          </span>
        ) : (
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            Mock ETA (χωρίς GOOGLE_MAPS_API_KEY)
          </span>
        )}
      </div>

      <form onSubmit={onSave} className="p-6 space-y-8">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-gray-400">{section.icon}</span>
              {section.title}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.fields.map((field) => (
                <label
                  key={field.key}
                  className={`block ${field.type === 'checkbox' ? 'md:col-span-2' : ''}`}
                >
                  <span className="text-sm font-bold text-gray-700">{field.label}</span>
                  {field.type === 'checkbox' ? (
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(form[field.key])}
                        onChange={(e) => onChange(field.key, e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-primary"
                      />
                      <span className="text-xs text-gray-500">{field.hint}</span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="number"
                        min={field.min}
                        max={field.max}
                        step={field.step ?? 1}
                        value={form[field.key] ?? ''}
                        onChange={(e) =>
                          onChange(
                            field.key,
                            field.step && field.step < 1
                              ? parseFloat(e.target.value)
                              : parseInt(e.target.value, 10),
                          )
                        }
                        className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                      />
                      {field.hint && (
                        <span className="text-xs text-gray-400 mt-1 block">{field.hint}</span>
                      )}
                    </>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={saving || !dirty}
            className="px-6 py-2.5 rounded-full bg-primary text-white font-bold text-sm disabled:opacity-50 hover:opacity-90"
          >
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση ρυθμίσεων'}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="px-6 py-2.5 rounded-full border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50"
          >
            Επαναφορά προεπιλογών
          </button>
          <button
            type="button"
            onClick={load}
            className="px-6 py-2.5 rounded-full text-primary font-bold text-sm hover:underline"
          >
            Ανανέωση
          </button>
        </div>
      </form>
    </section>
  );
}
