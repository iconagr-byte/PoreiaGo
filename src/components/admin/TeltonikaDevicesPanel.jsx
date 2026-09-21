import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import TelemetrySettingsPanel from './TelemetrySettingsPanel.jsx';
import {
  createTeltonikaDevice,
  deleteTeltonikaDevice,
  fetchTeltonikaDevices,
  fetchTeltonikaStatus,
} from '../../services/telemetryApi.js';

function formatSeen(iso) {
  if (!iso) return 'Ποτέ';
  try {
    return new Date(iso).toLocaleString('el-GR');
  } catch {
    return iso;
  }
}

export default function TeltonikaDevicesPanel() {
  const [status, setStatus] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    imei: '',
    vehicle_code: '',
    label: '',
    enabled: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, rows] = await Promise.all([fetchTeltonikaStatus(), fetchTeltonikaDevices()]);
      setStatus(st);
      setDevices(Array.isArray(rows) ? rows : []);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης Teltonika');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createTeltonikaDevice(form);
      toast.success('Αποθηκεύτηκε το IMEI');
      setForm({ imei: '', vehicle_code: '', label: '', enabled: true });
      await load();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Διαγραφή συσκευής;')) return;
    try {
      await deleteTeltonikaDevice(id);
      toast.success('Διαγράφηκε');
      load();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white shadow-sm">
        <div className="relative p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/80">
            <span className="material-symbols-outlined text-[16px]">sensors</span>
            Teltonika FTC961
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">GPS Tracker (Codec 8)</h2>
          <p className="mt-2 text-sm text-white/70 max-w-2xl leading-relaxed">
            Δέσε το IMEI της συσκευής με πινακίδα/όχημα. Στο Configurator βάλε Server IP = VPS και
            Port = {status?.port || 5027} (TCP Codec 8).
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span
              className={`rounded-full px-3 py-1.5 ${
                status?.listening ? 'bg-emerald-500/20 text-emerald-100' : 'bg-rose-500/20 text-rose-100'
              }`}
            >
              {status?.listening ? 'TCP listening' : 'TCP offline'}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">
              Endpoint: {status?.public_endpoint || '—'}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">
              Συνδέσεις: {status?.active_connections ?? 0}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1.5">
              Packets OK: {status?.packets_ok ?? 0}
            </span>
          </div>
          {status?.last_error ? (
            <p className="mt-3 text-xs text-amber-200/90">Σφάλμα: {status.last_error}</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-lg text-slate-900">Νέο / ενημέρωση IMEI</h3>
        <form onSubmit={onSave} className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-bold text-slate-700">IMEI</span>
            <input
              required
              value={form.imei}
              onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value }))}
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10"
              placeholder="860123456789012"
              inputMode="numeric"
            />
          </label>
          <label className="block text-sm">
            <span className="font-bold text-slate-700">Πινακίδα / vehicle_code</span>
            <input
              required
              value={form.vehicle_code}
              onChange={(e) => setForm((f) => ({ ...f, vehicle_code: e.target.value }))}
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10"
              placeholder="ΧΑΗ-4021"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-bold text-slate-700">Ετικέτα</span>
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10"
              placeholder="FTC961 λεωφορείο 1"
            />
          </label>
          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              Ενεργό (δέχεται σύνδεση)
            </label>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </button>
          </div>
        </form>
        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-950 leading-relaxed">
          <strong>Configurator:</strong> GPRS → Domain/IP = public VPS IP, Port ={' '}
          {status?.port || 5027}, Protocol = TCP, Codec = Codec 8 / Codec 8 Extended. Άνοιξε firewall
          TCP {status?.port || 5027}. Μετά το bind, το pin εμφανίζεται στο Ζωντανό Χάρτη.
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 font-bold text-slate-900">
          Συσκευές γραφείου
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Φόρτωση…</p>
        ) : devices.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Δεν υπάρχουν IMEI ακόμα.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {devices.map((d) => (
              <li key={d.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900">
                    {d.label || d.vehicle_code}{' '}
                    <span className="text-xs font-semibold text-slate-500">· {d.vehicle_code}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono">IMEI {d.imei}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Last seen: {formatSeen(d.last_seen_at)}
                    {d.last_lat != null
                      ? ` · ${Number(d.last_lat).toFixed(5)}, ${Number(d.last_lng).toFixed(5)}`
                      : ''}
                    {` · ${d.points_accepted || 0} points`}
                    {!d.enabled ? ' · ανενεργό' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(d.id)}
                  className="text-xs font-bold text-rose-600 hover:underline"
                >
                  Διαγραφή
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TelemetrySettingsPanel />
    </div>
  );
}
