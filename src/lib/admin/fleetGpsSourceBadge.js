/**
 * Live-map badge: Teltonika hardware and/or driver app — one pin, all live sources.
 */

const SOURCE_FRESH_MS = 90_000;
/** Match Teltonika Codec TCP idle timeout — parked AVL is often rarer than 90s. */
const TELTONIKA_BADGE_FRESH_MS = 300_000;

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

function ageMs(raw) {
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Date.now() - t);
}

function isFresh(raw, maxMs = SOURCE_FRESH_MS) {
  const age = ageMs(raw);
  return age != null && age <= maxMs;
}

function isAppSeenFresh(vehicle) {
  return isFresh(vehicle?.app_seen_at || vehicle?.appSeenAt);
}

/** Real Teltonika packet time — ignore hydrate-bumped updated_at. */
function isTeltonikaSignalFresh(vehicle) {
  if (!vehicle) return false;
  if (vehicle.hydrated_from_store || vehicle.hydratedFromStore) {
    return isFresh(
      vehicle.tracker_signal_at || vehicle.trackerSignalAt,
      TELTONIKA_BADGE_FRESH_MS,
    );
  }
  const signal =
    vehicle.tracker_signal_at ||
    vehicle.trackerSignalAt ||
    (kindFromRaw(vehicle.source) === 'teltonika'
      ? vehicle.timestamp || vehicle.updated_at
      : null);
  return isFresh(signal, TELTONIKA_BADGE_FRESH_MS);
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

  // Trust server gps_sources for the dual badge. Offline devices omit
  // teltonika server-side; do not second-guess a listed open channel.
  for (const item of listed) {
    const kind = kindFromRaw(item) || (item === 'teltonika' || item === 'app' ? item : '');
    push(kind);
  }

  if (isTeltonikaSignalFresh(vehicle)) push('teltonika');
  else if (
    kindFromRaw(vehicle?.source || vehicle?.gps_source || vehicle?.gpsSource) === 'teltonika' &&
    !vehicle.hydrated_from_store &&
    !vehicle.hydratedFromStore &&
    isFresh(vehicle.timestamp || vehicle.updated_at, TELTONIKA_BADGE_FRESH_MS)
  ) {
    push('teltonika');
  } else if (
    vehicle?.imei &&
    !vehicle.hydrated_from_store &&
    !vehicle.hydratedFromStore &&
    isFresh(
      vehicle.tracker_signal_at || vehicle.trackerSignalAt || vehicle.timestamp,
      TELTONIKA_BADGE_FRESH_MS,
    )
  ) {
    push('teltonika');
  }

  if (isAppSeenFresh(vehicle)) push('app');
  else if (
    kindFromRaw(vehicle?.source) === 'app' &&
    isFresh(vehicle.timestamp || vehicle.updated_at)
  ) {
    push('app');
  }

  return ['teltonika', 'app'].filter((k) => seen.has(k));
}

/** Short Greek label for a single chip, or '' when unknown. */
export function formatFleetGpsSourceBadge(vehicle) {
  const sources = resolveFleetGpsSources(vehicle);
  if (sources.length === 2) return 'GPS οχήματος · App';
  if (sources[0] === 'teltonika') return 'GPS οχήματος';
  if (sources[0] === 'app') return 'App οδηγού';
  return '';
}

export function formatFleetGpsSourceChipLabel(kind) {
  // User-facing: describe the channel (vehicle hardware vs driver app), not the vendor.
  if (kind === 'teltonika') return 'GPS οχήματος';
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
