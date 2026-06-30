/** Mapbox GL — token από env. Χωρίς token, fallback σε Leaflet. */
export const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ||
  '';

export const MAPBOX_STYLE =
  import.meta.env.VITE_MAPBOX_STYLE || 'mapbox://styles/mapbox/streets-v12';

export function isMapboxEnabled() {
  return Boolean(MAPBOX_TOKEN);
}
