import { useEffect, useMemo, useState } from 'react';

const VIEWPORTS = [
  { id: 'desktop', label: 'Desktop', icon: 'desktop_windows', width: '100%' },
  { id: 'tablet', label: 'Tablet', icon: 'tablet_mac', width: '768px' },
  { id: 'phone', label: 'Mobile', icon: 'smartphone', width: '390px' },
];

/**
 * Embedded live preview of the office storefront / rent page.
 * Draft sync happens via homepagePreview (localStorage + BroadcastChannel).
 */
export default function PageDesignLivePreview({
  previewSrc,
  previewPathLabel,
  designPage = 'home',
  refreshToken = 0,
  expanded = false,
}) {
  const [viewport, setViewport] = useState('desktop');
  const [loading, setLoading] = useState(true);
  const [frameKey, setFrameKey] = useState(0);
  const vp = VIEWPORTS.find((v) => v.id === viewport) || VIEWPORTS[0];

  const src = useMemo(() => {
    const base = String(previewSrc || '').trim() || '/storefront?preview=1';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}_pdw=${frameKey || 0}`;
  }, [previewSrc, frameKey]);

  useEffect(() => {
    setLoading(true);
    setFrameKey((k) => k + 1);
  }, [previewSrc, designPage]);

  useEffect(() => {
    if (!refreshToken) return;
    // Soft bump so the iframe remounts after save / asset upload.
    setLoading(true);
    setFrameKey((k) => k + 1);
  }, [refreshToken]);

  const chromePath =
    previewPathLabel ||
    (designPage === 'rent' ? '/rent?preview=1' : '/storefront?preview=1');

  return (
    <aside
      className={`page-design-wizard__preview-pane${expanded ? ' is-expanded' : ''}`}
      aria-label="Ζωντανή προεπισκόπηση"
    >
      <div className="page-design-wizard__preview-chrome">
        <div className="page-design-wizard__preview-url" title={chromePath}>
          <span className="material-symbols-outlined text-[15px] opacity-60">lock</span>
          <span className="truncate">{chromePath}</span>
        </div>
        <div className="page-design-wizard__preview-viewports" role="group" aria-label="Προβολή">
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
            </button>
          ))}
          <button
            type="button"
            title="Ανανέωση προεπισκόπησης"
            aria-label="Ανανέωση προεπισκόπησης"
            onClick={() => {
              setLoading(true);
              setFrameKey((k) => k + 1);
            }}
            className="page-design-wizard__preview-vp"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </div>

      <div className="page-design-wizard__preview-stage">
        {loading ? (
          <div className="page-design-wizard__preview-loading" aria-live="polite">
            <span className="material-symbols-outlined animate-spin text-[22px]">
              progress_activity
            </span>
            Φόρτωση προεπισκόπησης…
          </div>
        ) : null}
        <div
          className="page-design-wizard__preview-frame"
          style={{
            width: vp.width,
            maxWidth: '100%',
            borderRadius: viewport === 'desktop' ? 0 : 14,
            height: viewport === 'desktop' ? '100%' : 'calc(100% - 16px)',
            margin: viewport === 'desktop' ? 0 : '8px auto',
            boxShadow:
              viewport === 'desktop'
                ? 'none'
                : '0 0 0 1px rgba(0,0,0,0.08), 0 18px 48px rgba(15,23,42,0.18)',
          }}
        >
          <iframe
            key={`${designPage}-${frameKey}`}
            title="Ζωντανή προεπισκόπηση ιστοσελίδας"
            src={src}
            className="page-design-wizard__preview-iframe"
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>
    </aside>
  );
}
