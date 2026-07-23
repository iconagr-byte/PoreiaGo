import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/mapbox';
import { APPLE_MAP_COLORS } from '../../lib/maps/appleMapTheme.js';

function trailsToGeoJson(trails) {
  return {
    type: 'FeatureCollection',
    features: (trails || [])
      .map((trail) => {
        const coordinates = (trail.points || [])
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
          .map((p) => [p.lng, p.lat]);
        if (coordinates.length < 2) return null;
        return {
          type: 'Feature',
          properties: { id: trail.id },
          geometry: { type: 'LineString', coordinates },
        };
      })
      .filter(Boolean),
  };
}

/** Live GPS trail for each active bus/van — Mapbox GL. */
export default function FleetLiveTrailsMapbox({ trails = [], visible = true }) {
  const geo = useMemo(() => trailsToGeoJson(trails), [trails]);

  if (!visible || !geo.features.length) return null;

  return (
    <Source id="fleet-live-trails" type="geojson" data={geo}>
      <Layer
        id="fleet-live-trail-glow"
        type="line"
        paint={{
          'line-color': APPLE_MAP_COLORS.accent,
          'line-width': 8,
          'line-opacity': 0.18,
        }}
        layout={{
          'line-cap': 'round',
          'line-join': 'round',
        }}
      />
      <Layer
        id="fleet-live-trail-line"
        type="line"
        paint={{
          'line-color': APPLE_MAP_COLORS.accent,
          'line-width': 3.5,
          'line-opacity': 0.85,
        }}
        layout={{
          'line-cap': 'round',
          'line-join': 'round',
        }}
      />
    </Source>
  );
}
