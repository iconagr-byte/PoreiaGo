/**
 * Fast opacity fade when admin menu / hub panels switch.
 * Remounts on `panelKey` so the animation always re-runs.
 */
export default function AdminMenuFade({ panelKey, children, className = '' }) {
  return (
    <div key={panelKey} className={`admin-menu-fade${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
