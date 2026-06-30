import { useNavigate } from 'react-router-dom';
import { navigateToDriverTodayPlayback } from '../../lib/admin/fleetPlaybackNav.js';

/** Κουμπί/σύνδεσμος — playback σημερινής διαδρομής οδηγού. */
export default function FleetDriverPlaybackButton({
  vehicle,
  variant = 'button',
  className = '',
  children = 'Διαδρομή σήμερα',
}) {
  const navigate = useNavigate();
  const tripId = vehicle?.trip_id ?? vehicle?.tripId;
  if (!tripId) return null;

  const handleClick = (e) => {
    e?.stopPropagation?.();
    navigateToDriverTodayPlayback(navigate, vehicle);
  };

  if (variant === 'link') {
    return (
      <button type="button" onClick={handleClick} className={`text-primary font-bold text-sm hover:underline ${className}`}>
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/15 transition-colors ${className}`}
    >
      <span className="material-symbols-outlined text-[16px]">route</span>
      {children}
    </button>
  );
}
