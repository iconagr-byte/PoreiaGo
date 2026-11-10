/**
 * SLA metrics + auto-rebook suggestions for hybrid trips.
 */
import { analyzeConnectionRisks } from './connectionRisk.js';
import { effectiveConnectionThreshold } from './airportBuffers.js';

export function computeHybridSla({ trips = [], thresholdMin = 90 } = {}) {
  let delayedFlights = 0;
  let tightConnections = 0;
  let criticalConnections = 0;
  let latePickups = 0;
  let totalFlights = 0;
  let totalSegments = 0;
  const incidents = [];

  for (const trip of trips) {
    const flights = trip.flights || [];
    const segments = [...(trip.segments || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    totalFlights += flights.length;
    totalSegments += segments.length;

    for (const f of flights) {
      const delay = Number(f.delay_minutes) || 0;
      if (delay > 0 || f.status === 'delayed') {
        delayedFlights += 1;
        incidents.push({
          type: 'flight_delay',
          tripId: trip.id,
          tripTitle: trip.title,
          summary: `${f.flight_number || 'Flight'} +${delay}′`,
          severity: delay >= 45 ? 'critical' : 'warn',
        });
      }
    }

    const risks = analyzeConnectionRisks(
      segments,
      effectiveConnectionThreshold({
        baseThreshold: trip.connectionThresholdMin ?? thresholdMin,
        arrivalAirport: flights[0]?.arrival_airport,
        airportBuffers: trip.airportBuffers || {},
      }),
    );
    for (const r of risks) {
      if (r.level === 'tight') {
        tightConnections += 1;
        incidents.push({
          type: 'tight_connection',
          tripId: trip.id,
          tripTitle: trip.title,
          summary: r.message,
          severity: 'warn',
        });
      }
      if (r.level === 'critical') {
        criticalConnections += 1;
        incidents.push({
          type: 'missed_connection_risk',
          tripId: trip.id,
          tripTitle: trip.title,
          summary: r.message,
          severity: 'critical',
        });
      }
    }

    for (const s of segments) {
      const shifted = Number(s.metadata?.pickup_shifted_by_minutes) || 0;
      if (shifted > 0) {
        latePickups += 1;
        incidents.push({
          type: 'late_pickup',
          tripId: trip.id,
          tripTitle: trip.title,
          summary: `${s.title || s.segment_type} μετατοπίστηκε +${shifted}′`,
          severity: shifted >= 30 ? 'warn' : 'info',
        });
      }
    }
  }

  return {
    tripCount: trips.length,
    totalFlights,
    totalSegments,
    delayedFlights,
    tightConnections,
    criticalConnections,
    latePickups,
    incidents: incidents.slice(0, 50),
  };
}

/**
 * Suggest alternate flight + pickup when connection is critical / delayed.
 * Heuristic only — not a live inventory lookup.
 */
export function suggestRebook({ trip, flightId } = {}) {
  const flight = (trip?.flights || []).find((f) => f.id === flightId) || (trip?.flights || [])[0];
  if (!flight) return null;
  const delay = Number(flight.delay_minutes) || 0;
  const dep = flight.departure_time ? new Date(flight.departure_time) : null;
  const arr = flight.arrival_time ? new Date(flight.arrival_time) : null;
  if (!dep || !arr || Number.isNaN(dep.getTime())) return null;

  const altDep = new Date(dep.getTime() + Math.max(delay, 60) * 60000 + 30 * 60000);
  const duration = arr.getTime() - dep.getTime();
  const altArr = new Date(altDep.getTime() + Math.max(duration, 60 * 60000));
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const pickupShift = delay + 45;
  return {
    originalFlightNumber: flight.flight_number,
    suggestedFlightNumber: `${String(flight.flight_number || 'XX000').replace(/\s+/g, '')}B`,
    airline: flight.airline || '',
    departure_airport: flight.departure_airport,
    arrival_airport: flight.arrival_airport,
    departure_time: fmt(altDep),
    arrival_time: fmt(altArr),
    pickup_shift_minutes: pickupShift,
    reason:
      delay > 0
        ? `Καθυστέρηση +${delay}′ — προτεινόμενη επόμενη διαθέσιμη σύνδεση (+30′ buffer)`
        : 'Κρίσιμη σύνδεση — προτεινόμενη εναλλακτική πτήση',
    confidence: delay >= 45 ? 'high' : 'medium',
  };
}
