import { useEffect, useMemo, useState } from 'react';
import { Marker, useMap } from 'react-map-gl/mapbox';
import { placesVisibleAtZoom } from '../../lib/maps/greecePlaces.js';
import { applyGreekMapboxLabels } from '../../lib/maps/mapboxConfig.js';

function placeClass(kind) {
  if (kind === 'region') return 'fleet-place-label is-region';
  if (kind === 'municipality') return 'fleet-place-label is-muni';
  return 'fleet-place-label is-city';
}

/**
 * Ελληνικές ετικέτες πόλεων/δήμων/περιφερειών + Greek names on Mapbox settlement labels.
 * Basemap place labels stay visible (never hidden).
 */
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
      <span className={placeClass(p.kind)}>{p.name}</span>
    </Marker>
  ));
}
