import { Fragment } from 'react';
import { Polyline, CircleMarker } from 'react-leaflet';
import { APPLE_MAP_COLORS } from '../../lib/maps/appleMapTheme.js';

/**
 * Live GPS trail — dual-layer glow + core, soft head pulse at the live tip.
 */
export default function FleetLiveTrailsLeaflet({ trails = [], visible = true }) {
  if (!visible || !trails.length) return null;

  return (
    <>
      {trails.map((trail) => {
        const positions = (trail.points || [])
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          .map((p) => [p.lat, p.lng]);
        if (positions.length < 2) return null;
        const tip = positions[positions.length - 1];
        return (
          <Fragment key={`trail-${trail.id}`}>
            <Polyline
              positions={positions}
              pathOptions={{
                color: APPLE_MAP_COLORS.accent,
                weight: 10,
                opacity: 0.14,
                lineCap: 'round',
                lineJoin: 'round',
              }}
              className="fleet-live-trail-glow"
            />
            <Polyline
              positions={positions}
              pathOptions={{
                color: '#5ac8fa',
                weight: 5,
                opacity: 0.35,
                lineCap: 'round',
                lineJoin: 'round',
              }}
              className="fleet-live-trail-mid"
            />
            <Polyline
              positions={positions}
              pathOptions={{
                color: APPLE_MAP_COLORS.accent,
                weight: 3.25,
                opacity: 0.92,
                lineCap: 'round',
                lineJoin: 'round',
              }}
              className="fleet-live-trail-core"
            />
            <CircleMarker
              center={tip}
              radius={5}
              pathOptions={{
                color: '#ffffff',
                weight: 2,
                fillColor: APPLE_MAP_COLORS.accent,
                fillOpacity: 0.95,
              }}
            />
          </Fragment>
        );
      })}
    </>
  );
}
