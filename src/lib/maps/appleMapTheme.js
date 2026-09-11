/**
 * Apple-inspired live map theme — soft light basemap with place labels.
 *
 * CARTO anonymous basemaps now watermark "API KEY REQUIRED".
 * Default to OpenStreetMap (no key). Optional VITE_CARTO_API_KEY restores CARTO light.
 */

const cartoApiKey = String(import.meta.env.VITE_CARTO_API_KEY || '').trim();

/** Shared Leaflet raster basemap — safe default without third-party API keys. */
export const LEAFLET_BASEMAP = cartoApiKey
  ? {
      url: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?apikey=${encodeURIComponent(cartoApiKey)}`,
      attribution: '© OpenStreetMap · © CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }
  : {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
      subdomains: 'abc',
      maxZoom: 19,
    };

/**
 * Live map tiles — same as LEAFLET_BASEMAP (Greek πόλεις/δήμοι via overlay).
 */
export const APPLE_LEAFLET_TILES = LEAFLET_BASEMAP;

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
