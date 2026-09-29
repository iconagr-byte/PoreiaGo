import { Fragment } from 'react';
import { Polyline, CircleMarker } from 'react-leaflet';
import { APPLE_MAP_COLORS } from '../../lib/maps/appleMapTheme.js';
import { sampleTrailBreadcrumbs } from '../../lib/maps/trailBreadcrumbs.js';

/**
 * Live GPS trail — blue path + breadcrumb dots (στίγματα) along the route.
 */
export default function FleetLiveTrailsLeaflet({ trails = [], visible = true }) {
  if (!visible || !trails.length) return null;

  return (
    <>
      {trails.map((trail) => {
        const positions = (trail.points || [])
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          .map((p) => [p.lat, p.lng]);
        if (!positions.length) return null;
        const crumbs = sampleTrailBreadcrumbs(positions, 72);
        return (
          <Fragment key={`trail-${trail.id}`}>
            {positions.length >= 2 ? (
              <>
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
              </>
            ) : null}
            {/* Skip the last crumb — the bus pin sits on the live GPS tip. */}
            {crumbs.slice(0, -1).map((pos, idx) => (
              <CircleMarker
                key={`crumb-${trail.id}-${idx}`}
                center={pos}
                radius={3.25}
                pathOptions={{
                  color: '#ffffff',
                  weight: 1.25,
                  fillColor: APPLE_MAP_COLORS.accent,
                  fillOpacity: 0.82,
                }}
                className="fleet-live-trail-crumb"
              />
            ))}
          </Fragment>
        );
      })}
    </>
  );
}
