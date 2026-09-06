import { useResizableRailWidth } from '../../hooks/useResizableRailWidth.js';
import '../../styles/admin-resizable-rail.css';

/**
 * Desktop-resizable hub rail (left menu). Mobile stays full-width stacked.
 */
export default function AdminResizableRail({
  storageKey,
  defaultWidth = 320,
  minWidth = 220,
  maxWidth = 480,
  collapsed = false,
  className = '',
  children,
}) {
  const { width, onPointerDown } = useResizableRailWidth({
    storageKey,
    defaultWidth,
    minWidth,
    maxWidth,
  });

  return (
    <aside
      className={`admin-resizable-rail w-full shrink-0 self-start ${
        collapsed ? 'admin-resizable-rail--collapsed' : 'lg:sticky lg:top-3'
      } ${className}`.trim()}
      style={collapsed ? undefined : { ['--admin-rail-width']: `${width}px` }}
      aria-hidden={collapsed || undefined}
    >
      <div className="admin-resizable-rail-inner">{children}</div>
      {!collapsed ? (
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
  );
}
