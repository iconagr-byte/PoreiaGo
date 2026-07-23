import { useEffect, useMemo, useState } from 'react';
import { Marker, useMap } from 'react-map-gl/mapbox';
import { placesVisibleAtZoom } from '../../lib/maps/greecePlaces.js';
import { applyGreekMapboxLabels } from '../../lib/maps/mapboxConfig.js';

/** Ελληνικές πόλεις & περιφέρειες + ελληνικά ονόματα στο basemap. */
export default function GreecePlacesMapboxLayer({ visible = true }) {
  const map = useMap();
  const [zoom, setZoom] = useState(6);

  useEffect(() => {
    const mapInstance = map?.getMap?.() || map;
    if (!mapInstance?.on) return undefined;

    const syncZoom = () => setZoom(mapInstance.getZoom?.() ?? 6);
    const onStyle = () => applyGreekMapboxLabels(mapInstance);

    syncZoom();
    mapInstance.on('zoom', syncZoom);
    mapInstance.on('zoomend', syncZoom);
    mapInstance.on('load', onStyle);
    mapInstance.on('styledata', onStyle);
    if (mapInstance.isStyleLoaded?.()) onStyle();

    return () => {
      mapInstance.off('zoom', syncZoom);
      mapInstance.off('zoomend', syncZoom);
      mapInstance.off('load', onStyle);
      mapInstance.off('styledata', onStyle);
    };
  }, [map]);

  const places = useMemo(() => (visible ? placesVisibleAtZoom(zoom) : []), [visible, zoom]);

  if (!visible) return null;

  return places.map((p) => (
    <Marker key={p.id} longitude={p.lng} latitude={p.lat} anchor="center" style={{ pointerEvents: 'none' }}>
      <span className={`fleet-place-label ${p.kind === 'region' ? 'is-region' : 'is-city'}`}>{p.name}</span>
    </Marker>
  ));
}
