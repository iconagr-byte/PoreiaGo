/**
 * Connection risk between consecutive hybrid timeline segments.
 * Flags tight connections when layover minutes fall below threshold.
 */

export const DEFAULT_CONNECTION_THRESHOLD_MIN = 90;

export function parseSegmentTime(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Returns risk rows for consecutive segment pairs that have parseable times.
 * Risk levels: ok | tight | critical | missing
 */
export function analyzeConnectionRisks(segments = [], thresholdMin = DEFAULT_CONNECTION_THRESHOLD_MIN) {
  const sorted = [...(segments || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const risks = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const from = sorted[i];
    const to = sorted[i + 1];
    const end = parseSegmentTime(from.ends_at || from.arrival_time || from.starts_at);
    const start = parseSegmentTime(to.starts_at || to.departure_time);
    if (!end || !start) {
      risks.push({
        fromId: from.id,
        toId: to.id,
        fromTitle: from.title || from.segment_type,
        toTitle: to.title || to.segment_type,
        layoverMinutes: null,
        level: 'missing',
        message: 'Λείπουν ώρες — δεν υπολογίζεται σύνδεση',
      });
      continue;
    }
    const layoverMinutes = Math.round((start.getTime() - end.getTime()) / 60000);
    let level = 'ok';
    let message = `Σύνδεση ${layoverMinutes}′`;
    if (layoverMinutes < 0) {
      level = 'critical';
      message = `Επικάλυψη ${Math.abs(layoverMinutes)}′ — τα τμήματα συγκρούονται`;
    } else if (layoverMinutes < Math.max(Number(thresholdMin) || 90, 30) / 2) {
      level = 'critical';
      message = `Κρίσιμη σύνδεση ${layoverMinutes}′ (< ${Math.round((Number(thresholdMin) || 90) / 2)}′)`;
    } else if (layoverMinutes < (Number(thresholdMin) || 90)) {
      level = 'tight';
      message = `Στενή σύνδεση ${layoverMinutes}′ (όριο ${thresholdMin}′)`;
    }
    risks.push({
      fromId: from.id,
      toId: to.id,
      fromTitle: from.title || from.segment_type,
      toTitle: to.title || to.segment_type,
      layoverMinutes,
      level,
      message,
    });
  }
  return risks;
}

/** Shift starts_at of ground segments after a delayed flight by delay minutes. */
export function applyPickupDelayShift(segments = [], flightId, delayMinutes = 0) {
  const delay = Number(delayMinutes) || 0;
  if (!delay || !flightId) return segments || [];
  const sorted = [...(segments || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const flightIdx = sorted.findIndex((s) => s.flight_id === flightId || s.id === flightId);
  if (flightIdx < 0) return sorted;

  return sorted.map((seg, idx) => {
    if (idx <= flightIdx) return seg;
    if (seg.segment_type === 'flight') return seg;
    if (!seg.starts_at) return seg;
    const start = parseSegmentTime(seg.starts_at);
    if (!start) return seg;
    const shifted = new Date(start.getTime() + delay * 60000);
    const ends = parseSegmentTime(seg.ends_at);
    const next = {
      ...seg,
      starts_at: toLocalDatetime(shifted),
      metadata: {
        ...(seg.metadata || {}),
        pickup_shifted_by_minutes: delay,
        pickup_shift_source_flight: flightId,
      },
    };
    if (ends) {
      next.ends_at = toLocalDatetime(new Date(ends.getTime() + delay * 60000));
    }
    return next;
  });
}

function toLocalDatetime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
