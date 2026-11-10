/** Shared labels for live fleet vehicle popups / cards. */

// ~5KB square thumb — NEVER use the 2MB hero PNG as a map avatar.
export const DEFAULT_FLEET_BUS_IMAGE = '/images/fleet-bus-thumb.jpg';

export function resolveFleetMarkerImage(vehicle) {
  const raw =
    vehicle?.vehicle_image_url ||
    vehicle?.vehicleImageUrl ||
    vehicle?.photo_url ||
    vehicle?.photoUrl ||
    '';
  // Guard against accidentally pointing markers at the huge hero asset.
  if (!raw || String(raw).includes('hero-bus-achillio')) {
    return DEFAULT_FLEET_BUS_IMAGE;
  }
  return raw;
}

export function formatUpdatedAgo(timestamp) {
  if (!timestamp) return null;
  const t = new Date(timestamp).getTime();
  if (!Number.isFinite(t)) return null;
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 5) return 'τώρα';
  if (sec < 60) return `πριν ${sec}δ`;
  const min = Math.round(sec / 60);
  if (min < 60) return `πριν ${min}λ`;
  return new Date(t).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
}

export function formatBoardingLabel(vehicle) {
  const boarding = vehicle?.boarding;
  if (!boarding) return null;
  if (boarding.progress_label) return boarding.progress_label;
  if (boarding.boarded_count != null && boarding.capacity != null) {
    return `${boarding.boarded_count}/${boarding.capacity}`;
  }
  if (boarding.boarded_count != null) return String(boarding.boarded_count);
  return null;
}

export function formatPassengerNames(vehicle, limit = 5) {
  const names = (vehicle?.boarding?.boarded_passengers ?? [])
    .map((p) => p.passenger_name)
    .filter(Boolean);
  if (!names.length) return null;
  if (names.length <= limit) return names.join(', ');
  return `${names.slice(0, limit).join(', ')} +${names.length - limit}`;
}

export function formatSensorSummary(vehicle) {
  const s = vehicle?.sensors;
  if (!s) return null;
  const parts = [];
  if (s.battery?.level_pct != null) {
    parts.push(`🔋 ${s.battery.level_pct}%${s.battery.charging ? ' ⚡' : ''}`);
  }
  if (vehicle.accuracy_m != null) {
    parts.push(`±${Math.round(vehicle.accuracy_m)}m GPS`);
  }
  if (s.network?.effective_type) {
    parts.push(s.network.effective_type.toUpperCase());
  }
  return parts.length ? parts.join(' · ') : null;
}

/** Compass rose (Greek abbreviations) from heading degrees. */
const COMPASS_EL = ['Β', 'ΒΑ', 'Α', 'ΝΑ', 'Ν', 'ΝΔ', 'Δ', 'ΒΔ'];

export function resolveVehicleHeadingDeg(vehicle) {
  const raw = vehicle?.heading ?? vehicle?.heading_deg ?? vehicle?.headingDeg;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  let deg = n % 360;
  if (deg < 0) deg += 360;
  return deg;
}

export function formatCompassLabel(headingDeg) {
  if (!Number.isFinite(headingDeg)) return null;
  const idx = Math.round(headingDeg / 45) % 8;
  return COMPASS_EL[idx];
}

export function formatSpeedKmh(vehicle) {
  const n = Number(vehicle?.speed ?? vehicle?.speed_kmh ?? vehicle?.speedKmh);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

/** Short label for pin HUD / side panel — e.g. "NE · 45°". */
export function formatHeadingLabel(vehicle) {
  const deg = resolveVehicleHeadingDeg(vehicle);
  if (deg == null) return null;
  const compass = formatCompassLabel(deg);
  const rounded = Math.round(deg);
  return compass ? `${compass} · ${rounded}°` : `${rounded}°`;
}

/**
 * Compact HTML bubble for Leaflet divIcon — speed + heading above the pin.
 * escapeAttr must match the Leaflet pin helper.
 */
export function fleetPinTelemetryHudHtml(vehicle, { escapeAttr = (v) => String(v ?? '') } = {}) {
  const speed = formatSpeedKmh(vehicle);
  const heading = formatHeadingLabel(vehicle);
  const deg = resolveVehicleHeadingDeg(vehicle);
  const arrowStyle =
    deg != null
      ? ` style="transform:rotate(${Math.round(deg)}deg)"`
      : '';
  const headingHtml = heading
    ? `<span class="fleet-apple-bus-hud__heading"><span class="fleet-apple-bus-hud__arrow"${arrowStyle} aria-hidden="true"></span>${escapeAttr(heading)}</span>`
    : `<span class="fleet-apple-bus-hud__heading is-empty">—</span>`;
  return `<div class="fleet-apple-bus-hud" role="status" aria-label="Ταχύτητα ${speed} χιλιόμετρα ανά ώρα${heading ? `, κατεύθυνση ${heading}` : ''}">
    <span class="fleet-apple-bus-hud__speed"><strong>${escapeAttr(String(speed))}</strong><small>km/h</small></span>
    <span class="fleet-apple-bus-hud__sep" aria-hidden="true"></span>
    ${headingHtml}
  </div>`;
}

/**
 * Structured telemetry chips for Ενεργά οχήματα / popups.
 * @returns {{ key: string, label: string, value: string, tone?: string }[]}
 */
export function fleetTelemetryIndicators(vehicle) {
  if (!vehicle) return [];
  const out = [];
  const speed = formatSpeedKmh(vehicle);
  out.push({ key: 'speed', label: 'Ταχύτητα', value: `${speed} km/h`, tone: 'speed' });

  const heading = formatHeadingLabel(vehicle);
  if (heading) {
    out.push({ key: 'heading', label: 'Κατεύθυνση', value: heading, tone: 'heading' });
  }

  const engine =
    vehicle.engine_on ?? vehicle.engineOn ?? vehicle.engine_status ?? vehicle.engineStatus;
  if (engine != null && engine !== '') {
    const on =
      engine === true ||
      ['on', 'idle', 'running', '1', 'true'].includes(String(engine).toLowerCase());
    out.push({
      key: 'engine',
      label: 'Κινητήρας',
      value: on ? 'ON' : 'OFF',
      tone: on ? 'engine-on' : 'engine-off',
    });
  }

  const alt = Number(vehicle.altitude_m ?? vehicle.altitudeM);
  if (Number.isFinite(alt)) {
    out.push({ key: 'altitude', label: 'Υψόμετρο', value: `${Math.round(alt)} m`, tone: 'alt' });
  }

  const sats = Number(vehicle.satellites);
  if (Number.isFinite(sats) && sats > 0) {
    out.push({ key: 'sats', label: 'Δορυφόροι', value: String(Math.round(sats)), tone: 'sats' });
  }

  const acc = Number(vehicle.accuracy_m ?? vehicle.accuracyM);
  if (Number.isFinite(acc) && acc > 0) {
    out.push({ key: 'accuracy', label: 'Ακρίβεια', value: `±${Math.round(acc)} m`, tone: 'acc' });
  }

  const idle = Number(vehicle.idle_seconds_trip ?? vehicle.idleSecondsTrip);
  if (Number.isFinite(idle) && idle >= 60) {
    const mins = Math.round(idle / 60);
    out.push({ key: 'idle', label: 'Ακινησία', value: `${mins} λ`, tone: 'idle' });
  }

  return out;
}
