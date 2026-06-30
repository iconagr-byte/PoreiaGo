/** Alerts με συντεταγμένες για overlay στον χάρτη. */

const TELEMETRY_ALERT_TYPES = new Set([
  'ROUTE_DEVIATION',
  'HARSH_BRAKING',
  'HARSH_ACCELERATION',
  'HARSH_CORNERING',
  'SPEEDING',
]);

export const SOS_ALERT_TYPES = new Set(['SOS', 'BREAKDOWN', 'ACCIDENT', 'DELAY']);

export function isSosAlert(alert) {
  return SOS_ALERT_TYPES.has(String(alert?.alert_type || '').toUpperCase());
}

export function alertCoords(alert) {
  const meta = alert?.metadata || {};
  const lat = alert?.lat ?? meta.lat ?? meta.latitude;
  const lng = alert?.lng ?? meta.lng ?? meta.longitude;
  if (lat == null || lng == null) return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return { lat: la, lng: ln };
}

function collectAlertsWithCoords(alerts, types, { maxAgeMinutes = 120 } = {}) {
  const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
  const seen = new Set();
  const rows = [];

  for (const alert of alerts || []) {
    const type = String(alert.alert_type || '').toUpperCase();
    if (!types.has(type)) continue;
    const coords = alertCoords(alert);
    if (!coords) continue;
    if (alert.created_at) {
      const ts = new Date(alert.created_at).getTime();
      if (Number.isFinite(ts) && ts < cutoff) continue;
    }
    const key = `${alert.id || type}-${coords.lat}-${coords.lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ ...alert, alert_type: type, lat: coords.lat, lng: coords.lng });
  }
  return rows;
}

/** SOS / incident pins — εμφανίζονται πάντα στον χάρτη (24h). */
export function mapSosAlertsWithCoords(alerts, { maxAgeMinutes = 24 * 60 } = {}) {
  return collectAlertsWithCoords(alerts, SOS_ALERT_TYPES, { maxAgeMinutes }).slice(0, 20);
}

/** Telematics alerts (geofence overlay). */
export function mapTelemetryAlertsWithCoords(alerts, { maxAgeMinutes = 120 } = {}) {
  return collectAlertsWithCoords(alerts, TELEMETRY_ALERT_TYPES, { maxAgeMinutes }).slice(0, 40);
}

/** Combined — SOS πρώτα για z-index / προτεραιότητα. */
export function mapAlertsWithCoords(alerts, opts = {}) {
  const sos = mapSosAlertsWithCoords(alerts, opts);
  const telem = mapTelemetryAlertsWithCoords(alerts, opts);
  return [...sos, ...telem].slice(0, 50);
}

export const ALERT_MAP_STYLES = {
  ROUTE_DEVIATION: { color: '#dc2626', label: 'Απόκλιση' },
  HARSH_BRAKING: { color: '#d97706', label: 'Φρενάρισμα' },
  HARSH_ACCELERATION: { color: '#ea580c', label: 'Επιτάχυνση' },
  HARSH_CORNERING: { color: '#ca8a04', label: 'Στροφή' },
  SPEEDING: { color: '#9333ea', label: 'Ταχύτητα' },
  SOS: { color: '#dc2626', label: 'SOS / PANIC', sos: true },
  BREAKDOWN: { color: '#ea580c', label: 'Βλάβη', sos: true },
  ACCIDENT: { color: '#b91c1c', label: 'Ατύχημα', sos: true },
  DELAY: { color: '#d97706', label: 'Καθυστέρηση', sos: true },
};
