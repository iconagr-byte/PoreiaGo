import { useEffect, useState } from 'react';
import { useResizableRailWidth } from '../../hooks/useResizableRailWidth.js';
import '../../styles/admin-resizable-rail.css';

function readUserCollapsed(storageKey) {
  if (!storageKey || typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(`${storageKey}_collapsed`) === '1';
  } catch {
    return false;
  }
}

/**
 * Desktop-resizable hub rail (left menu). Sticky while canvas scrolls;
 * optional collapse (top-right) frees horizontal space. Mobile stays stacked.
 */
export default function AdminResizableRail({
  storageKey,
  defaultWidth = 320,
  minWidth = 220,
  maxWidth = 480,
  /** Force-collapsed from parent (e.g. design mode). */
  collapsed = false,
  collapsible = true,
  expandLabel = 'Μενού',
  onExpand,
  onCollapse,
  className = '',
  children,
}) {
  const { width, onPointerDown } = useResizableRailWidth({
    storageKey,
    defaultWidth,
    minWidth,
    maxWidth,
  });

  const controlled = typeof onExpand === 'function' && typeof onCollapse === 'function';
  const [userCollapsed, setUserCollapsed] = useState(() =>
    controlled ? false : readUserCollapsed(storageKey),
  );

  useEffect(() => {
    if (controlled || !storageKey) return;
    try {
      localStorage.setItem(`${storageKey}_collapsed`, userCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [controlled, storageKey, userCollapsed]);

  // Parent-forced collapse (e.g. design mode) OR local preference.
  const effectiveCollapsed = controlled
    ? Boolean(collapsed)
    : Boolean(collapsed || (collapsible && userCollapsed));

  const expand = () => {
    if (!controlled) setUserCollapsed(false);
    onExpand?.();
  };

  const collapse = () => {
    if (!controlled) setUserCollapsed(true);
    onCollapse?.();
  };

  return (
    <>
      {effectiveCollapsed ? (
        <button
          type="button"
          className="admin-resizable-rail-expand"
          onClick={expand}
          title="Εμφάνιση μενού"
          aria-label="Εμφάνιση μενού"
        >
          <span className="material-symbols-outlined text-[20px]">menu_open</span>
          <span className="admin-resizable-rail-expand__label">{expandLabel}</span>
        </button>
      ) : null}

      <aside
        className={`admin-resizable-rail w-full shrink-0 self-start ${
          effectiveCollapsed
            ? 'admin-resizable-rail--collapsed'
            : 'admin-resizable-rail--sticky'
        } ${collapsible ? 'admin-resizable-rail--collapsible' : ''} ${className}`.trim()}
        style={
          effectiveCollapsed ? undefined : { ['--admin-rail-width']: `${width}px` }
        }
        aria-hidden={effectiveCollapsed || undefined}
      >
        {collapsible && !effectiveCollapsed ? (
          <button
            type="button"
            className="admin-resizable-rail-collapse"
            onClick={collapse}
            title="Μάζεμα μενού — περισσότερος χώρος"
            aria-label="Μάζεμα μενού"
          >
            <span className="material-symbols-outlined text-[18px]">left_panel_close</span>
          </button>
        ) : null}

        <div className="admin-resizable-rail-inner">{children}</div>

        {!effectiveCollapsed ? (
          <button
            type="button"
            className="admin-resizable-rail-handle"
            aria-label="Αλλαγή πλάτους μενού"
            title="Σύρετε αριστερά / δεξιά"
            onPointerDown={onPointerDown}
          >
            <span className="admin-resizable-rail-grip" aria-hidden />
          </button>
        ) : null}
      </aside>
    </>
  );
}
