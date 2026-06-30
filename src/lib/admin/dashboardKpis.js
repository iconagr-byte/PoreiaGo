function bookingAmount(booking) {
  const raw = booking?.amount ?? booking?.total ?? booking?.amountPaid ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function isCancelled(booking) {
  const s = String(booking?.status || '').toLowerCase();
  const ps = String(booking?.paymentStatus || '').toLowerCase();
  return s.includes('ακυρ') || s.includes('cancel') || ps.includes('cancel');
}

function isActiveBooking(booking) {
  if (isCancelled(booking)) return false;
  const s = String(booking?.status || '').toLowerCase();
  return (
    s.includes('επιβεβ') ||
    s.includes('confirm') ||
    s.includes('εκκρεμ') ||
    s.includes('pending') ||
    s.includes('ολοκληρ') ||
    s.includes('complete')
  );
}

function isFleetActive(vehicle) {
  const st = String(vehicle?.status || '').toLowerCase();
  return st.includes('ενεργ') || st.includes('active') || st === 'ok';
}

/** KPIs από πραγματικά bookings / trips / fleet — όχι mock. */
export function computeDashboardKpis({ bookings = [], trips = [], fleetVehicles = [] } = {}) {
  const today = new Date().toISOString().slice(0, 10);

  const nonCancelled = bookings.filter((b) => !isCancelled(b));
  const totalRevenue = nonCancelled.reduce((sum, b) => sum + bookingAmount(b), 0);
  const activeBookings = nonCancelled.filter(isActiveBooking).length;

  const fleetTotal = fleetVehicles.length;
  const fleetActive = fleetVehicles.filter(isFleetActive).length;
  const fleetStatus = fleetTotal ? `${fleetActive}/${fleetTotal} Ενεργά` : '—';

  const todayDepartures = trips.filter((t) => {
    if (!t?.departureTime) return false;
    try {
      return new Date(t.departureTime).toISOString().slice(0, 10) === today;
    } catch {
      return false;
    }
  }).length;

  return {
    totalRevenue: `€${totalRevenue.toLocaleString('el-GR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`,
    activeBookings,
    fleetStatus,
    todayDepartures,
  };
}
