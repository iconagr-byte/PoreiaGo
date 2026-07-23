import { useEffect } from 'react';
import SortableSidebarNav from './SortableSidebarNav.jsx';
import OfficeBrandMark from '../storefront/OfficeBrandMark.jsx';

/**
 * Slide-over admin menu for viewports where the desktop aside is hidden (< md).
 */
export default function AdminMobileNavDrawer({
  open,
  onClose,
  activeTab,
  settingsSubTab,
  onTabChange,
  onSettingsSubTabChange,
  onEmailClick,
  onNavigate,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const go = (fn) => (...args) => {
    fn?.(...args);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[80] md:hidden" role="dialog" aria-modal="true" aria-label="Μενού γραφείου">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Κλείσιμο μενού"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 left-0 w-[min(100%,22rem)] bg-surface-container-lowest shadow-2xl border-r border-black/[0.06] flex flex-col animate-in slide-in-from-left duration-200">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-black/[0.05]">
          <OfficeBrandMark className="h-8" variant="light" asLink={false} fallbackLabel="Γραφείο" />
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
            aria-label="Κλείσιμο"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <SortableSidebarNav
          activeTab={activeTab}
          settingsSubTab={settingsSubTab}
          onTabChange={go(onTabChange)}
          onSettingsSubTabChange={onSettingsSubTabChange}
          onEmailClick={go(onEmailClick)}
          onNavigate={go(onNavigate)}
        />
      </aside>
    </div>
  );
}
