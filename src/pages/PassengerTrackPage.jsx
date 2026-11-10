import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useParams, useSearchParams } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { fetchTripTrack } from '../services/passengerTrackApi.js';
import { useLiveEta } from '../hooks/useLiveEta.js';
import { LIVE_REFRESH_MS, LIVE_REFRESH_SEC } from '../lib/liveRefresh.js';

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001';

const busIcon = (heading) =>
  L.divIcon({
    className: 'passenger-track-bus',
    html: `<div style="transform:rotate(${heading ?? 0}deg);background:#0040df;color:#fff;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #facc15;font-size:20px">🚌</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lng == null) return;
    map.setView([lat, lng], Math.max(map.getZoom(), 13), { animate: true });
  }, [lat, lng, map]);
  return null;
}

export default function PassengerTrackPage() {
  const { tripId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || undefined;
  const tenantId = searchParams.get('tenant_id') || DEMO_TENANT;
  const numericTripId = Number(tripId);

  const [track, setTrack] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const { displayText, eta, loading: etaLoading } = useLiveEta(numericTripId, {
    tenantId,
    enabled: Number.isFinite(numericTripId),
    syncIntervalSec: LIVE_REFRESH_SEC,
  });

  const refresh = useCallback(async () => {
    if (!Number.isFinite(numericTripId)) return;
    try {
      const data = await fetchTripTrack(numericTripId, { tenantId, token });
      setTrack(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Δεν είναι διαθέσιμη η παρακολούθηση');
    } finally {
      setLoading(false);
    }
  }, [numericTripId, tenantId, token]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const lat = track?.vehicle_lat ?? eta?.vehicle_lat;
  const lng = track?.vehicle_lng ?? eta?.vehicle_lng;
  const mapCenter = useMemo(() => {
    if (lat != null && lng != null) return [lat, lng];
    return [38.5, 23.5];
  }, [lat, lng]);

  return (
    <div className="passenger-track-app bg-slate-950 text-white">
      <header
        className="border-b border-slate-800 px-4 py-3 shrink-0"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      >
        <p className="text-xs uppercase tracking-widest text-slate-500">Ζωντανή παρακολούθηση</p>
        <h1 className="text-xl font-bold">Δρομολόγιο #{tripId}</h1>
        <p className="text-sm text-slate-400 mt-1">
          {track?.bus_plate || '—'}
          {track?.driver_name ? ` · ${track.driver_name}` : ''}
        </p>
      </header>

      <div className="passenger-track-map">
        <MapContainer center={mapCenter} zoom={12} className="absolute inset-0 z-0 h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {lat != null && lng != null ? (
            <>
              <MapRecenter lat={lat} lng={lng} />
              <Marker position={[lat, lng]} icon={busIcon(track?.heading_deg)}>
                <Popup>
                  <strong>{track?.bus_plate || 'Λεωφορείο'}</strong>
                  <br />
                  {track?.online ? 'Online' : 'Τελευταία γνωστή θέση'}
                  {track?.speed_kmh != null ? (
                    <>
                      <br />
                      {Math.round(track.speed_kmh)} km/h
                    </>
                  ) : null}
                </Popup>
              </Marker>
            </>
          ) : null}
        </MapContainer>
      </div>

      <section className="passenger-track-footer space-y-3 border-t border-slate-800 bg-slate-900/90 shrink-0">
        {loading || etaLoading ? (
          <p className="text-slate-400 text-sm">Φόρτωση θέσης…</p>
        ) : null}
        {error ? <p className="text-rose-400 text-sm">{error}</p> : null}
        <div className="rounded-2xl bg-slate-800/80 p-4">
          <p className="text-xs uppercase text-slate-500 font-bold">Επόμενη στάση</p>
          <p className="text-lg font-semibold">{track?.next_stop_name || eta?.next_stop_name || '—'}</p>
          <p className="text-2xl font-black text-[#facc15] mt-2">
            {displayText || track?.eta_display || eta?.eta_display || '—'}
          </p>
          <p className="text-sm text-slate-400 mt-1">{track?.traffic_label || eta?.traffic_label || ''}</p>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Η θέση ανανεώνεται κάθε ~30 δευτ. Δεν απαιτείται λογαριασμός διαχειριστή.
        </p>
      </section>
    </div>
  );
}
