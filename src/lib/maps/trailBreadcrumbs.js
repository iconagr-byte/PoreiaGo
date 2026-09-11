/**
 * Subsample trail positions into blue breadcrumb dots (στίγματα).
 * Keeps start + end and spreads mid points evenly so dense GPS does not flood the map.
 */

export function sampleTrailBreadcrumbs(positions, maxDots = 80) {
  if (!Array.isArray(positions) || !positions.length) return [];
  if (positions.length <= maxDots) return positions.slice();
  const step = (positions.length - 1) / (maxDots - 1);
  const out = [];
  for (let i = 0; i < maxDots; i += 1) {
    out.push(positions[Math.round(i * step)]);
  }
  return out;
}
