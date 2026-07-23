/**
 * Apple-inspired live map theme — soft light basemap, SF-like chrome, Greek labels.
 */

/**
 * CARTO light without place names — our collision-aware Greek labels sit cleanly on top
 * (avoids ΘΕΣΣΑΛΟΝΙΚΗ + ΚΕΝΤΡΙΚΗ ΜΑΚΕΔΟΝΙΑ stacking on Voyager).
 */
export const APPLE_LEAFLET_TILES = {
  url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
  attribution: '© OpenStreetMap · © CARTO',
  subdomains: 'abcd',
  maxZoom: 19,
};

/** Mapbox style closest to Apple Maps light aesthetic. */
export const APPLE_MAPBOX_STYLE = 'mapbox://styles/mapbox/light-v11';

export const APPLE_MAP_COLORS = {
  ink: '#1d1d1f',
  secondary: '#6e6e73',
  tertiary: '#86868b',
  fill: '#f5f5f7',
  card: 'rgba(255,255,255,0.82)',
  stroke: 'rgba(0,0,0,0.08)',
  accent: '#0071e3',
  live: '#34c759',
  danger: '#ff3b30',
  markerRing: '#ffffff',
  markerHalo: 'rgba(0,113,227,0.22)',
};

export const APPLE_MAP_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", system-ui, sans-serif';
