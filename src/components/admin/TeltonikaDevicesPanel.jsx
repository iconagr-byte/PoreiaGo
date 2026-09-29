import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TelemetrySettingsPanel from './TelemetrySettingsPanel.jsx';
import { LEAFLET_BASEMAP } from '../../lib/maps/appleMapTheme.js';
import {
  createTeltonikaDevice,
  deleteTeltonikaDevice,
  fetchLiveFleet,
  fetchTeltonikaDevices,
  fetchTeltonikaStatus,
  testPingTeltonikaDevice,
} from '../../services/telemetryApi.js';

const DEFAULT_CENTER = [37.98381, 23.727539];

function formatSeen(iso) {
  if (!iso) return 'Ποτέ';
  try {
    return new Date(iso).toLocaleString('el-GR');
  } catch {
    return iso;
  }
}

function deviceStatus(d, liveCodes) {
  const onMap = liveCodes.has(String(d.vehicle_code || '').trim().toUpperCase());
  if (onMap) return { key: 'ON_MAP', label: 'Στον χάρτη', tone: 'bg-emerald-100 text-emerald-800' };
  if (d.last_lat != null && d.last_lng != null) {
    return { key: 'HAS_FIX', label: 'Έχει συντεταγμένες', tone: 'bg-sky-100 text-sky-800' };
  }
  if (d.last_seen_at) {
    return { key: 'SEEN', label: 'Σύνδεση χωρίς GPS', tone: 'bg-amber-100 text-amber-900' };
  }
  return { key: 'WAITING', label: 'Αναμονή δεδομένων', tone: 'bg-slate-100 text-slate-600' };
}

function pinIcon(online) {
  const color = online ? '#059669' : '#64748b';
  const html = `<div style="width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.35)"></div>`;
  return L.divIcon({
    className: 'teltonika-test-pin',
    html,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

function FitPins({ pins }) {
  const map = useMap();
  useEffect(() => {
    if (!pins.length) {
      map.setView(DEFAULT_CENTER, 6);
      return;
    }
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 13);
      return;
    }
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds.pad(0.35), { maxZoom: 14, animate: true });
  }, [pins, map]);
  return null;
}

function openLiveMapTab() {
  window.dispatchEvent(
    new CustomEvent('poreiago-open-admin-tab', { detail: { tab: 'fleet_live_map' } }),
  );
}

export default function TeltonikaDevicesPanel() {
  const [status, setStatus] = useState(null);
  const [devices, setDevices] = useState([]);
  const [liveFleet, setLiveFleet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [testCoords, setTestCoords] = useState({ lat: '', lng: '' });
  const [form, setForm] = useState({
    imei: '',
    vehicle_code: '',
    label: '',
    enabled: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, rows, fleet] = await Promise.all([
        fetchTeltonikaStatus(),
        fetchTeltonikaDevices(),
        fetchLiveFleet().catch(() => []),
      ]);
      setStatus(st);
      const list = Array.isArray(rows) ? rows : [];
      setDevices(list);
      setLiveFleet(Array.isArray(fleet) ? fleet : []);
      setSelectedId((prev) => {
        if (prev && list.some((d) => d.id === prev)) return prev;
        return list[0]?.id || '';
      });
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης Teltonika');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const liveCodes = useMemo(() => {
    const set = new Set();
    for (const v of liveFleet) {
      const code = String(v.vehicle_code || v.bus_plate || '').trim().toUpperCase();
      if (code) set.add(code);
    }
    return set;
  }, [liveFleet]);

  const mapPins = useMemo(() => {
    const pins = [];
    for (const d of devices) {
      let lat = d.last_lat != null ? Number(d.last_lat) : null;
      let lng = d.last_lng != null ? Number(d.last_lng) : null;
      const code = String(d.vehicle_code || '').trim().toUpperCase();
      const live = liveFleet.find(
        (v) => String(v.vehicle_code || v.bus_plate || '').trim().toUpperCase() === code,
      );
      if (live?.lat != null && live?.lng != null) {
        lat = Number(live.lat);
        lng = Number(live.lng);
      }
      if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) continue;
      pins.push({
        id: d.id,
        lat,
        lng,
        label: d.label || d.vehicle_code,
        plate: d.vehicle_code,
        imei: d.imei,
        online: Boolean(live),
        speed: live?.speed_kmh ?? d.last_speed_kmh,
        seen: d.last_seen_at,
      });
    }
    return pins;
  }, [devices, liveFleet]);

  const selected = devices.find((d) => d.id === selectedId) || null;

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

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Δεν υποστηρίζεται geolocation');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setTestCoords({
          lat: String(pos.coords.latitude.toFixed(6)),
          lng: String(pos.coords.longitude.toFixed(6)),
        });
        toast.success('Συντεταγμένες από τη θέση σου');
      },
      () => toast.error('Αποτυχία ανάγνωσης θέσης'),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const onTestPing = async (deviceId) => {
    if (!deviceId) {
      toast.error('Διάλεξε συσκευή');
      return;
    }
    setTestingId(deviceId);
    try {
      const body = {};
      const latN = Number(testCoords.lat);
      const lngN = Number(testCoords.lng);
      if (Number.isFinite(latN) && Number.isFinite(lngN) && testCoords.lat !== '' && testCoords.lng !== '') {
        body.latitude = latN;
        body.longitude = lngN;
      }
      const res = await testPingTeltonikaDevice(deviceId, body);
      toast.success(
        `Pin στον χάρτη: ${res.device?.vehicle_code || 'OK'} · ${Number(res.latitude).toFixed(5)}, ${Number(res.longitude).toFixed(5)}`,
      );
      await load();
      openLiveMapTab();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία test pin');
    } finally {
      setTestingId(null);
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
            Port = {status?.port || 5027} (TCP Codec 8 / 8E).
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
            <span className="rounded-full bg-white/10 px-3 py-1.5">
              Live pins: {mapPins.length}/{devices.length}
            </span>
          </div>
          {status?.last_error ? (
            <p className="mt-3 text-xs text-amber-200/90">Σφάλμα: {status.last_error}</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg text-slate-900">Χάρτης συσκευών GPS</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pins από last fix / live στόλο. Άδειο = ακόμα δεν ήρθε θέση από το tracker.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Ανανέωση
          </button>
        </div>
        <div className="relative h-[18rem] sm:h-[22rem] bg-slate-100">
          {mapPins.length === 0 ? (
            <div className="absolute inset-0 z-[2] flex items-center justify-center pointer-events-none">
              <div className="rounded-2xl bg-white/90 border border-slate-200 px-4 py-3 text-sm text-slate-600 shadow-sm max-w-sm text-center">
                Δεν υπάρχουν pins ακόμα. Χρησιμοποίησε το <strong>Μενού τεστ</strong> για δοκιμαστικό
                pin, ή περίμενε AVL από το FTC961.
              </div>
            </div>
          ) : null}
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={6}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution={LEAFLET_BASEMAP.attribution}
              url={LEAFLET_BASEMAP.url}
              subdomains={LEAFLET_BASEMAP.subdomains}
              maxZoom={LEAFLET_BASEMAP.maxZoom}
            />
            <FitPins pins={mapPins} />
            {mapPins.map((pin) => (
              <Marker
                key={pin.id}
                position={[pin.lat, pin.lng]}
                icon={pinIcon(pin.online)}
              >
                <Popup>
                  <div className="text-sm min-w-[10rem]">
                    <p className="font-bold text-slate-900">{pin.label}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{pin.plate}</p>
                    <p className="text-[11px] font-mono text-slate-500 mt-1">IMEI {pin.imei}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
                      {pin.speed != null ? ` · ${Number(pin.speed).toFixed(0)} km/h` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Last seen: {formatSeen(pin.seen)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-lg text-slate-900">Μενού τεστ GPS</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Έλεγχος ότι βλέπεις τις συσκευές — δοκιμαστικό pin στον χάρτη πάνω και στον Ζωντανό
            χάρτη.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="font-bold text-slate-700">Συσκευή</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10"
            >
              {devices.length === 0 ? <option value="">— καμία συσκευή —</option> : null}
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label || d.vehicle_code} · {d.vehicle_code}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-bold text-slate-700">Lat (προαιρετικό)</span>
            <input
              value={testCoords.lat}
              onChange={(e) => setTestCoords((c) => ({ ...c, lat: e.target.value }))}
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10"
              placeholder="π.χ. 36.434"
              inputMode="decimal"
            />
          </label>
          <label className="block text-sm">
            <span className="font-bold text-slate-700">Lng (προαιρετικό)</span>
            <input
              value={testCoords.lng}
              onChange={(e) => setTestCoords((c) => ({ ...c, lng: e.target.value }))}
              className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10"
              placeholder="π.χ. 28.217"
              inputMode="decimal"
            />
          </label>
        </div>
        <p className="text-[11px] text-slate-500">
          Άδειο Lat/Lng → χρησιμοποιεί last fix της συσκευής, αλλιώς δοκιμαστικό σημείο Αθήνας. Βάλε
          πραγματικές συντεταγμένες ή «Η θέση μου» για σωστό pin.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">near_me</span>
            Η θέση μου
          </button>
          <button
            type="button"
            onClick={() => onTestPing(selectedId)}
            disabled={!selectedId || testingId === selectedId}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">my_location</span>
            {testingId === selectedId ? 'Test…' : 'Δοκιμαστικό pin'}
          </button>
          <button
            type="button"
            onClick={openLiveMapTab}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">map</span>
            Ζωντανός χάρτης
          </button>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            Έλεγχος
          </button>
        </div>

        {selected ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-600 space-y-1">
            <div>
              Κατάσταση:{' '}
              <span
                className={`inline-flex rounded-full px-2 py-0.5 font-bold ${deviceStatus(selected, liveCodes).tone}`}
              >
                {deviceStatus(selected, liveCodes).label}
              </span>
            </div>
            <div className="font-mono">IMEI {selected.imei}</div>
            <div>
              Last seen: {formatSeen(selected.last_seen_at)}
              {selected.last_lat != null
                ? ` · ${Number(selected.last_lat).toFixed(5)}, ${Number(selected.last_lng).toFixed(5)}`
                : ' · χωρίς συντεταγμένες'}
              {` · ${selected.points_accepted || 0} points`}
            </div>
          </div>
        ) : null}

        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100 overflow-hidden">
          {devices.map((d) => {
            const st = deviceStatus(d, liveCodes);
            return (
              <li
                key={d.id}
                className={`px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm ${
                  d.id === selectedId ? 'bg-sky-50/60' : 'bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  className="text-left min-w-0 flex-1"
                >
                  <div className="font-bold text-slate-900">
                    {d.label || d.vehicle_code}{' '}
                    <span className="text-xs font-semibold text-slate-500">· {d.vehicle_code}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 font-mono">IMEI {d.imei}</div>
                </button>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${st.tone}`}>
                  {st.label}
                </span>
                <button
                  type="button"
                  disabled={testingId === d.id}
                  onClick={() => onTestPing(d.id)}
                  className="text-xs font-bold text-slate-800 hover:underline disabled:opacity-50"
                >
                  Test pin
                </button>
              </li>
            );
          })}
          {!loading && devices.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate-500">
              Πρόσθεσε πρώτα IMEI παρακάτω.
            </li>
          ) : null}
        </ul>
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
