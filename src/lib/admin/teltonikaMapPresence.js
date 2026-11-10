/**
 * Office live-map empty-state helpers — explain Teltonika offline vs no binding.
 * Production lock: empty map must not look like a software bug when IMEI is quiet.
 */

const ONLINE_WINDOW_MS = 90_000;

export function ageMsFromIso(raw) {
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Date.now() - t);
}

export function isTeltonikaDeviceOnline(device, nowMs = Date.now()) {
  if (!device || device.enabled === false) return false;
  const age = ageMsFromIso(device.last_seen_at || device.lastSeenAt);
  if (age == null) return false;
  return age <= ONLINE_WINDOW_MS;
}

/**
 * Best-effort Greek empty-map line from Teltonika device rows.
 * Pass ``status``: 'loading' | 'ready' | 'error' so we never claim «no IMEI»
 * before the devices fetch settles (Bugbot / production lock).
 */
export function formatTeltonikaEmptyMapHint(devices, status = 'ready') {
  if (status === 'loading') {
    return 'Έλεγχος GPS οχήματος (Teltonika)…';
  }
  if (status === 'error') {
    return 'Δεν φορτώθηκε η λίστα Teltonika — το στίγμα εμφανίζεται μόνο με ζωντανό Codec. Δοκίμασε hard-refresh.';
  }
  const list = Array.isArray(devices) ? devices.filter((d) => d && d.enabled !== false) : [];
  if (!list.length) {
    return 'Κανένα δεμένο GPS οχήματος (Teltonika). Πρόσθεσε IMEI στις ρυθμίσεις τηλεματικής.';
  }
  const online = list.filter((d) => isTeltonikaDeviceOnline(d));
  if (online.length) {
    const plates = online
      .map((d) => String(d.vehicle_code || d.vehicleCode || d.imei || '').trim())
      .filter(Boolean)
      .slice(0, 3);
    return `Το IMEI φαίνεται online (${plates.join(', ') || 'συσκευή'}) — κάνε hard-refresh αν το στίγμα δεν εμφανίστηκε ακόμα.`;
  }
  const newest = [...list].sort((a, b) => {
    const aa = ageMsFromIso(a.last_seen_at || a.lastSeenAt) ?? Number.POSITIVE_INFINITY;
    const bb = ageMsFromIso(b.last_seen_at || b.lastSeenAt) ?? Number.POSITIVE_INFINITY;
    return aa - bb;
  })[0];
  const plate = String(newest?.vehicle_code || newest?.vehicleCode || newest?.imei || '').trim();
  const age = ageMsFromIso(newest?.last_seen_at || newest?.lastSeenAt);
  const mins = age == null ? null : Math.max(1, Math.round(age / 60_000));
  const when =
    mins == null ? 'άγνωστο' : mins < 120 ? `πριν ${mins} λεπτά` : `πριν ${Math.round(mins / 60)} ώρες`;
  return `Το GPS οχήματος ${plate || ''} είναι offline (τελευταίο σήμα ${when}). Έλεγξε ρεύμα/SIM/κεραία και IP:5027 — το στίγμα εμφανίζεται μόνο με ζωντανό Codec.`.replace(
    /\s+/g,
    ' ',
  ).trim();
}
