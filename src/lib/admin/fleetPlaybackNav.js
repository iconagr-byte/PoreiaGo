/** Πλοήγηση σε playback διαδρομής οδηγού (σήμερα). */

export function localDayRangeIso(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Τελευταίες N ημέρες (συμπεριλαμβανομένης σήμερα). */
export function localDaysRangeIso(days = 7) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - Math.max(0, days - 1));
  start.setHours(0, 0, 0, 0);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function resolvePlaybackDateRange(dateKey, customDate = '') {
  if (dateKey === 'today') return localDayRangeIso();
  if (dateKey === '7d') return localDaysRangeIso(7);
  if (dateKey === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(customDate)) {
    const [y, m, d] = customDate.split('-').map(Number);
    return localDayRangeIso(new Date(y, m - 1, d));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return localDayRangeIso(new Date(y, m - 1, d));
  }
  return { from: undefined, to: undefined };
}

export function todayIsoDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function buildFleetPlaybackSearchParams({
  tripId,
  driverId,
  driverName,
  date = 'today',
  auto = true,
}) {
  const params = new URLSearchParams();
  params.set('tab', 'fleet_route_playback');
  params.set('subtab', 'playback');
  if (tripId != null && tripId !== '') params.set('trip_id', String(tripId));
  if (driverId) params.set('driver_id', String(driverId));
  if (driverName) params.set('driver_name', String(driverName));
  if (date) params.set('date', date);
  if (auto) params.set('auto', '1');
  return params;
}

/** Μεταβαίνει στο BackOffice playback για σημερινή διαδρομή οδηγού. */
export function navigateToDriverTodayPlayback(navigate, vehicle, { replace = false } = {}) {
  const tripId = vehicle?.trip_id ?? vehicle?.tripId;
  if (!tripId) return false;
  const params = buildFleetPlaybackSearchParams({
    tripId,
    driverId: vehicle?.driver_id ?? vehicle?.driverId,
    driverName: vehicle?.driver_name ?? vehicle?.driverName,
    date: 'today',
  });
  navigate(`/admin?${params.toString()}`, { replace });
  return true;
}

export function parsePlaybackFilters(searchParams) {
  const dateKey = searchParams.get('date') || 'all';
  let from;
  let to;
  if (dateKey === 'today') {
    ({ from, to } = localDayRangeIso());
  } else if (dateKey === '7d') {
    ({ from, to } = localDaysRangeIso(7));
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const [y, m, d] = dateKey.split('-').map(Number);
    ({ from, to } = localDayRangeIso(new Date(y, m - 1, d)));
  }
  return {
    tripId: searchParams.get('trip_id') || '',
    driverId: searchParams.get('driver_id') || '',
    driverName: searchParams.get('driver_name') || '',
    dateKey,
    from,
    to,
    autoLoad: searchParams.get('auto') === '1',
  };
}
