import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Virtual canvas widths so Desk/Tablet/Mobile reflect real device layouts.
 * The preview pane is often narrower than 900px — without a virtual canvas,
 * /rent and /wallet media queries stay in phone mode even when Desk is selected.
 */
const VIEWPORTS = [
  { id: 'desktop', label: 'Desktop', short: 'Desk', icon: 'desktop_windows', canvasWidth: 1280 },
  { id: 'tablet', label: 'Tablet', short: 'Tablet', icon: 'tablet_mac', canvasWidth: 768 },
  { id: 'phone', label: 'Mobile', short: 'Mobile', icon: 'smartphone', canvasWidth: 390 },
];

/** Scale a virtual device canvas into the available stage. Exported for tests. */
export function fitPreviewCanvas(stageWidth, viewportId, canvasWidth) {
  const stage = Math.max(0, Number(stageWidth) || 0);
  const base = Math.max(1, Number(canvasWidth) || 1);
  const id = String(viewportId || 'desktop');
  // Desktop fills a wide pane; still keeps ≥1280 when the pane is narrow so media queries win.
  const width = id === 'desktop' ? Math.max(base, stage || base) : base;
  const scale = stage > 0 ? Math.min(1, stage / width) : 1;
  return { canvasWidth: width, scale };
}

/**
 * Embedded live preview of the office storefront / rent page.
 * Draft sync happens via homepagePreview (localStorage + BroadcastChannel).
 * Hard remount only when src / design page / explicit refresh / viewport changes.
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
  const [stageWidth, setStageWidth] = useState(0);
  const loadTimerRef = useRef(null);
  const stageRef = useRef(null);
  const vp = VIEWPORTS.find((v) => v.id === viewport) || VIEWPORTS[0];
  const { canvasWidth, scale } = fitPreviewCanvas(stageWidth, viewport, vp.canvasWidth);

  const src = useMemo(() => {
    const base = String(previewSrc || '').trim() || '/storefront?preview=1';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}_pdw=${frameKey || 0}&vp=${encodeURIComponent(viewport)}`;
  }, [previewSrc, frameKey, viewport]);

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
    // Viewport change remounts the iframe via key/src (`vp=`) — show loading chrome.
    setLoading(true);
  }, [viewport]);

  useEffect(() => {
    return () => {
      if (loadTimerRef.current) window.clearTimeout(loadTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth || 0;
      setStageWidth((prev) => (prev === w ? prev : w));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const chromePath =
    previewPathLabel ||
    (designPage === 'rent'
      ? '/rent?preview=1'
      : designPage === 'wallet'
        ? '/wallet?preview=1'
        : '/storefront?preview=1');

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

  const frameHeight =
    scale > 0 && scale < 1 ? `${(100 / scale).toFixed(4)}%` : '100%';

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
          {viewport === 'desktop'
            ? ' · πλήρες πλάτος'
            : ` · ${vp.canvasWidth}px`}
        </span>
        <span className="page-design-wizard__preview-sync">
          {loading ? 'Φόρτωση…' : 'Συγχρονισμένο draft · Builder στις ενότητες'}
        </span>
      </div>

      <div
        ref={stageRef}
        className="page-design-wizard__preview-stage"
        data-viewport={viewport}
      >
        {loading ? (
          <div className="page-design-wizard__preview-loading" aria-live="polite">
            <span className="material-symbols-outlined animate-spin text-[22px]">
              progress_activity
            </span>
            Φόρτωση προεπισκόπησης…
          </div>
        ) : null}
        {stageWidth > 0 ? (
          <div
            className={`page-design-wizard__preview-scaler is-${viewport}`}
            style={{
              width: canvasWidth * scale,
              maxWidth: '100%',
              height: viewport === 'desktop' ? '100%' : 'calc(100% - 16px)',
            }}
          >
            <div
              className={`page-design-wizard__preview-frame is-${viewport}`}
              style={{
                width: canvasWidth,
                height: frameHeight,
                transform: scale < 1 ? `scale(${scale})` : undefined,
                transformOrigin: 'top left',
              }}
            >
              <iframe
                key={`${designPage}-${frameKey}-${viewport}`}
                title="Ζωντανή προεπισκόπηση ιστοσελίδας"
                src={src}
                className="page-design-wizard__preview-iframe"
                onLoad={onIframeLoad}
              />
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
