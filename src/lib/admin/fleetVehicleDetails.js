/** Shared labels for live fleet vehicle popups / cards. */

export const DEFAULT_FLEET_BUS_IMAGE = '/images/hero-bus-achillio.png';

export function resolveFleetMarkerImage(vehicle) {
  return (
    vehicle?.vehicle_image_url ||
    vehicle?.vehicleImageUrl ||
    vehicle?.photo_url ||
    vehicle?.photoUrl ||
    DEFAULT_FLEET_BUS_IMAGE
  );
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
