/**
 * Live-map auto-fit: zoom by how many active pins are on the map.
 * One pin → street-level; many pins → pull back so all stay in view.
 */

export function resolveFleetFitMaxZoom(count) {
  const n = Math.max(0, Number(count) || 0);
  if (n <= 1) return 16.5;
  if (n === 2) return 15;
  if (n <= 4) return 14;
  if (n <= 8) return 13;
  return 12;
}

export function resolveFleetFitPadding(count) {
  const n = Math.max(0, Number(count) || 0);
  return n <= 1 ? 56 : 80;
}
