import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  loadNavLayout,
  moveNavItem,
  navItemsFromIds,
  navLayoutForOfficeMode,
  saveNavLayout,
} from '../../lib/admin/sidebarNav.js';
import { DEFAULT_TENANT_SETTINGS_TAB, sanitizeSettingsSubTab } from '../../lib/admin/settingsTabs.js';
import { DEFAULT_RENT_DESK_TAB, sanitizeRentDeskTab } from '../../lib/admin/rentDeskNav.js';
import {
  DEFAULT_FLEET_OPS_TAB,
  isFleetOpsSubTab,
  sanitizeFleetOpsSubTab,
} from '../../lib/admin/fleetOpsHub.js';
import { isSaasSuperAdmin } from '../../lib/saasJwt.js';

const SECTIONS = [
  { id: 'main', label: 'Λειτουργίες' },
  { id: 'rent', label: 'Ενοικιάσεις' },
  { id: 'fleet_ops', label: 'Λειτουργίες Στόλου' },
  { id: 'platform', label: 'Πλατφόρμα SaaS', superOnly: true },
  { id: 'settings', label: 'Ρυθμίσεις' },
];

export default function SortableSidebarNav({
  activeTab,
  settingsSubTab,
  fleetOpsSubTab,
  fleetRentalTab,
  onTabChange,
  onSettingsSubTabChange,
  onFleetOpsSubTabChange,
  onFleetRentalTabChange,
  onEmailClick,
  onNavigate,
  officeMode = 'trips_only',
  rentEnabled = true,
}) {
  const superAdmin = isSaasSuperAdmin();
  const rentOnly = officeMode === 'rent_only';
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

  const displayLayout = useMemo(
    () => navLayoutForOfficeMode(layout, officeMode, superAdmin),
    [layout, officeMode, superAdmin],
  );

  const sections = useMemo(() => {
    const visible = SECTIONS.filter((s) => {
      // Settings + SaaS platform + fleet ops live in hub card rails — not the left κατεβατό.
      if (s.id === 'settings' || s.id === 'platform' || s.id === 'fleet_ops') return false;
      if (s.superOnly && !superAdmin) return false;
      if (!rentEnabled && s.id === 'rent') return false;
      return true;
    });
    return visible
      .map((section) => ({
        ...section,
        label: rentOnly && section.id === 'main' ? 'Γραφείο' : section.label,
        order: displayLayout[section.id] || [],
        items: navItemsFromIds(displayLayout[section.id] || [], superAdmin).filter(
          (item) =>
            item.type !== 'settings_subtab' &&
            !isFleetOpsSubTab(item.id) &&
            (superAdmin || item.settingsSection !== 'platform'),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [displayLayout, superAdmin, rentOnly, rentEnabled]);

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

  const openFleetOps = (subTab) => {
    onFleetOpsSubTabChange?.(sanitizeFleetOpsSubTab(subTab || DEFAULT_FLEET_OPS_TAB));
    onTabChange?.('fleet_ops');
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
      if (!rentEnabled) {
        toast.error('Το Rent δεν είναι ενεργό για αυτό το γραφείο');
        return;
      }
      openRentDesk(item.fleetRentalTab || DEFAULT_RENT_DESK_TAB);
      return;
    }
    const tabId = item.tab || item.id;
    if (isFleetOpsSubTab(tabId) || tabId === 'fleet_ops') {
      openFleetOps(tabId === 'fleet_ops' ? fleetOpsSubTab || DEFAULT_FLEET_OPS_TAB : tabId);
      return;
    }
    onTabChange?.(tabId);
  };

  const buttonClass = (item) => {
    const isRentSubActive =
      item.type === 'fleet_rental_subtab' &&
      activeTab === 'fleet_rental' &&
      sanitizeRentDeskTab(fleetRentalTab) === item.fleetRentalTab;
    const isTabActive = item.type === 'tab' && activeTab === item.tab;
    const isEmailActive = item.type === 'email' && activeTab === 'email';
    const isActive = isRentSubActive || isTabActive || isEmailActive;

    const classes = ['admin-nav-btn'];
    if (isActive) {
      classes.push('admin-nav-btn-active');
    }
    return classes.join(' ');
  };

  const settingsActive = activeTab === 'settings';
  const fleetOpsActive = activeTab === 'fleet_ops' || isFleetOpsSubTab(activeTab);

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
          <span className="admin-nav-label">{item.label}</span>
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

    return (
      <div
        key={section.id}
        className={`admin-nav-section ${isPlatformSection ? 'admin-nav-section-platform' : ''} ${
          isSettingsSection ? 'admin-nav-section-settings' : ''
        } ${isRentSection ? 'admin-nav-section-rent' : ''} ${
          isFleetOpsSection ? 'admin-nav-section-fleet' : ''
        } ${isDropTarget ? 'admin-nav-section-drop-target' : ''}`}
        onDragOver={(e) => {
          if (rentOnly || !dragState.draggingId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (section.items.length === 0) markDropTarget(section.id, 0);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (rentOnly) return;
          if (section.items.length === 0) handleDrop(section.id, 0);
        }}
      >
        <p
          className={`admin-nav-section-label ${
            isPlatformSection ? 'admin-nav-section-label-platform' : ''
          } ${isSettingsSection ? 'admin-nav-section-label-settings' : ''} ${
            isRentSection ? 'admin-nav-section-label-rent' : ''
          }`}
        >
          {section.label}
        </p>

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
        {rentOnly ? (
          <p className="admin-nav-hint">Μενού Rent — χωρίς εκδρομές / λεωφορεία</p>
        ) : (
          <p className="admin-nav-hint">Σύρετε ⋮⋮ σε οποιαδήποτε ενότητα</p>
        )}
        {sections.map((section) => renderSection(section))}
      </div>

      {/* Pinned hub entries — subtabs open as cards in the main pane */}
      <div className="shrink-0 border-t border-black/[0.06] px-2.5 py-2.5 bg-white/70 backdrop-blur-sm space-y-1.5">
        {!rentOnly ? (
          <button
            type="button"
            onClick={() => openFleetOps(fleetOpsSubTab || DEFAULT_FLEET_OPS_TAB)}
            className={`admin-nav-btn w-full ${fleetOpsActive ? 'admin-nav-btn-active' : ''}`}
            data-accent="sky"
            title="Λειτουργίες Στόλου"
            aria-current={fleetOpsActive ? 'page' : undefined}
          >
            <span className="admin-nav-icon">
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                directions_bus
              </span>
            </span>
            <span className="admin-nav-label">Λειτουργίες Στόλου</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() =>
            openSettings(settingsSubTab || DEFAULT_TENANT_SETTINGS_TAB)
          }
          className={`admin-nav-btn w-full ${settingsActive ? 'admin-nav-btn-active' : ''}`}
          data-accent="violet"
          title="Ρυθμίσεις"
          aria-current={settingsActive ? 'page' : undefined}
        >
          <span className="admin-nav-icon">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              settings
            </span>
          </span>
          <span className="admin-nav-label">Ρυθμίσεις</span>
        </button>
      </div>
    </nav>
  );
}
