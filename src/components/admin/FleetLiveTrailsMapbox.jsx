import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/mapbox';
import { APPLE_MAP_COLORS } from '../../lib/maps/appleMapTheme.js';

function trailsToGeoJson(trails) {
  const lineFeatures = [];
  const tipFeatures = [];

  for (const trail of trails || []) {
    const coordinates = (trail.points || [])
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => [p.lng, p.lat]);
    if (coordinates.length < 2) continue;
    lineFeatures.push({
      type: 'Feature',
      properties: { id: trail.id },
      geometry: { type: 'LineString', coordinates },
    });
    const tip = coordinates[coordinates.length - 1];
    tipFeatures.push({
      type: 'Feature',
      properties: { id: `${trail.id}-tip` },
      geometry: { type: 'Point', coordinates: tip },
    });
  }

  return {
    lines: { type: 'FeatureCollection', features: lineFeatures },
    tips: { type: 'FeatureCollection', features: tipFeatures },
  };
}

/** Live GPS trail — glow casing + cyan mid + blue core + tip. */
export default function FleetLiveTrailsMapbox({ trails = [], visible = true }) {
  const geo = useMemo(() => trailsToGeoJson(trails), [trails]);

  if (!visible || !geo.lines.features.length) return null;

  return (
    <>
      <Source id="fleet-live-trails" type="geojson" data={geo.lines}>
        <Layer
          id="fleet-live-trail-glow"
          type="line"
          paint={{
            'line-color': APPLE_MAP_COLORS.accent,
            'line-width': 12,
            'line-opacity': 0.16,
            'line-blur': 1.2,
          }}
          layout={{
            'line-cap': 'round',
            'line-join': 'round',
          }}
        />
        <Layer
          id="fleet-live-trail-mid"
          type="line"
          paint={{
            'line-color': '#5ac8fa',
            'line-width': 6,
            'line-opacity': 0.38,
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
            'line-width': 3.25,
            'line-opacity': 0.95,
          }}
          layout={{
            'line-cap': 'round',
            'line-join': 'round',
          }}
        />
      </Source>
      <Source id="fleet-live-trail-tips" type="geojson" data={geo.tips}>
        <Layer
          id="fleet-live-trail-tip-halo"
          type="circle"
          paint={{
            'circle-radius': 9,
            'circle-color': APPLE_MAP_COLORS.accent,
            'circle-opacity': 0.22,
          }}
        />
        <Layer
          id="fleet-live-trail-tip"
          type="circle"
          paint={{
            'circle-radius': 4.5,
            'circle-color': APPLE_MAP_COLORS.accent,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          }}
        />
      </Source>
    </>
  );
}
