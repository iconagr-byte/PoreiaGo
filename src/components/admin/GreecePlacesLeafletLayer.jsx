import { useEffect, useMemo, useState } from 'react';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { placesVisibleAtZoom } from '../../lib/maps/greecePlaces.js';

function placeClass(kind) {
  if (kind === 'region') return 'fleet-place-label is-region';
  if (kind === 'municipality') return 'fleet-place-label is-muni';
  return 'fleet-place-label is-city';
}

function placeIcon(place) {
  const cls = placeClass(place.kind);
  return L.divIcon({
    className: 'fleet-place-marker',
    html: `<span class="${cls}">${place.name}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/** Ελληνικές πόλεις, δήμοι & περιφέρειες — χωρίς επικαλύψεις (collision + zoom bands). */
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
      zIndexOffset={p.kind === 'region' ? -200 : p.kind === 'municipality' ? -80 : -100}
    />
  ));
}
