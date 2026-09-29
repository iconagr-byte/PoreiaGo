import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TelemetrySettingsPanel from './TelemetrySettingsPanel.jsx';
import { LEAFLET_BASEMAP } from '../../lib/maps/appleMapTheme.js';
import {
  DEFAULT_FLEET_BUS_IMAGE,
  resolveFleetMarkerImage,
} from '../../lib/admin/fleetVehicleDetails.js';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import { fetchFleetVehicles } from '../../services/platformApi.js';
import {
  createTeltonikaDevice,
  deleteTeltonikaDevice,
  fetchLiveFleet,
  fetchTeltonikaDevices,
  fetchTeltonikaStatus,
  testPingTeltonikaDevice,
} from '../../services/telemetryApi.js';
import '../../styles/fleet-live-map.css';

const DEFAULT_CENTER = [37.98381, 23.727539];
const TRAVEL_PIN_CACHE = new Map();

function formatSeen(iso) {
  if (!iso) return 'Ποτέ';
  try {
    return new Date(iso).toLocaleString('el-GR');
  } catch {
    return iso;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePlate(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
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

function resolvePinThumb(pin) {
  const raw = resolveSiteAssetUrl(pin.imageUrl || DEFAULT_FLEET_BUS_IMAGE) || DEFAULT_FLEET_BUS_IMAGE;
  // Never use the multi-MB hero as a marker — it paints a giant empty box on the map.
  if (!raw || /hero-bus/i.test(raw)) return DEFAULT_FLEET_BUS_IMAGE;
  return raw;
}

function travelPinIcon(pin) {
  const img = resolvePinThumb(pin);
  const title = escapeHtml(pin.label || pin.plate || 'GPS');
  const plate = escapeHtml(pin.plate || '—');
  const speed =
    pin.speed != null && Number.isFinite(Number(pin.speed))
      ? `${Math.round(Number(pin.speed))} km/h`
      : '— km/h';
  const badgeLabel = pin.online ? 'Live GPS' : 'Δοκιμή';
  const badgeBg = pin.online ? '#ecfdf5' : '#f1f5f9';
  const badgeFg = pin.online ? '#047857' : '#475569';
  const imeiTail = escapeHtml(String(pin.imei || '').slice(-6) || '—');
  const cacheKey = `v2|${pin.id}|${img}|${title}|${plate}|${speed}|${badgeLabel}`;
  const cached = TRAVEL_PIN_CACHE.get(cacheKey);
  if (cached) return cached;

  // Inline styles only — external CSS must not be required (otherwise a large
  // unconstrained <img> becomes the empty blue/grey rectangle on the map).
  const html = `<div style="width:210px;display:flex;flex-direction:column;align-items:center;font-family:Avenir Next,Segoe UI,Helvetica Neue,sans-serif;line-height:1.2;pointer-events:none;">
  <div style="display:flex;width:100%;background:#fff;border:1px solid rgba(15,23,42,.12);border-radius:16px;overflow:hidden;box-shadow:0 10px 28px rgba(15,23,42,.22);">
    <div style="width:64px;height:64px;flex:0 0 64px;background:#0f172a;overflow:hidden;">
      <img src="${escapeHtml(img)}" alt="" width="64" height="64" decoding="async" style="width:64px;height:64px;object-fit:cover;display:block;" />
    </div>
    <div style="flex:1;min-width:0;padding:7px 9px;background:#fff;">
      <div style="font-size:12px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</div>
      <div style="margin-top:2px;font-size:11px;font-weight:800;letter-spacing:.04em;color:#0e7490;text-transform:uppercase;">${plate}</div>
      <div style="margin-top:2px;font-size:10px;font-weight:600;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(speed)} · …${imeiTail}</div>
      <span style="display:inline-block;margin-top:4px;padding:2px 7px;border-radius:999px;font-size:9px;font-weight:700;background:${badgeBg};color:${badgeFg};">${badgeLabel}</span>
    </div>
  </div>
  <div style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:10px solid #fff;filter:drop-shadow(0 2px 1px rgba(15,23,42,.12));"></div>
</div>`;

  const icon = L.divIcon({
    className: 'teltonika-travel-pin',
    html,
    iconSize: [210, 86],
    iconAnchor: [105, 86],
    popupAnchor: [0, -78],
  });
  TRAVEL_PIN_CACHE.set(cacheKey, icon);
  if (TRAVEL_PIN_CACHE.size > 40) {
    const first = TRAVEL_PIN_CACHE.keys().next().value;
    TRAVEL_PIN_CACHE.delete(first);
  }
  return icon;
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
  const [fleetVehicles, setFleetVehicles] = useState([]);
  /** Pins shown only after explicit test (Δοκιμαστικό pin / Η θέση μου). */
  const [testPins, setTestPins] = useState([]);
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
      const [st, rows, fleet, vehicles] = await Promise.all([
        fetchTeltonikaStatus(),
        fetchTeltonikaDevices(),
        // Never surface live-fleet 502 toasts on this settings page.
        fetchLiveFleet().catch(() => []),
        fetchFleetVehicles().catch(() => []),
      ]);
      setStatus(st);
      const list = Array.isArray(rows) ? rows : [];
      setDevices(list);
      setLiveFleet(Array.isArray(fleet) ? fleet : []);
      setFleetVehicles(Array.isArray(vehicles) ? vehicles : []);
      setSelectedId((prev) => {
        if (prev && list.some((d) => d.id === prev)) return prev;
        return list[0]?.id || '';
      });
    } catch (err) {
      const raw = String(err?.message || '');
      const status = Number(err?.status);
      // Deploy blips (502/503/504) — retry quietly on next interval.
      if (
        status === 502 ||
        status === 503 ||
        status === 504 ||
        /\b(502|503|504)\b/.test(raw) ||
        /bad gateway|gateway time-?out/i.test(raw)
      ) {
        return;
      }
      toast.error(err.message || 'Αποτυχία φόρτωσης Teltonika');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Always start with an empty test map — pins only after explicit test action.
    setTestPins([]);
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

  const fleetByPlate = useMemo(() => {
    const map = new Map();
    for (const v of fleetVehicles) {
      const key = normalizePlate(v.plate_number || v.code || v.vehicle_code);
      if (key) map.set(key, v);
    }
    return map;
  }, [fleetVehicles]);

  const mapPins = testPins;

  const buildTestPin = useCallback(
    (device, lat, lng, { online = true } = {}) => {
      const fleet = fleetByPlate.get(normalizePlate(device.vehicle_code));
      const code = String(device.vehicle_code || '').trim().toUpperCase();
      const live = liveFleet.find(
        (v) => String(v.vehicle_code || v.bus_plate || '').trim().toUpperCase() === code,
      );
      const imageUrl = resolveFleetMarkerImage({
        vehicle_image_url:
          live?.vehicle_image_url ||
          fleet?.public_image_url ||
          (Array.isArray(fleet?.gallery_urls) ? fleet.gallery_urls[0] : null),
        photo_url: live?.photo_url,
      });
      return {
        id: device.id,
        lat: Number(lat),
        lng: Number(lng),
        label: device.label || fleet?.name || device.vehicle_code,
        plate: device.vehicle_code,
        imei: device.imei,
        online,
        speed: live?.speed_kmh ?? device.last_speed_kmh ?? 0,
        seen: device.last_seen_at || new Date().toISOString(),
        imageUrl,
        points: device.points_accepted || 0,
        model: fleet?.model || fleet?.make || '',
      };
    },
    [fleetByPlate, liveFleet],
  );

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

  const onTestPing = async (deviceId, coordsOverride = null) => {
    if (!deviceId) {
      toast.error('Διάλεξε συσκευή');
      return;
    }
    const device = devices.find((d) => d.id === deviceId);
    if (!device) {
      toast.error('Η συσκευή δεν βρέθηκε');
      return;
    }
    setTestingId(deviceId);
    try {
      const body = {};
      const latSrc = coordsOverride?.lat ?? testCoords.lat;
      const lngSrc = coordsOverride?.lng ?? testCoords.lng;
      const latN = Number(latSrc);
      const lngN = Number(lngSrc);
      if (Number.isFinite(latN) && Number.isFinite(lngN) && latSrc !== '' && lngSrc !== '') {
        body.latitude = latN;
        body.longitude = lngN;
      }
      const res = await testPingTeltonikaDevice(deviceId, body);
      const pin = buildTestPin(
        { ...device, ...(res.device || {}), last_seen_at: new Date().toISOString() },
        res.latitude,
        res.longitude,
        { online: true },
      );
      setTestPins((prev) => {
        const rest = prev.filter((p) => p.id !== pin.id);
        return [...rest, pin];
      });
      setSelectedId(deviceId);
      toast.success(
        `Δοκιμαστικό pin: ${res.device?.vehicle_code || device.vehicle_code} · ${Number(res.latitude).toFixed(5)}, ${Number(res.longitude).toFixed(5)}`,
      );
      await load();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία test pin');
    } finally {
      setTestingId(null);
    }
  };

  const useMyLocation = () => {
    if (!selectedId) {
      toast.error('Διάλεξε συσκευή');
      return;
    }
    if (!navigator.geolocation) {
      toast.error('Δεν υποστηρίζεται geolocation');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setTestCoords({ lat: String(lat), lng: String(lng) });
        onTestPing(selectedId, { lat: String(lat), lng: String(lng) });
      },
      () => toast.error('Αποτυχία ανάγνωσης θέσης'),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const clearTestPins = () => {
    setTestPins([]);
    toast.success('Καθαρίστηκαν τα δοκιμαστικά pins');
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
              Test pins: {mapPins.length}
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
              Το pin εμφανίζεται μόνο όταν το ζητήσεις: Δοκιμαστικό pin ή Η θέση μου.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {mapPins.length ? (
              <button
                type="button"
                onClick={clearTestPins}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-[16px]">visibility_off</span>
                Καθαρισμός
              </button>
            ) : null}
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Ανανέωση
            </button>
          </div>
        </div>
        <div className="relative h-[18rem] sm:h-[22rem] bg-slate-100">
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={6}
            className="h-full w-full teltonika-gps-map"
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
                icon={travelPinIcon(pin)}
                eventHandlers={{ click: () => setSelectedId(pin.id) }}
              >
                <Popup autoPan closeButton>
                  <div className="teltonika-travel-popup">
                    <div className="teltonika-travel-popup__photo">
                      <img
                        src={resolveSiteAssetUrl(pin.imageUrl || DEFAULT_FLEET_BUS_IMAGE)}
                        alt={pin.plate || 'bus'}
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_FLEET_BUS_IMAGE;
                        }}
                      />
                    </div>
                    <div>
                      <div className="teltonika-travel-popup__title">{pin.label || 'GPS'}</div>
                      <span className="teltonika-travel-popup__plate">{pin.plate || '—'}</span>
                      <div className="teltonika-travel-popup__meta">
                        {pin.model ? `${pin.model} · ` : ''}
                        {pin.speed != null ? `${Math.round(Number(pin.speed))} km/h` : '— km/h'}
                        {pin.online ? ' · Live' : ''}
                      </div>
                      <div className="teltonika-travel-popup__meta">IMEI {pin.imei || '—'}</div>
                      <div className="teltonika-travel-popup__meta">
                        {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
                      </div>
                      <div className="teltonika-travel-popup__meta">
                        Last seen: {formatSeen(pin.seen)} · {pin.points || 0} points
                      </div>
                    </div>
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
            Μόνο εδώ εμφανίζεται pin δοκιμής — όχι αυτόματα από last fix. Ζωντανός χάρτης ανοίγει
            μόνο αν το πατήσεις.
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
          Άδειο Lat/Lng στο Δοκιμαστικό pin → last fix ή Αθήνα. «Η θέση μου» βάζει αμέσως pin στη
          θέση σου.
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
