import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

export default function DesignLivePreview({ previewTo = '/storefront?preview=1', refreshKey = 0 }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setTick((t) => t + 1), 280);
    return () => window.clearTimeout(id);
  }, [refreshKey]);

  const src = useMemo(() => {
    const url = new URL(previewTo, window.location.origin);
    url.searchParams.set('embed', '1');
    url.searchParams.set('_pdw', String(refreshKey + tick));
    return url.pathname + url.search;
  }, [previewTo, refreshKey, tick]);

  return (
    <aside className="pdw-live-preview" aria-label="Ζωντανή προεπισκόπηση">
      <div className="pdw-live-preview__chrome">
        <span>Live preview</span>
        <span className="text-white/40">·</span>
        <span>Αρχική γραφείου</span>
      </div>
      <div className="pdw-live-preview__frame-wrap">
        <iframe
          key={src}
          title="Προεπισκόπηση αρχικής σελίδας"
          src={src}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
      <div className="pdw-live-preview__actions">
        <button
          type="button"
          className="pdw-live-preview__btn"
          onClick={() => setTick((t) => t + 1)}
        >
          <span className="material-symbols-outlined text-[15px]">refresh</span>
          Ανανέωση
        </button>
        <Link to={previewTo} target="_blank" className="pdw-live-preview__btn is-primary">
          <span className="material-symbols-outlined text-[15px]">open_in_new</span>
          Νέο tab
        </Link>
      </div>
    </aside>
  );
}
