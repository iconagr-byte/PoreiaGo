import { useEffect, useMemo, useState } from 'react';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { placesVisibleAtZoom } from '../../lib/maps/greecePlaces.js';

function placeIcon(place) {
  const isRegion = place.kind === 'region';
  const cls = isRegion ? 'fleet-place-label is-region' : 'fleet-place-label is-city';
  return L.divIcon({
    className: 'fleet-place-marker',
    html: `<span class="${cls}">${place.name}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/** Ελληνικές πόλεις & περιφέρειες — πάντα ευανάγνωστες ετικέτες. */
export default function GreecePlacesLeafletLayer({ visible = true }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  useEffect(() => {
    setZoom(map.getZoom());
  }, [map]);

  const places = useMemo(() => (visible ? placesVisibleAtZoom(zoom) : []), [visible, zoom]);

  if (!visible) return null;

  return places.map((p) => (
    <Marker
      key={p.id}
      position={[p.lat, p.lng]}
      icon={placeIcon(p)}
      interactive={false}
      keyboard={false}
      zIndexOffset={p.kind === 'region' ? -200 : -100}
    />
  ));
}
