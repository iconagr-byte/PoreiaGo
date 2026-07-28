import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadNavLayout,
  moveNavItem,
  navItemsFromIds,
  navLayoutForOfficeMode,
  saveNavLayout,
} from '../../lib/admin/sidebarNav.js';
import { DEFAULT_TENANT_SETTINGS_TAB, sanitizeSettingsSubTab } from '../../lib/admin/settingsTabs.js';
import { DEFAULT_RENT_DESK_TAB, sanitizeRentDeskTab } from '../../lib/admin/rentDeskNav.js';
import { isSaasSuperAdmin } from '../../lib/saasJwt.js';

const SECTIONS = [
  { id: 'main', label: 'Λειτουργίες' },
  { id: 'rent', label: 'Ενοικιάσεις' },
  { id: 'fleet_ops', label: 'Στόλος', collapsible: true, defaultCollapsed: true },
  { id: 'platform', label: 'Πλατφόρμα SaaS', superOnly: true },
  { id: 'settings', label: 'Ρυθμίσεις', collapsible: true, defaultCollapsed: false },
];

const COLLAPSE_STORAGE_KEY = 'poreiago_admin_nav_collapsed_v1';

function loadCollapsedMap() {
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveCollapsedMap(map) {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export default function SortableSidebarNav({
  activeTab,
  settingsSubTab,
  fleetRentalTab,
  onTabChange,
  onSettingsSubTabChange,
  onFleetRentalTabChange,
  onEmailClick,
  onNavigate,
  officeMode = 'trips_only',
}) {
  const superAdmin = isSaasSuperAdmin();
  const rentOnly = officeMode === 'rent_only';
  const [layout, setLayout] = useState(() => loadNavLayout(superAdmin));
  const [collapsed, setCollapsed] = useState(() => loadCollapsedMap());
  const [dragState, setDragState] = useState({
    section: null,
    fromSection: null,
    overIndex: null,
    draggingId: null,
  });

  useEffect(() => {
    setLayout(loadNavLayout(superAdmin));
  }, [superAdmin]);

  const displayLayout = useMemo(
    () => navLayoutForOfficeMode(layout, officeMode, superAdmin),
    [layout, officeMode, superAdmin],
  );

  const sections = useMemo(() => {
    const visible = SECTIONS.filter((s) => {
      if (s.superOnly && !superAdmin) return false;
      if (rentOnly && s.id === 'fleet_ops') return false;
      return true;
    });
    return visible
      .map((section) => ({
        ...section,
        label: rentOnly && section.id === 'main' ? 'Γραφείο' : section.label,
        order: displayLayout[section.id] || [],
        items: navItemsFromIds(displayLayout[section.id] || [], superAdmin).filter(
          (item) => superAdmin || item.settingsSection !== 'platform',
        ),
      }))
      .filter((section) => section.items.length > 0 || (!rentOnly && section.id !== 'fleet_ops'));
  }, [displayLayout, superAdmin, rentOnly]);

  const isItemActive = useCallback(
    (item) => {
      if (item.type === 'settings_subtab') {
        return activeTab === 'settings' && settingsSubTab === item.settingsSubTab;
      }
      if (item.type === 'fleet_rental_subtab') {
        return (
          activeTab === 'fleet_rental' &&
          sanitizeRentDeskTab(fleetRentalTab) === item.fleetRentalTab
        );
      }
      if (item.type === 'tab') return activeTab === item.tab;
      if (item.type === 'email') return activeTab === 'email';
      return false;
    },
    [activeTab, settingsSubTab, fleetRentalTab],
  );

  const isSectionCollapsed = useCallback(
    (section) => {
      if (!section.collapsible) return false;
      // Keep open when an item inside is active so the user sees context.
      if (section.items.some((item) => isItemActive(item))) return false;
      if (Object.prototype.hasOwnProperty.call(collapsed, section.id)) {
        return Boolean(collapsed[section.id]);
      }
      return Boolean(section.defaultCollapsed);
    },
    [collapsed, isItemActive],
  );

  const toggleSection = (sectionId) => {
    setCollapsed((prev) => {
      const section = SECTIONS.find((s) => s.id === sectionId);
      const currently =
        Object.prototype.hasOwnProperty.call(prev, sectionId)
          ? Boolean(prev[sectionId])
          : Boolean(section?.defaultCollapsed);
      const next = { ...prev, [sectionId]: !currently };
      saveCollapsedMap(next);
      return next;
    });
  };
  const persistLayout = useCallback(
    (next) => {
      // Rent-only menu is fixed by contract — don't overwrite the full-office layout.
      if (rentOnly) return;
      setLayout(next);
      saveNavLayout(superAdmin, next);
    },
    [superAdmin, rentOnly],
  );

  const handleDrop = (sectionId, dropIndex) => {
    const { draggingId } = dragState;
    setDragState({ section: null, fromSection: null, overIndex: null, draggingId: null });
    if (!draggingId || rentOnly) return;
    if (sectionId === 'platform' && !superAdmin) return;
    persistLayout(moveNavItem(layout, draggingId, sectionId, dropIndex));
  };

  const onDragStart = (sectionId, id, e) => {
    if (rentOnly) {
      e.preventDefault();
      return;
    }
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
    if (rentOnly) return;
    setDragState((prev) => {
      if (!prev.draggingId) return prev;
      if (prev.section === sectionId && prev.overIndex === overIndex) return prev;
      return { ...prev, section: sectionId, overIndex };
    });
  };

  const openSettings = (subTab) => {
    onSettingsSubTabChange?.(sanitizeSettingsSubTab(subTab, superAdmin, officeMode));
    onTabChange?.('settings');
  };

  const openRentDesk = (subTab) => {
    onFleetRentalTabChange?.(sanitizeRentDeskTab(subTab));
    onTabChange?.('fleet_rental');
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
    if (item.type === 'fleet_rental_subtab') {
      openRentDesk(item.fleetRentalTab || DEFAULT_RENT_DESK_TAB);
      return;
    }
    onTabChange?.(item.tab || item.id);
  };

  const buttonClass = (item) => {
    const isActive = isItemActive(item);

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
        {!rentOnly ? (
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
        ) : (
          <span className="admin-nav-grip admin-nav-grip-static" aria-hidden />
        )}
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
          <span className="admin-nav-label">{item.shortLabel || item.label}</span>
        </button>
      </div>
    );
  };

  const renderSection = (section) => {
    const isSettingsSection = section.id === 'settings';
    const isRentSection = section.id === 'rent';
    const isFleetOpsSection = section.id === 'fleet_ops';
    const isPlatformSection = section.id === 'platform';
    const isDropTarget = !rentOnly && dragState.draggingId && dragState.section === section.id;
    const sectionCollapsed = isSectionCollapsed(section);
    const activeCount = section.items.filter((item) => isItemActive(item)).length;

    return (
      <div
        key={section.id}
        className={`admin-nav-section ${isPlatformSection ? 'admin-nav-section-platform' : ''} ${
          isSettingsSection ? 'admin-nav-section-settings' : ''
        } ${isRentSection ? 'admin-nav-section-rent' : ''} ${
          isFleetOpsSection ? 'admin-nav-section-fleet' : ''
        } ${sectionCollapsed ? 'admin-nav-section-collapsed' : ''} ${
          isDropTarget ? 'admin-nav-section-drop-target' : ''
        }`}
        onDragOver={(e) => {
          if (rentOnly || !dragState.draggingId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          // Expand collapsed targets while dragging so items can be dropped.
          if (section.collapsible && sectionCollapsed) {
            setCollapsed((prev) => {
              if (prev[section.id] === false) return prev;
              const next = { ...prev, [section.id]: false };
              saveCollapsedMap(next);
              return next;
            });
          }
          if (section.items.length === 0) markDropTarget(section.id, 0);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (rentOnly) return;
          if (section.items.length === 0) handleDrop(section.id, 0);
        }}
      >
        {section.collapsible ? (
          <button
            type="button"
            className={`admin-nav-section-label admin-nav-section-toggle ${
              isPlatformSection ? 'admin-nav-section-label-platform' : ''
            } ${isSettingsSection ? 'admin-nav-section-label-settings' : ''} ${
              isRentSection ? 'admin-nav-section-label-rent' : ''
            } ${isFleetOpsSection ? 'admin-nav-section-label-fleet' : ''}`}
            onClick={() => toggleSection(section.id)}
            aria-expanded={!sectionCollapsed}
          >
            <span className="admin-nav-section-toggle-text">
              {section.label}
              <span className="admin-nav-section-count">{section.items.length}</span>
            </span>
            <span className="material-symbols-outlined admin-nav-section-chevron" aria-hidden>
              {sectionCollapsed ? 'expand_more' : 'expand_less'}
            </span>
          </button>
        ) : (
          <p
            className={`admin-nav-section-label ${
              isPlatformSection ? 'admin-nav-section-label-platform' : ''
            } ${isSettingsSection ? 'admin-nav-section-label-settings' : ''} ${
              isRentSection ? 'admin-nav-section-label-rent' : ''
            }`}
          >
            {section.label}
          </p>
        )}

        {!sectionCollapsed ? (
        <ul className="admin-nav-list">
          {section.items.length === 0 && !rentOnly && (
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
                  if (rentOnly) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  markDropTarget(section.id, idx);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(section.id, idx);
                }}
              >
                {renderRow(item, section.id, {
                  nested: isSettingsSection || isFleetOpsSection || isRentSection,
                })}
              </div>
            </li>
          ))}
          {section.items.length > 0 && !rentOnly && (
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
        ) : (
          <p className="admin-nav-collapsed-hint">
            {activeCount > 0 ? 'Ανοιχτό από ενεργή σελίδα' : 'Πατήστε για εμφάνιση'}
          </p>
        )}
      </div>
    );
  };

  return (
    <nav
      className="admin-sidebar-nav admin-sidebar-nav--compact flex-1 flex flex-col min-h-0"
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setDragState((prev) => ({ ...prev, overIndex: null }));
        }
      }}
    >
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-2 py-1.5 space-y-2 admin-nav-scroll">
        {rentOnly ? (
          <p className="admin-nav-hint">Μενού Rent</p>
        ) : null}
        {sections.map((section) => renderSection(section))}
      </div>
    </nav>
  );
}
