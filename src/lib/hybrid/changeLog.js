/**
 * Hybrid trip change log helpers.
 */

export function emptyCrew(overrides = {}) {
  return {
    tourLeader: '',
    driverName: '',
    guideName: '',
    ...overrides,
  };
}

export function appendHybridChange(trip, entry) {
  const log = Array.isArray(trip?.hybridChangeLog) ? [...trip.hybridChangeLog] : [];
  log.unshift({
    id: `chg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    actor: entry.actor || 'office',
    action: entry.action || 'update',
    summary: entry.summary || '',
    meta: entry.meta || {},
  });
  return log.slice(0, 100);
}

export function summarizeHybridDiff(prev, next) {
  if (!prev) return 'Δημιουργία hybrid πεδίων';
  const parts = [];
  const pf = (prev.flights || []).length;
  const nf = (next.flights || []).length;
  if (pf !== nf) parts.push(`πτήσεις ${pf}→${nf}`);
  const ps = (prev.segments || []).length;
  const ns = (next.segments || []).length;
  if (ps !== ns) parts.push(`τμήματα ${ps}→${ns}`);
  const pp = (prev.passengerFlightSeats || []).length;
  const np = (next.passengerFlightSeats || []).length;
  if (pp !== np) parts.push(`manifest ${pp}→${np}`);
  if ((prev.currency || 'EUR') !== (next.currency || 'EUR')) {
    parts.push(`νόμισμα ${prev.currency || 'EUR'}→${next.currency || 'EUR'}`);
  }
  const pc = prev.crew || {};
  const nc = next.crew || {};
  if (
    pc.tourLeader !== nc.tourLeader ||
    pc.driverName !== nc.driverName ||
    pc.guideName !== nc.guideName
  ) {
    parts.push('πλήρωμα');
  }
  return parts.length ? parts.join(' · ') : 'Ενημέρωση hybrid δεδομένων';
}
