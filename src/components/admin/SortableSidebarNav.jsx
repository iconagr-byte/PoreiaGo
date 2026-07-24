import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadNavLayout,
  moveNavItem,
  navItemsFromIds,
  saveNavLayout,
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
  const [dragState, setDragState] = useState({
    section: null,
    fromSection: null,
    overIndex: null,
    draggingId: null,
  });

  useEffect(() => {
    setLayout(loadNavLayout(superAdmin));
  }, [superAdmin]);

  const sections = useMemo(() => {
    const visible = SECTIONS.filter((s) => !s.superOnly || superAdmin);
    return visible.map((section) => ({
      ...section,
      order: layout[section.id] || [],
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
    setDragState({ section: null, fromSection: null, overIndex: null, draggingId: null });
    if (!draggingId) return;
    if (sectionId === 'platform' && !superAdmin) return;
    persistLayout(moveNavItem(layout, draggingId, sectionId, dropIndex));
  };

  const onDragStart = (sectionId, id, e) => {
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    } catch {
      /* some browsers */
    }
    setDragState({ section: sectionId, fromSection: sectionId, overIndex: null, draggingId: id });
  };

  const clearDrag = () => {
    setDragState({ section: null, fromSection: null, overIndex: null, draggingId: null });
  };

  const markDropTarget = (sectionId, overIndex) => {
    setDragState((prev) => {
      if (!prev.draggingId) return prev;
      if (prev.section === sectionId && prev.overIndex === overIndex) return prev;
      return { ...prev, section: sectionId, overIndex };
    });
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

  const navAccent = (item) =>
    item.accent || (item.variant === 'rose' ? 'rose' : item.variant === 'driver' ? 'teal' : 'indigo');

  const renderRow = (item, sectionId, { nested = false } = {}) => {
    const dragging = dragState.draggingId === item.id;
    return (
      <div className={`admin-nav-row ${dragging ? 'admin-nav-row-dragging' : ''} ${nested ? 'admin-nav-row-nested' : ''}`}>
        <span
          className="admin-nav-grip"
          draggable
          onDragStart={(e) => onDragStart(sectionId, item.id, e)}
          onDragEnd={clearDrag}
          title="Σύρετε σε οποιαδήποτε ενότητα"
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
    const isDropTarget = dragState.draggingId && dragState.section === section.id;

    return (
      <div
        key={section.id}
        className={`admin-nav-section ${isPlatformSection ? 'admin-nav-section-platform' : ''} ${
          isSettingsSection ? 'admin-nav-section-settings' : ''
        } ${isFleetOpsSection ? 'admin-nav-section-fleet' : ''} ${
          isDropTarget ? 'admin-nav-section-drop-target' : ''
        }`}
        onDragOver={(e) => {
          if (!dragState.draggingId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (section.items.length === 0) markDropTarget(section.id, 0);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (section.items.length === 0) handleDrop(section.id, 0);
        }}
      >
        <p
          className={`admin-nav-section-label ${
            isPlatformSection ? 'admin-nav-section-label-platform' : ''
          } ${isSettingsSection ? 'admin-nav-section-label-settings' : ''}`}
        >
          {section.label}
        </p>

        <ul className="admin-nav-list">
          {section.items.length === 0 && (
            <li
              className={`admin-nav-item admin-nav-empty-drop ${
                isDropTarget && dragState.overIndex === 0 ? 'admin-nav-drop-end-active' : ''
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                markDropTarget(section.id, 0);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(section.id, 0);
              }}
            >
              <p className="admin-nav-empty-hint">Αφήστε εδώ</p>
              {isDropTarget && dragState.overIndex === 0 && (
                <div className="admin-nav-drop-line" aria-hidden />
              )}
            </li>
          )}
          {section.items.map((item, idx) => (
            <li key={item.id} className="admin-nav-item">
              {isDropTarget && dragState.overIndex === idx && (
                <div className="admin-nav-drop-line" aria-hidden />
              )}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  markDropTarget(section.id, idx);
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
          {section.items.length > 0 && (
            <li
              className={`admin-nav-item ${
                isDropTarget && dragState.overIndex === section.items.length
                  ? 'admin-nav-drop-end-active'
                  : ''
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                markDropTarget(section.id, section.items.length);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(section.id, section.items.length);
              }}
            >
              {isDropTarget && dragState.overIndex === section.items.length && (
                <div className="admin-nav-drop-line" aria-hidden />
              )}
            </li>
          )}
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
        <p className="admin-nav-hint">Σύρετε ⋮⋮ σε οποιαδήποτε ενότητα</p>
        {sections.map((section) => renderSection(section))}
      </div>
    </nav>
  );
}
