/** Mapbox GL — token από env. Χωρίς token, fallback σε Leaflet. */
import { APPLE_MAPBOX_STYLE } from './appleMapTheme.js';

export const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ||
  '';

export const MAPBOX_STYLE =
  import.meta.env.VITE_MAPBOX_STYLE || APPLE_MAPBOX_STYLE;

export function isMapboxEnabled() {
  return Boolean(MAPBOX_TOKEN);
}

/**
 * Prefer Greek place names on Mapbox label layers when available.
 * Safe no-op if the style has no text-field layout.
 */
export function applyGreekMapboxLabels(map) {
  if (!map?.getStyle || !map?.setLayoutProperty) return;
  let style;
  try {
    style = map.getStyle();
  } catch {
    return;
  }
  const layers = style?.layers || [];
  for (const layer of layers) {
    if (!layer?.id || layer.type !== 'symbol') continue;
    const layout = layer.layout || {};
    if (!layout['text-field']) continue;
    try {
      map.setLayoutProperty(layer.id, 'text-field', [
        'coalesce',
        ['get', 'name_el'],
        ['get', 'name_int'],
        ['get', 'name'],
      ]);
    } catch {
      /* some layers reject expression updates */
    }
  }
}
