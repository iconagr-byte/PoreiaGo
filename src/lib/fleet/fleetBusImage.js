/**
 * Default storefront fleet coach — no tenant brand painted on the body.
 * Older Achillio-branded fallbacks are remapped here.
 */
export const NEUTRAL_FLEET_BUS_IMAGE = '/images/fleet-bus-neutral.png';

const BRANDED_BUS_IMAGE_RE = /achillio|achillion/i;

/** Resolve a public fleet card image, stripping Achillio/Achillion branded defaults. */
export function resolvePublicFleetImage(url) {
  const raw = String(url || '').trim();
  if (!raw || BRANDED_BUS_IMAGE_RE.test(raw)) {
    return NEUTRAL_FLEET_BUS_IMAGE;
  }
  return raw;
}
