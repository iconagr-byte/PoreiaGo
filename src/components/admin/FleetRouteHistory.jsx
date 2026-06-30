import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import FleetRoutePlayback from './FleetRoutePlayback.jsx';
import FleetRouteCompare from './FleetRouteCompare.jsx';
import FleetRoutePlannedVsActual from './FleetRoutePlannedVsActual.jsx';

/** Ιστορικό διαδρομών — αναπαραγωγή & σύγκριση. */
export default function FleetRouteHistory() {
  const location = useLocation();
  const subtabFromUrl = new URLSearchParams(location.search).get('subtab');
  const [tab, setTab] = useState(subtabFromUrl || 'playback');

  useEffect(() => {
    if (subtabFromUrl && ['playback', 'compare', 'planned'].includes(subtabFromUrl)) {
      setTab(subtabFromUrl);
    }
  }, [subtabFromUrl, location.search]);

  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap rounded-2xl border border-black/[0.06] bg-white p-1 gap-1">
        <button
          type="button"
          onClick={() => setTab('playback')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            tab === 'playback' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Αναπαραγωγή
        </button>
        <button
          type="button"
          onClick={() => setTab('compare')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            tab === 'compare' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Σύγκριση 2 διαδρομών
        </button>
        <button
          type="button"
          onClick={() => setTab('planned')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            tab === 'planned' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Planned vs Actual
        </button>
      </div>
      {tab === 'playback' ? (
        <FleetRoutePlayback />
      ) : tab === 'compare' ? (
        <FleetRouteCompare />
      ) : (
        <FleetRoutePlannedVsActual />
      )}
    </div>
  );
}
