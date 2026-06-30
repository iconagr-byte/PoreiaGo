import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCustomerBookingTrackLink } from '../../services/customerBookingsApi.js';
import LiveEtaCountdown from './LiveEtaCountdown.jsx';

/**
 * CTA για ζωντανή παρακολούθηση λεωφορείου — wallet / booking detail.
 */
export default function PassengerTrackCTA({
  booking,
  showEta = true,
  compact = false,
  className = '',
}) {
  const [trackUrl, setTrackUrl] = useState(booking?.passengerTrackUrl || '');
  const [loading, setLoading] = useState(false);
  const tripId = Number(booking?.tripId);

  useEffect(() => {
    setTrackUrl(booking?.passengerTrackUrl || '');
  }, [booking?.id, booking?.passengerTrackUrl]);

  useEffect(() => {
    if (trackUrl || !booking?.id || !Number.isFinite(tripId) || tripId <= 0) return;
    let cancelled = false;
    setLoading(true);
    fetchCustomerBookingTrackLink(booking.id)
      .then((data) => {
        if (!cancelled && data?.url) setTrackUrl(data.url);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [booking?.id, tripId, trackUrl]);

  if (!Number.isFinite(tripId) || tripId <= 0) return null;

  const href = trackUrl || `/track/trip/${tripId}`;
  const isExternal = href.startsWith('http');

  const button = (
    <span
      className={`inline-flex items-center justify-center gap-2 font-bold transition-transform hover:scale-[1.02] ${
        compact
          ? 'px-4 py-2 rounded-full text-xs bg-slate-900 text-[#facc15] border border-[#facc15]/30'
          : 'w-full px-5 py-3.5 rounded-2xl text-sm bg-slate-900 text-[#facc15] border border-[#facc15]/35 shadow-md'
      }`}
    >
      <span className="material-symbols-outlined text-[20px]">share_location</span>
      {loading ? 'Φόρτωση…' : 'Ζωντανή παρακολούθηση λεωφορείου'}
    </span>
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {showEta && !compact ? <LiveEtaCountdown tripId={tripId} /> : null}
      {isExternal ? (
        <a href={href} target="_blank" rel="noreferrer" className="block">
          {button}
        </a>
      ) : (
        <Link to={href} className="block">
          {button}
        </Link>
      )}
      {!compact && (
        <p className="text-[11px] text-on-surface-variant leading-relaxed text-center">
          Θέση λεωφορείου, επόμενη στάση και ώρα άφιξης — ανανεώνεται live την ημέρα της εκδρομής.
        </p>
      )}
    </div>
  );
}
