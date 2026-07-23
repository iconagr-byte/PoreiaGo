import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DND_NAV_ID,
  loadNavLayout,
  navItemsFromIds,
  reorderNav,
  saveNavLayout,
  updateSectionOrder,
} from '../../lib/admin/sidebarNav.js';
import { DEFAULT_TENANT_SETTINGS_TAB, sanitizeSettingsSubTab } from '../../lib/admin/settingsTabs.js';
import { isSaasSuperAdmin } from '../../lib/saasJwt.js';

const SECTIONS = [
  { id: 'main', label: 'Λειτουργίες' },
  { id: 'fleet_ops', label: 'Λειτουργίες Στόλου' },
  { id: 'platform', label: 'Πλατφόρμα SaaS', superOnly: true },
  { id: 'settings', label: 'Ρυθμίσεις' },
];

export default function SortableSidebarNav({
  activeTab,
  settingsSubTab,
  onTabChange,
  onSettingsSubTabChange,
  onEmailClick,
  onNavigate,
}) {
  const superAdmin = isSaasSuperAdmin();
  const [layout, setLayout] = useState(() => loadNavLayout(superAdmin));
  const [dragState, setDragState] = useState({ section: null, overIndex: null, draggingId: null });

  useEffect(() => {
    setLayout(loadNavLayout(superAdmin));
  }, [superAdmin]);

  const sections = useMemo(() => {
    const visible = SECTIONS.filter((s) => !s.superOnly || superAdmin);
    return visible.map((section) => ({
      ...section,
      order: layout[section.id] || [],
      // Belt-and-suspenders: never render platform-only items for tenant offices.
      items: navItemsFromIds(layout[section.id] || [], superAdmin).filter(
        (item) => superAdmin || item.settingsSection !== 'platform',
      ),
    }));
  }, [layout, superAdmin]);

  const persistLayout = useCallback(
    (next) => {
      setLayout(next);
      saveNavLayout(superAdmin, next);
    },
    [superAdmin],
  );

  const handleDrop = (sectionId, dropIndex) => {
    const { draggingId } = dragState;
    setDragState({ section: null, overIndex: null, draggingId: null });
    if (!draggingId) return;
    const current = layout[sectionId] || [];
    persistLayout(updateSectionOrder(layout, sectionId, reorderNav(current, draggingId, dropIndex)));
  };

  const onDragStart = (sectionId, id) => {
    setDragState({ section: sectionId, overIndex: null, draggingId: id });
  };

  const clearDrag = () => {
    setDragState({ section: null, overIndex: null, draggingId: null });
  };

  const openSettings = (subTab) => {
    onSettingsSubTabChange?.(sanitizeSettingsSubTab(subTab, superAdmin));
    onTabChange?.('settings');
  };

  const handleClick = (item) => {
    if (item.type === 'email') {
      onEmailClick?.();
      return;
    }
    if (item.type === 'navigate' && item.path) {
      onNavigate?.(item.path);
      return;
    }
    if (item.type === 'settings_subtab') {
      openSettings(item.settingsSubTab || DEFAULT_TENANT_SETTINGS_TAB);
      return;
    }
    onTabChange?.(item.tab || item.id);
  };

  const buttonClass = (item) => {
    const isSettingsSubActive =
      item.type === 'settings_subtab' &&
      activeTab === 'settings' &&
      settingsSubTab === item.settingsSubTab;
    const isTabActive = item.type === 'tab' && activeTab === item.tab;
    const isEmailActive = item.type === 'email' && activeTab === 'email';
    const isActive = isSettingsSubActive || isTabActive || isEmailActive;

    const classes = ['admin-nav-btn'];
    if (isActive) {
      classes.push('admin-nav-btn-active');
      if (item.settingsSection === 'platform') classes.push('admin-nav-btn-platform');
    }
    return classes.join(' ');
  };

  const navAccent = (item) => item.accent || (item.variant === 'rose' ? 'rose' : item.variant === 'driver' ? 'teal' : 'indigo');

  const renderRow = (item, sectionId, { nested = false } = {}) => {
    const dragging = dragState.draggingId === item.id;
    return (
      <div className={`admin-nav-row ${dragging ? 'admin-nav-row-dragging' : ''} ${nested ? 'admin-nav-row-nested' : ''}`}>
        <span
          className="admin-nav-grip"
          draggable
          onDragStart={() => onDragStart(sectionId, item.id)}
          onDragEnd={clearDrag}
          title="Σύρετε για αναδιάταξη"
          aria-label="Σύρετε μενού"
        >
          <span className="material-symbols-outlined">drag_indicator</span>
        </span>
        <button
          type="button"
          onClick={() => handleClick(item)}
          className={buttonClass(item)}
          data-accent={navAccent(item)}
          title={item.label}
        >
          <span className="admin-nav-icon">
            <span
              className="material-symbols-outlined"
              style={item.filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
          </span>
          <span className="admin-nav-label">{item.label}</span>
        </button>
      </div>
    );
  };

  const renderSection = (section) => {
    const isSettingsSection = section.id === 'settings';
    const isFleetOpsSection = section.id === 'fleet_ops';
    const isPlatformSection = section.id === 'platform';

    return (
      <div
        key={section.id}
        className={`admin-nav-section ${isPlatformSection ? 'admin-nav-section-platform' : ''} ${
          isSettingsSection ? 'admin-nav-section-settings' : ''
        } ${isFleetOpsSection ? 'admin-nav-section-fleet' : ''}`}
      >
        <p
          className={`admin-nav-section-label ${
            isPlatformSection ? 'admin-nav-section-label-platform' : ''
          } ${isSettingsSection ? 'admin-nav-section-label-settings' : ''}`}
        >
          {section.label}
        </p>

        <ul className="admin-nav-list">
          {section.items.map((item, idx) => (
            <li key={item.id} className="admin-nav-item">
              {dragState.section === section.id && dragState.overIndex === idx && (
                <div className="admin-nav-drop-line" aria-hidden />
              )}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragState((prev) => ({ ...prev, section: section.id, overIndex: idx }));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(section.id, idx);
                }}
              >
                {renderRow(item, section.id, { nested: isSettingsSection || isFleetOpsSection })}
              </div>
            </li>
          ))}
          <li
            className={`admin-nav-item ${
              dragState.section === section.id && dragState.overIndex === section.items.length
                ? 'admin-nav-drop-end-active'
                : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragState((prev) => ({
                ...prev,
                section: section.id,
                overIndex: section.items.length,
              }));
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(section.id, section.items.length);
            }}
          >
            {dragState.section === section.id && dragState.overIndex === section.items.length && (
              <div className="admin-nav-drop-line" aria-hidden />
            )}
          </li>
        </ul>
      </div>
    );
  };

  return (
    <nav
      className="admin-sidebar-nav flex-1 flex flex-col min-h-0"
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setDragState((prev) => ({ ...prev, overIndex: null }));
        }
      }}
    >
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-2.5 py-2 space-y-3 admin-nav-scroll">
        <p className="admin-nav-hint">Σύρετε ⋮⋮ μέσα σε κάθε ενότητα</p>
        {sections.map((section) => renderSection(section))}
      </div>
    </nav>
  );
}
