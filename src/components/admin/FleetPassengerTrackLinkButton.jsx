import { useState } from 'react';
import toast from 'react-hot-toast';
import { createPassengerTrackLink } from '../../services/telemetryApi.js';

/**
 * Αντιγραφή signed passenger track link στο clipboard (για SMS/email σε επιβάτες).
 */
export default function FleetPassengerTrackLinkButton({
  tripId,
  className = '',
  compact = false,
  ttlHours = 72,
}) {
  const [loading, setLoading] = useState(false);

  if (tripId == null || tripId === '') return null;

  const handleCopy = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    setLoading(true);
    try {
      const data = await createPassengerTrackLink(tripId, { ttlHours });
      const url = data.url || data.path;
      if (!url) throw new Error('Κενό link');
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast.success('Track link αντιγράφηκε — στείλτε το στον επιβάτη');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αντιγραφής link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={loading}
      title="Αντιγραφή δημόσιου link παρακολούθησης για επιβάτες"
      className={
        className ||
        `inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-900 font-bold transition-colors hover:bg-sky-100 disabled:opacity-60 ${
          compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'
        }`
      }
    >
      <span className="material-symbols-outlined text-[16px]" aria-hidden>
        {loading ? 'hourglass_empty' : 'link'}
      </span>
      {compact ? 'Track link' : 'Αντιγραφή track link'}
    </button>
  );
}
