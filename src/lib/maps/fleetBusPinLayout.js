/**
 * Live-map bus pin geometry — avatar ring sits ON the GPS lat/lng.
 * Labels (plate / excursion) float above and must not shift iconAnchor.
 */
export const FLEET_BUS_PIN_RING = 52;

/** Leaflet iconSize / iconAnchor for the 52×52 avatar ring. */
export const FLEET_BUS_PIN_ICON_SIZE = [FLEET_BUS_PIN_RING, FLEET_BUS_PIN_RING];
export const FLEET_BUS_PIN_ICON_ANCHOR = [FLEET_BUS_PIN_RING / 2, FLEET_BUS_PIN_RING / 2];
