/** Shared labels for live fleet vehicle popups / cards. */

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
