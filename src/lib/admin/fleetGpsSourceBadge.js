/**
 * Live-map badge: Teltonika hardware and/or driver app — one pin, all live sources.
 */

const APP_SEEN_FRESH_MS = 90_000;

export function resolveFleetGpsSource(vehicle) {
  const sources = resolveFleetGpsSources(vehicle);
  if (sources.includes('teltonika')) return 'teltonika';
  if (sources.includes('app')) return 'app';
  return '';
}

function kindFromRaw(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  if (s.includes('teltonika') || s === 'test_ping' || s === 'tracker') return 'teltonika';
  if (s.includes('driver') || s.includes('pwa') || s.includes('phone') || s.includes('app')) {
    return 'app';
  }
  return '';
}

function isAppSeenFresh(vehicle) {
  const raw = vehicle?.app_seen_at || vehicle?.appSeenAt;
  if (!raw) return false;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= APP_SEEN_FRESH_MS;
}

/** Active GPS channels for the dual badge — order: teltonika, app. */
export function resolveFleetGpsSources(vehicle) {
  if (!vehicle) return [];
  const out = [];
  const seen = new Set();

  const push = (kind) => {
    if (!kind || seen.has(kind)) return;
    seen.add(kind);
    out.push(kind);
  };

  const listed = Array.isArray(vehicle.gps_sources)
    ? vehicle.gps_sources
    : Array.isArray(vehicle.gpsSources)
      ? vehicle.gpsSources
      : [];
  for (const item of listed) {
    push(kindFromRaw(item) || (item === 'teltonika' || item === 'app' ? item : ''));
  }

  const primary = kindFromRaw(vehicle?.source || vehicle?.gps_source || vehicle?.gpsSource);
  if (primary) push(primary);
  else if (vehicle?.imei && primary !== 'app') push('teltonika');

  if (isAppSeenFresh(vehicle)) push('app');

  // Stable order for the graphic.
  return ['teltonika', 'app'].filter((k) => seen.has(k));
}

/** Short Greek label for a single chip, or '' when unknown. */
export function formatFleetGpsSourceBadge(vehicle) {
  const sources = resolveFleetGpsSources(vehicle);
  if (sources.length === 2) return 'Teltonika · App';
  if (sources[0] === 'teltonika') return 'Teltonika';
  if (sources[0] === 'app') return 'App οδηγού';
  return '';
}

export function formatFleetGpsSourceChipLabel(kind) {
  if (kind === 'teltonika') return 'Teltonika';
  if (kind === 'app') return 'App';
  return '';
}

export function fleetGpsSourceToneClass(vehicle) {
  const sources = resolveFleetGpsSources(vehicle);
  if (sources.length > 1) return 'fleet-apple-bus-gps-source--dual';
  if (sources[0] === 'teltonika') return 'fleet-apple-bus-gps-source--teltonika';
  if (sources[0] === 'app') return 'fleet-apple-bus-gps-source--app';
  return '';
}

/** HTML for Leaflet divIcon — one or two live-source chips. */
export function fleetGpsSourceBadgeHtml(vehicle, { escapeAttr }) {
  const sources = resolveFleetGpsSources(vehicle);
  if (!sources.length) return { html: '', heightBoost: false };
  const chips = sources
    .map((kind) => {
      const label = formatFleetGpsSourceChipLabel(kind);
      const tone =
        kind === 'teltonika'
          ? 'fleet-apple-bus-gps-source--teltonika'
          : 'fleet-apple-bus-gps-source--app';
      return `<span class="fleet-apple-bus-gps-source ${escapeAttr(tone)}">${escapeAttr(label)}</span>`;
    })
    .join('');
  const dual = sources.length > 1 ? ' is-dual' : '';
  return {
    html: `<div class="fleet-apple-bus-gps-sources${dual}">${chips}</div>`,
    heightBoost: true,
    dual: sources.length > 1,
  };
}
