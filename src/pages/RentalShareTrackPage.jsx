/**
 * Public rental trip share / live pin map.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useParams, useSearchParams } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { fetchRentalShare } from '../services/customerRentalApi.js';

const carIcon = L.divIcon({
  className: 'rental-share-pin',
  html: `<div style="background:#b91c1c;color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fef2f2;font-size:18px">🚗</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function MapRecenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lng == null) return;
    map.setView([lat, lng], Math.max(map.getZoom(), 13), { animate: true });
  }, [lat, lng, map]);
  return null;
}

export default function RentalShareTrackPage() {
  const { bookingId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [track, setTrack] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) {
      setError('Λείπει το token κοινοποίησης');
      setLoading(false);
      return;
    }
    try {
      const data = await fetchRentalShare(token);
      setTrack(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Δεν είναι διαθέσιμη η παρακολούθηση');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 20000);
    return () => clearInterval(id);
  }, [refresh]);

  const loc = track?.last_known_location || track?.last_share_location || track?.last_sos;
  const lat = loc?.lat;
  const lng = loc?.lng;
  const mapCenter = useMemo(() => {
    if (lat != null && lng != null) return [lat, lng];
    return [38.5, 23.5];
  }, [lat, lng]);

  return (
    <div className="passenger-track-app rental-share-track bg-slate-950 text-white">
      <header
        className="border-b border-slate-800 px-4 py-3 shrink-0"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      >
        <p className="text-xs uppercase tracking-widest text-slate-500">Κοινοποίηση ενοικίασης</p>
        <h1 className="text-xl font-bold">
          {track?.vehicle_model || 'Όχημα'}
          {track?.vehicle_plate ? ` · ${track.vehicle_plate}` : ''}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {track?.client_name || '—'}
          {track?.rental_status ? ` · ${track.rental_status}` : ''}
          {bookingId ? ` · ${bookingId.slice(0, 8)}…` : ''}
        </p>
      </header>

      <div className="passenger-track-map">
        {loading && !track ? (
          <p className="p-4 text-slate-400">Φόρτωση…</p>
        ) : error ? (
          <p className="p-4 text-rose-300">{error}</p>
        ) : (
          <MapContainer center={mapCenter} zoom={12} className="absolute inset-0 z-0 h-full w-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {lat != null && lng != null ? (
              <>
                <MapRecenter lat={lat} lng={lng} />
                <Marker position={[lat, lng]} icon={carIcon}>
                  <Popup>
                    <strong>{track?.vehicle_plate || 'Όχημα'}</strong>
                    <br />
                    Τελευταία γνωστή θέση
                    {loc?.at ? (
                      <>
                        <br />
                        {new Date(loc.at).toLocaleString('el-GR')}
                      </>
                    ) : null}
                  </Popup>
                </Marker>
              </>
            ) : (
              <div className="absolute inset-x-0 top-4 z-[500] flex justify-center pointer-events-none">
                <p className="bg-slate-900/90 text-slate-200 text-sm px-3 py-2 rounded-lg">
                  Δεν υπάρχει ακόμα καταγεγραμμένη θέση
                </p>
              </div>
            )}
          </MapContainer>
        )}
      </div>

      <footer className="border-t border-slate-800 px-4 py-3 text-sm text-slate-400 shrink-0">
        {track?.pickup_location ? (
          <p>
            Παραλαβή: {track.pickup_location}
            {track.dropoff_location && track.dropoff_location !== track.pickup_location
              ? ` → ${track.dropoff_location}`
              : ''}
          </p>
        ) : (
          <p>Ζωντανή θέση ενοικιαζόμενου οχήματος</p>
        )}
      </footer>
    </div>
  );
}
