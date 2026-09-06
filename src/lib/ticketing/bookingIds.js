/**
 * Canonical booking ids shared by wallet QR + driver scan + office sync.
 * BK-B95F8658 → B-B95F8658 (never B-BK-B95F8658).
 */

export function normalizeReference(code) {
  let c = String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  while (c.startsWith('B-') && !c.startsWith('BK-')) {
    c = c.slice(2);
  }
  if (c && !c.startsWith('BK-')) {
    c = `BK-${c.replace(/^BK-/, '').replace(/^BK/, '')}`;
  }
  return c;
}

export function localIdFromReference(referenceCode) {
  let ref = String(referenceCode || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  while (ref.startsWith('B-') && !ref.startsWith('BK-')) {
    ref = ref.slice(2);
  }
  if (ref.startsWith('BK-')) return `B-${ref.slice(3)}`;
  return ref ? `B-${ref}` : '';
}

export function bookingIdAliases(bookingId) {
  const raw = String(bookingId || '').trim();
  if (!raw) return [];
  const upper = raw.toUpperCase().replace(/\s+/g, '');
  const canon = localIdFromReference(upper);
  const pnr = normalizeReference(upper);
  const out = [];
  const seen = new Set();
  for (const c of [raw, upper, canon, pnr, pnr.startsWith('BK-') ? `B-${pnr}` : '']) {
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}
