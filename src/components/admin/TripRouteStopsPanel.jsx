import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const STOP_KINDS = [
  { id: 'meeting', label: 'Συνάντηση', icon: 'flag' },
  { id: 'stop', label: 'Στάση', icon: 'place' },
  { id: 'break', label: 'Διάλειμμα', icon: 'coffee' },
  { id: 'destination', label: 'Προορισμός', icon: 'sports_score' },
];

const QUICK_PLACES = [
  { name: 'Αθήνα', lat: 37.9838, lng: 23.7275 },
  { name: 'Θεσσαλονίκη', lat: 40.6401, lng: 22.9444 },
  { name: 'Πάτρα', lat: 38.2466, lng: 21.7346 },
  { name: 'Ηράκλειο', lat: 35.3387, lng: 25.1442 },
  { name: 'Ρόδος', lat: 36.4349, lng: 28.2176 },
  { name: 'Ιωάννινα', lat: 39.665, lng: 20.8537 },
  { name: 'Βόλος', lat: 39.3666, lng: 22.9507 },
  { name: 'Καλαμάτα', lat: 37.0389, lng: 22.1142 },
];

const DEFAULT_CENTER = [38.5, 23.0];

function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatKm(km) {
  if (!Number.isFinite(km) || km <= 0) return '—';
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function formatDriveMins(km) {
  if (!Number.isFinite(km) || km <= 0) return '—';
  const mins = Math.round((km / 70) * 60);
  if (mins < 60) return `~${mins}′`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `~${h}ώ ${m}′` : `~${h}ώ`;
}

function kindMeta(kind) {
  return STOP_KINDS.find((k) => k.id === kind) || STOP_KINDS[1];
}

function makeStopMarkerIcon(index, active, kind) {
  const bg = active ? '#0f172a' : kind === 'meeting' ? '#0d9488' : kind === 'destination' ? '#b45309' : kind === 'break' ? '#64748b' : '#334155';
  const html = `<div style="
    width:28px;height:28px;border-radius:999px;background:${bg};color:#fff;
    display:flex;align-items:center;justify-content:center;
    font:700 12px/1 system-ui,sans-serif;border:2px solid #fff;
    box-shadow:0 2px 8px rgba(15,23,42,.28);
  ">${index + 1}</div>`;
  return L.divIcon({
    className: 'trip-stop-marker',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function MapClickHandler({ activeStopId, onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitRoute({ stops, activeStopId }) {
  const map = useMap();
  const key = useMemo(
    () =>
      `${stops.map((s) => `${s.id}:${s.lat}:${s.lng}`).join('|')}|${activeStopId || ''}`,
    [stops, activeStopId],
  );

  useEffect(() => {
    if (!stops.length) {
      map.setView(DEFAULT_CENTER, 6);
      return;
    }
    if (stops.length === 1) {
      map.setView([stops[0].lat, stops[0].lng], 11, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng]));
    map.fitBounds(bounds.pad(0.18), { animate: true, maxZoom: 12 });
  }, [key, map, stops]);

  return null;
}

function PlaceSearch({ onPick, disabled }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    timer.current = window.setTimeout(async () => {
      try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '6');
        url.searchParams.set('countrycodes', 'gr,cy,al,mk,bg,tr');
        url.searchParams.set('accept-language', 'el');
        const res = await fetch(url.toString(), {
          headers: { Accept: 'application/json' },
        });
        const data = await res.json().catch(() => []);
        setHits(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 420);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-slate-900/10 focus-within:border-slate-400">
        <span className="material-symbols-outlined text-[18px] text-slate-400">search</span>
        <input
          type="search"
          value={q}
          disabled={disabled}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          placeholder="Αναζήτηση τόπου (πόλη, λιμάνι, ξενοδοχείο…)"
          className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        {loading ? (
          <span className="material-symbols-outlined text-[18px] text-slate-400 animate-spin">
            progress_activity
          </span>
        ) : null}
      </div>
      {open && hits.length > 0 ? (
        <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          {hits.map((hit) => (
            <li key={`${hit.place_id}`}>
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                onClick={() => {
                  onPick({
                    name: hit.display_name?.split(',')[0] || hit.name || q,
                    lat: Number(hit.lat),
                    lng: Number(hit.lon),
                    label: hit.display_name || '',
                  });
                  setQ('');
                  setHits([]);
                  setOpen(false);
                }}
              >
                <span className="block font-semibold text-slate-900 truncate">
                  {hit.display_name?.split(',')[0] || hit.name}
                </span>
                <span className="block text-[11px] text-slate-500 truncate mt-0.5">
                  {hit.display_name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function emptyStop(partial = {}) {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: '',
    lat: 38.0,
    lng: 23.0,
    time: '12:00',
    image: null,
    description: '',
    kind: 'stop',
    dwellMinutes: 15,
    ...partial,
  };
}

export default function TripRouteStopsPanel({
  formData,
  setFormData,
  activeStopId,
  setActiveStopId,
}) {
  const stops = Array.isArray(formData.stops) ? formData.stops : [];
  const [expandedId, setExpandedId] = useState(null);

  const patchStops = useCallback(
    (next, focusId) => {
      setFormData((prev) => ({ ...prev, stops: next }));
      if (focusId != null) setActiveStopId(focusId);
    },
    [setFormData, setActiveStopId],
  );

  const addStop = (partial = {}) => {
    const stop = emptyStop(partial);
    // Suggest time after last stop (+1h)
    if (!partial.time && stops.length) {
      const last = stops[stops.length - 1]?.time || '12:00';
      const [h, m] = String(last).split(':').map(Number);
      if (Number.isFinite(h)) {
        const nextH = (h + 1) % 24;
        stop.time = `${String(nextH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
      }
    }
    if (stops.length === 0) stop.kind = 'meeting';
    else if (partial.kind == null) stop.kind = 'stop';
    patchStops([...stops, stop], stop.id);
    setExpandedId(stop.id);
  };

  const updateStop = (id, patch) => {
    patchStops(
      stops.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        if ('lat' in patch) next.lat = Number(patch.lat);
        if ('lng' in patch) next.lng = Number(patch.lng);
        if ('dwellMinutes' in patch) {
          const n = Number(patch.dwellMinutes);
          next.dwellMinutes = Number.isFinite(n) ? Math.max(0, Math.min(480, n)) : 0;
        }
        return next;
      }),
      id,
    );
  };

  const removeStop = (id) => {
    const next = stops.filter((s) => s.id !== id);
    patchStops(next, activeStopId === id ? next[0]?.id ?? null : activeStopId);
    if (expandedId === id) setExpandedId(null);
  };

  const moveStop = (id, dir) => {
    const idx = stops.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= stops.length) return;
    const next = [...stops];
    const [row] = next.splice(idx, 1);
    next.splice(j, 0, row);
    patchStops(next, id);
  };

  const duplicateStop = (id) => {
    const src = stops.find((s) => s.id === id);
    if (!src) return;
    const copy = emptyStop({
      ...src,
      id: Date.now(),
      name: src.name ? `${src.name} (αντίγραφο)` : '',
      lat: Number(src.lat) + 0.01,
      lng: Number(src.lng) + 0.01,
    });
    const idx = stops.findIndex((s) => s.id === id);
    const next = [...stops];
    next.splice(idx + 1, 0, copy);
    patchStops(next, copy.id);
    setExpandedId(copy.id);
  };

  const onMapClick = (lat, lng) => {
    if (activeStopId) {
      updateStop(activeStopId, { lat, lng });
      return;
    }
    addStop({ lat, lng, name: '' });
  };

  const clearAll = () => {
    if (!stops.length) return;
    if (!window.confirm('Διαγραφή όλων των στάσεων;')) return;
    patchStops([], null);
    setExpandedId(null);
  };

  const reverseRoute = () => {
    if (stops.length < 2) return;
    const next = [...stops].reverse().map((s, i, arr) => {
      if (i === 0) return { ...s, kind: s.kind === 'destination' ? 'meeting' : s.kind };
      if (i === arr.length - 1) return { ...s, kind: s.kind === 'meeting' ? 'destination' : s.kind };
      return s;
    });
    patchStops(next, activeStopId);
  };

  const routeStats = useMemo(() => {
    let totalKm = 0;
    const legs = [];
    for (let i = 1; i < stops.length; i += 1) {
      const km = haversineKm(stops[i - 1], stops[i]);
      totalKm += km;
      legs.push(km);
    }
    const dwell = stops.reduce((sum, s) => sum + (Number(s.dwellMinutes) || 0), 0);
    return { totalKm, legs, dwell };
  }, [stops]);

  const linePositions = stops.map((s) => [s.lat, s.lng]);

  return (
    <div className="space-y-4">
      <div className="w-full">
        <PlaceSearch
          onPick={(place) => {
            if (activeStopId) {
              updateStop(activeStopId, {
                name: place.name,
                lat: place.lat,
                lng: place.lng,
                description: place.label || '',
              });
              setExpandedId(activeStopId);
            } else {
              addStop({
                name: place.name,
                lat: place.lat,
                lng: place.lng,
                description: place.label || '',
              });
            }
          }}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_PLACES.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() =>
              activeStopId
                ? updateStop(activeStopId, { name: p.name, lat: p.lat, lng: p.lng })
                : addStop({ name: p.name, lat: p.lat, lng: p.lng })
            }
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full border border-slate-200 bg-slate-50 text-[12px] font-semibold text-slate-700 hover:border-slate-400 hover:bg-white transition-colors"
          >
            <span className="material-symbols-outlined text-[14px] text-teal-700">location_on</span>
            {p.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5">
        <div className="flex flex-wrap gap-4 text-[12px] font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-slate-400">pin_drop</span>
            {stops.length} στάσ{stops.length === 1 ? 'η' : 'εις'}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-slate-400">straighten</span>
            {formatKm(routeStats.totalKm)}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
            οδήγηση {formatDriveMins(routeStats.totalKm)}
            {routeStats.dwell ? ` · στάσεις ${routeStats.dwell}′` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {stops.length >= 2 ? (
            <button
              type="button"
              onClick={reverseRoute}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[12px] font-bold text-slate-700 hover:bg-white border border-transparent hover:border-slate-200"
              title="Αντιστροφή σειράς"
            >
              <span className="material-symbols-outlined text-[16px]">swap_vert</span>
              Αντιστροφή
            </button>
          ) : null}
          {stops.length ? (
            <button
              type="button"
              onClick={clearAll}
              className="h-8 px-2.5 rounded-lg text-[12px] font-bold text-rose-700 hover:bg-rose-50"
            >
              Καθαρισμός
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => addStop()}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-slate-900 text-white text-[12px] font-bold hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Νέα στάση
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-4">
        <div className="min-h-[320px]">
          {!stops.length ? (
            <div className="h-full min-h-[280px] rounded-2xl border border-dashed border-slate-300 bg-gradient-to-b from-slate-50 to-white px-6 py-10 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[28px]">route</span>
              </div>
              <p className="text-[15px] font-bold text-slate-900">Ξεκίνα τη διαδρομή</p>
              <p className="text-[13px] text-slate-500 mt-1.5 max-w-sm leading-relaxed">
                Πρόσθεσε στάση, διάλεξε πόλη από τις συντομεύσεις, ή κάνε κλικ στον χάρτη.
              </p>
              <button
                type="button"
                onClick={() => addStop({ kind: 'meeting', name: 'Σημείο συνάντησης' })}
                className="mt-5 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800"
              >
                <span className="material-symbols-outlined text-[18px]">flag</span>
                Πρώτο σημείο συνάντησης
              </button>
            </div>
          ) : (
            <ol className="relative space-y-2 max-h-[440px] overflow-y-auto pr-1">
              <div
                className="absolute left-[18px] top-4 bottom-4 w-px bg-slate-200"
                aria-hidden
              />
              {stops.map((stop, index) => {
                const active = activeStopId === stop.id;
                const expanded = expandedId === stop.id;
                const meta = kindMeta(stop.kind);
                const legKm = index > 0 ? routeStats.legs[index - 1] : null;
                return (
                  <li key={stop.id} className="relative pl-0">
                    {index > 0 ? (
                      <p className="pl-12 pb-1 text-[11px] font-semibold text-slate-400">
                        {formatKm(legKm)} · {formatDriveMins(legKm)}
                      </p>
                    ) : null}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveStopId(stop.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActiveStopId(stop.id);
                        }
                      }}
                      className={`relative rounded-2xl border transition ${
                        active
                          ? 'border-slate-900 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)]'
                          : 'border-slate-200 bg-white/90 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 p-3">
                        <span
                          className={`relative z-[1] mt-0.5 w-9 h-9 rounded-full text-[13px] font-extrabold flex items-center justify-center shrink-0 ${
                            active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 h-7 px-2 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-600">
                              <span className="material-symbols-outlined text-[14px]">{meta.icon}</span>
                              {meta.label}
                            </span>
                            <input
                              type="time"
                              required
                              value={stop.time || ''}
                              onChange={(e) => updateStop(stop.id, { time: e.target.value })}
                              className="h-8 w-[7.25rem] rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <input
                            type="text"
                            required
                            value={stop.name || ''}
                            onChange={(e) => updateStop(stop.id, { name: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
                            placeholder="Όνομα στάσης / τόπου"
                            onClick={(e) => e.stopPropagation()}
                          />
                          {expanded ? (
                            <div
                              className="space-y-2 pt-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex flex-wrap gap-1.5">
                                {STOP_KINDS.map((k) => (
                                  <button
                                    key={k.id}
                                    type="button"
                                    onClick={() => updateStop(stop.id, { kind: k.id })}
                                    className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-bold border transition ${
                                      stop.kind === k.id
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[14px]">{k.icon}</span>
                                    {k.label}
                                  </button>
                                ))}
                              </div>
                              <textarea
                                value={stop.description || ''}
                                onChange={(e) =>
                                  updateStop(stop.id, { description: e.target.value })
                                }
                                rows={2}
                                placeholder="Σημειώσεις (σημείο συνάντησης, οδηγίες…)"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 resize-y min-h-[64px]"
                              />
                              <div className="grid grid-cols-3 gap-2">
                                <label className="block">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Παραμονή (λ)
                                  </span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={480}
                                    value={stop.dwellMinutes ?? 15}
                                    onChange={(e) =>
                                      updateStop(stop.id, { dwellMinutes: e.target.value })
                                    }
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Lat
                                  </span>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    value={Number(stop.lat).toFixed(4)}
                                    onChange={(e) => updateStop(stop.id, { lat: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-mono"
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Lng
                                  </span>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    value={Number(stop.lng).toFixed(4)}
                                    onChange={(e) => updateStop(stop.id, { lng: e.target.value })}
                                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-mono"
                                  />
                                </label>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            title="Πάνω"
                            disabled={index === 0}
                            onClick={() => moveStop(stop.id, -1)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          >
                            <span className="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
                          </button>
                          <button
                            type="button"
                            title="Κάτω"
                            disabled={index === stops.length - 1}
                            onClick={() => moveStop(stop.id, 1)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                          >
                            <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                          </button>
                          <button
                            type="button"
                            title={expanded ? 'Σύμπτυξη' : 'Λεπτομέρειες'}
                            onClick={() =>
                              setExpandedId((cur) => (cur === stop.id ? null : stop.id))
                            }
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {expanded ? 'unfold_less' : 'unfold_more'}
                            </span>
                          </button>
                          <button
                            type="button"
                            title="Αντίγραφο"
                            onClick={() => duplicateStop(stop.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          >
                            <span className="material-symbols-outlined text-[18px]">content_copy</span>
                          </button>
                          <button
                            type="button"
                            title="Διαγραφή"
                            onClick={() => removeStop(stop.id)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="space-y-2">
          <div className="h-[400px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] relative">
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={6}
              className="h-full w-full"
              scrollWheelZoom
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              <MapClickHandler activeStopId={activeStopId} onMapClick={onMapClick} />
              <FitRoute stops={stops} activeStopId={activeStopId} />
              {linePositions.length >= 2 ? (
                <Polyline
                  positions={linePositions}
                  pathOptions={{
                    color: '#0f172a',
                    weight: 3.5,
                    opacity: 0.75,
                    dashArray: '8 10',
                  }}
                />
              ) : null}
              {stops.map((stop, index) => (
                <Marker
                  key={stop.id}
                  position={[stop.lat, stop.lng]}
                  icon={makeStopMarkerIcon(index, activeStopId === stop.id, stop.kind)}
                  eventHandlers={{
                    click: () => {
                      setActiveStopId(stop.id);
                      setExpandedId(stop.id);
                    },
                  }}
                />
              ))}
            </MapContainer>
            <p className="absolute bottom-2 left-2 right-2 pointer-events-none text-[11px] font-semibold text-slate-700 bg-white/85 backdrop-blur rounded-lg px-2.5 py-1.5 border border-white/60">
              {activeStopId
                ? 'Κλικ στον χάρτη → μετακίνηση ενεργής στάσης'
                : 'Κλικ στον χάρτη → νέα στάση στο σημείο'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
