import { CircleMarker } from 'react-leaflet';

/** Heatmap κελιών από trip_coordinates — Leaflet CircleMarker. */
export default function FleetHeatmapLayer({ points = [], visible = true }) {
  if (!visible || !points.length) return null;
  const maxWeight = Math.max(...points.map((p) => p.weight), 1);

  return points.map((p, i) => (
    <CircleMarker
      key={`heat-${p.lat}-${p.lng}-${i}`}
      center={[p.lat, p.lng]}
      radius={6 + (p.weight / maxWeight) * 22}
      pathOptions={{
        color: '#ea580c',
        fillColor: '#ef4444',
        fillOpacity: 0.2 + (p.weight / maxWeight) * 0.5,
        weight: 1,
      }}
    />
  ));
}
