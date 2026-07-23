import { Polyline } from 'react-leaflet';
import { APPLE_MAP_COLORS } from '../../lib/maps/appleMapTheme.js';

/** Live GPS trail for each active bus/van — Leaflet. */
export default function FleetLiveTrailsLeaflet({ trails = [], visible = true }) {
  if (!visible || !trails.length) return null;

  return (
    <>
      {trails.map((trail) => {
        const positions = (trail.points || [])
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          .map((p) => [p.lat, p.lng]);
        if (positions.length < 2) return null;
        return (
          <Polyline
            key={`trail-${trail.id}`}
            positions={positions}
            pathOptions={{
              color: APPLE_MAP_COLORS.accent,
              weight: 4,
              opacity: 0.72,
              lineCap: 'round',
              lineJoin: 'round',
            }}
            className="fleet-live-trail"
          />
        );
      })}
    </>
  );
}
