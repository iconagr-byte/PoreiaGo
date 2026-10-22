import { useEffect, useMemo, useRef, useState } from 'react';

const VIEWPORTS = [
  { id: 'desktop', label: 'Desktop', short: 'Desk', icon: 'desktop_windows', width: '100%' },
  { id: 'tablet', label: 'Tablet', short: 'Tablet', icon: 'tablet_mac', width: '768px' },
  { id: 'phone', label: 'Mobile', short: 'Mobile', icon: 'smartphone', width: '390px' },
];

/**
 * Embedded live preview of the office storefront / rent page.
 * Draft sync happens via homepagePreview (localStorage + BroadcastChannel).
 * Hard remount only when src / design page / explicit refresh changes — not on every draft edit.
 *
 * Section editing uses Divi-like inline Builder controls inside the iframe
 * (?preview=1), not a chrome toolbar button.
 */
export default function PageDesignLivePreview({
  previewSrc,
  previewPathLabel,
  designPage = 'home',
  refreshToken = 0,
  expanded = false,
  narrowOverlay = false,
  onCloseNarrow,
}) {
  const [viewport, setViewport] = useState('desktop');
  const [loading, setLoading] = useState(true);
  const [frameKey, setFrameKey] = useState(0);
  const loadTimerRef = useRef(null);
  const vp = VIEWPORTS.find((v) => v.id === viewport) || VIEWPORTS[0];

  const src = useMemo(() => {
    const base = String(previewSrc || '').trim() || '/storefront?preview=1';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}_pdw=${frameKey || 0}`;
  }, [previewSrc, frameKey]);

  const bumpFrame = () => {
    setLoading(true);
    setFrameKey((k) => k + 1);
  };

  useEffect(() => {
    bumpFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount when target page changes
  }, [previewSrc, designPage]);

  useEffect(() => {
    if (!refreshToken) return;
    // Soft bump so the iframe remounts after save / asset upload.
    bumpFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  useEffect(() => {
    return () => {
      if (loadTimerRef.current) window.clearTimeout(loadTimerRef.current);
    };
  }, []);

  const chromePath =
    previewPathLabel ||
    (designPage === 'rent' ? '/rent?preview=1' : '/storefront?preview=1');

  const onIframeLoad = () => {
    // Brief delay so the overlay doesn't flash on fast loads.
    if (loadTimerRef.current) window.clearTimeout(loadTimerRef.current);
    loadTimerRef.current = window.setTimeout(() => {
      setLoading(false);
    }, 120);
  };

  const paneClass = [
    'page-design-wizard__preview-pane',
    expanded ? 'is-expanded' : '',
    narrowOverlay ? 'is-narrow-overlay' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside className={paneClass} aria-label="Ζωντανή προεπισκόπηση">
      <div className="page-design-wizard__preview-chrome">
        <div className="page-design-wizard__preview-url" title={chromePath}>
          <span className="material-symbols-outlined text-[15px] opacity-60">lock</span>
          <span className="truncate">{chromePath}</span>
        </div>
        <div className="page-design-wizard__preview-chrome-right">
          <div className="page-design-wizard__preview-viewports" role="group" aria-label="Συσκευή">
            {VIEWPORTS.map((v) => (
              <button
                key={v.id}
                type="button"
                title={v.label}
                aria-pressed={viewport === v.id}
                onClick={() => setViewport(v.id)}
                className={`page-design-wizard__preview-vp${viewport === v.id ? ' is-active' : ''}`}
              >
                <span className="material-symbols-outlined text-[18px]">{v.icon}</span>
                <span className="page-design-wizard__preview-vp-label">{v.short}</span>
              </button>
            ))}
            <button
              type="button"
              title="Ανανέωση προεπισκόπησης"
              aria-label="Ανανέωση προεπισκόπησης"
              onClick={bumpFrame}
              className="page-design-wizard__preview-vp"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
          </div>
          {narrowOverlay && onCloseNarrow ? (
            <button
              type="button"
              className="page-design-wizard__preview-close"
              onClick={onCloseNarrow}
              title="Κλείσιμο προεπισκόπησης"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              Επεξεργασία
            </button>
          ) : null}
        </div>
      </div>

      <div className="page-design-wizard__preview-meta" aria-live="polite">
        <span className="page-design-wizard__preview-device-pill">
          <span className="material-symbols-outlined text-[14px]">{vp.icon}</span>
          {vp.label}
          {viewport !== 'desktop' ? ` · ${vp.width}` : ' · πλήρες πλάτος'}
        </span>
        <span className="page-design-wizard__preview-sync">
          {loading ? 'Φόρτωση…' : 'Συγχρονισμένο draft · Builder στις ενότητες'}
        </span>
      </div>

      <div className="page-design-wizard__preview-stage" data-viewport={viewport}>
        {loading ? (
          <div className="page-design-wizard__preview-loading" aria-live="polite">
            <span className="material-symbols-outlined animate-spin text-[22px]">
              progress_activity
            </span>
            Φόρτωση προεπισκόπησης…
          </div>
        ) : null}
        <div
          className={`page-design-wizard__preview-frame is-${viewport}`}
          style={{
            width: vp.width,
            maxWidth: '100%',
          }}
        >
          <iframe
            key={`${designPage}-${frameKey}`}
            title="Ζωντανή προεπισκόπηση ιστοσελίδας"
            src={src}
            className="page-design-wizard__preview-iframe"
            onLoad={onIframeLoad}
          />
        </div>
      </div>
    </aside>
  );
}
