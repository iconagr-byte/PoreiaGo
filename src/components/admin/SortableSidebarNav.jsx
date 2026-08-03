import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ensureFactoryNavReset,
  moveNavItem,
  navItemsFromIds,
  navLayoutForOfficeMode,
  NAV_FACTORY_RESET_KEY,
  resetNavLayoutToDefault,
  saveNavLayout,
} from '../../lib/admin/sidebarNav.js';
import { DEFAULT_TENANT_SETTINGS_TAB, sanitizeSettingsSubTab } from '../../lib/admin/settingsTabs.js';
import { DEFAULT_RENT_DESK_TAB, sanitizeRentDeskTab } from '../../lib/admin/rentDeskNav.js';
import {
  DEFAULT_FLEET_OPS_TAB,
  isFleetOpsSubTab,
  sanitizeFleetOpsSubTab,
} from '../../lib/admin/fleetOpsHub.js';
import {
  DEFAULT_BUSES_HUB_TAB,
  isBusesHubTab,
  sanitizeBusesHubTab,
} from '../../lib/admin/busesHub.js';
import {
  isSharedNavItem,
  loadNavServiceMode,
  NAV_SERVICE_MODES,
  navItemVisibleInServiceMode,
  normalizeNavServiceMode,
  saveNavServiceMode,
  suggestTabForServiceMode,
} from '../../lib/admin/navServiceScope.js';
import { isSaasSuperAdmin } from '../../lib/saasJwt.js';

function DualScopeBadge() {
  return (
    <span className="admin-nav-dual-badge" title="Λεωφορεία & Ενοικιάσεις" aria-label="Κοινό · λεωφορεία & ενοικιάσεις">
      <span className="admin-nav-dual-badge-icon" aria-hidden>
        <span className="material-symbols-outlined">directions_bus</span>
      </span>
      <span className="admin-nav-dual-badge-icon admin-nav-dual-badge-icon--car" aria-hidden>
        <span className="material-symbols-outlined">directions_car</span>
      </span>
    </span>
  );
}

function SharedScopeChip() {
  return (
    <span className="admin-nav-shared-chip" title="Λεωφορεία & Ενοικιάσεις" aria-label="Κοινό">
      Κοινό
    </span>
  );
}

function ZoneHeader({ tone, icon, title, subtitle }) {
  return (
    <div className={`admin-nav-zone-head admin-nav-zone-head--${tone}`}>
      <span className="admin-nav-zone-icon" aria-hidden>
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
      </span>
      <div className="min-w-0">
        <p className="admin-nav-zone-title">{title}</p>
        {subtitle ? <p className="admin-nav-zone-sub">{subtitle}</p> : null}
      </div>
    </div>
  );
}

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
  const showServiceSwitch = rentEnabled && !rentOnly;
  const [layout, setLayout] = useState(() => ensureFactoryNavReset(superAdmin));
  const [storedServiceMode, setStoredServiceMode] = useState(() => loadNavServiceMode());
  const [dragState, setDragState] = useState({
    section: null,
    fromSection: null,
    overIndex: null,
    draggingId: null,
  });

  // Re-read layout when superadmin flag flips (token / role change).
  const [layoutRole, setLayoutRole] = useState(superAdmin);
  if (layoutRole !== superAdmin) {
    setLayoutRole(superAdmin);
    setLayout(ensureFactoryNavReset(superAdmin));
  }

  // Persist repaired layout + force service mode Όλα once after factory reset.
  useEffect(() => {
    if (rentOnly) return;
    const repaired = ensureFactoryNavReset(superAdmin);
    setLayout(repaired);
    saveNavLayout(superAdmin, repaired);
    try {
      const bootKey = `${NAV_FACTORY_RESET_KEY}_mode_boot`;
      if (localStorage.getItem(bootKey) !== '1') {
        localStorage.setItem(bootKey, '1');
        setStoredServiceMode('all');
        saveNavServiceMode('all');
      }
    } catch {
      setStoredServiceMode('all');
      saveNavServiceMode('all');
    }
  }, [superAdmin, rentOnly]);

  const resetMenu = useCallback(() => {
    const next = resetNavLayoutToDefault(superAdmin);
    setLayout(next);
    setStoredServiceMode('all');
    saveNavServiceMode('all');
    toast.success('Το μενού επανήλθε');
  }, [superAdmin]);

  const serviceMode = rentOnly
    ? 'rent'
    : !rentEnabled
      ? 'buses'
      : normalizeNavServiceMode(storedServiceMode);

  const displayLayout = useMemo(
    () => navLayoutForOfficeMode(layout, officeMode, superAdmin),
    [layout, officeMode, superAdmin],
  );

  const mainItems = useMemo(() => {
    return navItemsFromIds(displayLayout.main || [], superAdmin).filter(
      (item) =>
        item.type !== 'settings_subtab' &&
        item.type !== 'fleet_rental_subtab' &&
        !isFleetOpsSubTab(item.id) &&
        (superAdmin || item.settingsSection !== 'platform'),
    );
  }, [displayLayout, superAdmin]);

  const sharedItems = useMemo(
    () =>
      mainItems.filter(
        (item) =>
          isSharedNavItem(item) && navItemVisibleInServiceMode(item, serviceMode),
      ),
    [mainItems, serviceMode],
  );

  const persistLayout = useCallback(
    (next) => {
      if (rentOnly) return;
      setLayout(next);
      saveNavLayout(superAdmin, next);
    },
    [superAdmin, rentOnly],
  );

  const applyServiceMode = useCallback(
    (nextMode) => {
      const mode = normalizeNavServiceMode(nextMode);
      setStoredServiceMode(mode);
      saveNavServiceMode(mode);
      const landing = suggestTabForServiceMode(activeTab, mode, { rentEnabled });
      if (landing === 'fleet_rental') {
        onFleetRentalTabChange?.(sanitizeRentDeskTab(fleetRentalTab || DEFAULT_RENT_DESK_TAB));
        onTabChange?.('fleet_rental');
      } else if (landing) {
        onTabChange?.(landing);
      }
    },
    [activeTab, rentEnabled, fleetRentalTab, onFleetRentalTabChange, onTabChange],
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

  const openBusesHub = (tabId) => {
    const next = sanitizeBusesHubTab(tabId || DEFAULT_BUSES_HUB_TAB);
    if (next === 'fleet_ops' || isFleetOpsSubTab(next)) {
      openFleetOps(next === 'fleet_ops' ? fleetOpsSubTab || DEFAULT_FLEET_OPS_TAB : next);
      return;
    }
    onTabChange?.(next);
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

  const busesHubActive = !rentOnly && isBusesHubTab(activeTab);

  const buttonClass = (item, { cardStyle = false } = {}) => {
    const isRentSubActive =
      item.type === 'fleet_rental_subtab' &&
      activeTab === 'fleet_rental' &&
      sanitizeRentDeskTab(fleetRentalTab) === item.fleetRentalTab;
    const isTabActive = item.type === 'tab' && activeTab === item.tab;
    const isEmailActive = item.type === 'email' && activeTab === 'email';
    const isActive = isRentSubActive || isTabActive || isEmailActive;

    const classes = ['admin-nav-btn'];
    if (isActive) classes.push('admin-nav-btn-active');
    if (isSharedNavItem(item)) classes.push('admin-nav-btn--shared');
    if (cardStyle) classes.push('admin-nav-btn--mini-card');
    return classes.join(' ');
  };

  const settingsActive = activeTab === 'settings';
  const rentDeskActive = activeTab === 'fleet_rental';
  const showSharedZone = sharedItems.length > 0;
  const showBusesPin = !rentOnly && serviceMode !== 'rent';
  const showRentPin = rentEnabled && (rentOnly || serviceMode !== 'buses');
  const menuLooksEmpty = !rentOnly && !showSharedZone && !showBusesPin;

  const navAccent = (item) =>
    item.accent || (item.variant === 'rose' ? 'rose' : item.variant === 'driver' ? 'teal' : 'indigo');

  const renderRow = (item, sectionId, { nested = false, cardStyle = false } = {}) => {
    const dragging = dragState.draggingId === item.id;
    const shared = isSharedNavItem(item);
    return (
      <div
        className={`admin-nav-row ${dragging ? 'admin-nav-row-dragging' : ''} ${
          nested ? 'admin-nav-row-nested' : ''
        }${cardStyle ? ' admin-nav-row--mini-card' : ''}`}
      >
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
          className={buttonClass(item, { cardStyle })}
          data-accent={shared ? 'shared' : navAccent(item)}
          title={shared ? `${item.label} · λεωφορεία & ενοικιάσεις` : item.label}
        >
          <span className={`admin-nav-icon${cardStyle ? ' admin-nav-icon--circle' : ''}`}>
            <span
              className="material-symbols-outlined"
              style={item.filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
          </span>
          <span className="admin-nav-label">{item.label}</span>
          {shared && showServiceSwitch ? (
            cardStyle ? <SharedScopeChip /> : <DualScopeBadge />
          ) : null}
          {cardStyle ? (
            <span className="material-symbols-outlined admin-nav-mini-chevron" aria-hidden>
              chevron_right
            </span>
          ) : null}
        </button>
      </div>
    );
  };

  const resolveMainDropIndex = useCallback(
    (zoneItems, visualIndex) => {
      const order = displayLayout.main || [];
      if (!zoneItems.length) return Math.max(0, Math.min(visualIndex, order.length));
      if (visualIndex >= zoneItems.length) {
        const lastId = zoneItems[zoneItems.length - 1]?.id;
        const idx = order.indexOf(lastId);
        return idx < 0 ? order.length : idx + 1;
      }
      const id = zoneItems[visualIndex]?.id;
      const idx = order.indexOf(id);
      return idx < 0 ? visualIndex : idx;
    },
    [displayLayout.main],
  );

  const renderItemList = (items, sectionId, { cardStyle = false } = {}) => {
    const isDropTarget = !rentOnly && dragState.draggingId && dragState.section === sectionId;
    const toLayoutIndex = (visualIndex) =>
      sectionId === 'main' ? resolveMainDropIndex(items, visualIndex) : visualIndex;

    return (
      <ul
        className={`admin-nav-list${cardStyle ? ' admin-nav-list--mini-cards' : ''}`}
        onDragOver={(e) => {
          if (rentOnly || !dragState.draggingId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (items.length === 0) markDropTarget(sectionId, toLayoutIndex(0));
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (rentOnly) return;
          if (items.length === 0) handleDrop(sectionId, toLayoutIndex(0));
        }}
      >
        {items.map((item, idx) => {
          const layoutIdx = toLayoutIndex(idx);
          return (
            <li key={item.id} className="admin-nav-item">
              {isDropTarget && dragState.overIndex === layoutIdx ? (
                <div className="admin-nav-drop-line" aria-hidden />
              ) : null}
              <div
                onDragOver={(e) => {
                  if (rentOnly) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  markDropTarget(sectionId, layoutIdx);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(sectionId, layoutIdx);
                }}
              >
                {renderRow(item, sectionId, { cardStyle })}
              </div>
            </li>
          );
        })}
        {items.length > 0 && !rentOnly ? (
          <li
            className={`admin-nav-item ${
              isDropTarget && dragState.overIndex === toLayoutIndex(items.length)
                ? 'admin-nav-drop-end-active'
                : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              markDropTarget(sectionId, toLayoutIndex(items.length));
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(sectionId, toLayoutIndex(items.length));
            }}
          >
            {isDropTarget && dragState.overIndex === toLayoutIndex(items.length) ? (
              <div className="admin-nav-drop-line" aria-hidden />
            ) : (
              <div className="admin-nav-drop-end" aria-hidden />
            )}
          </li>
        ) : null}
      </ul>
    );
  };

  return (
    <nav
      className={`admin-sidebar-nav flex-1 flex flex-col min-h-0 admin-sidebar-nav--mode-${serviceMode}`}
      data-service-mode={serviceMode}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setDragState((prev) => ({ ...prev, overIndex: null }));
        }
      }}
    >
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 px-2.5 pt-4 pb-2 space-y-3 admin-nav-scroll">
        {showServiceSwitch ? (
          <div className="admin-nav-mode-switch" role="tablist" aria-label="Υπηρεσία μενού">
            {NAV_SERVICE_MODES.map((mode) => {
              const active = serviceMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={mode.hint}
                  className={`admin-nav-mode-btn admin-nav-mode-btn--${mode.id}${
                    active ? ' is-active' : ''
                  }`}
                  onClick={() => applyServiceMode(mode.id)}
                >
                  <span className="material-symbols-outlined" aria-hidden>
                    {mode.icon}
                  </span>
                  <span className="admin-nav-mode-label">{mode.short}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="admin-nav-hint">
            {rentOnly ? 'Μενού Rent — χωρίς εκδρομές / λεωφορεία' : 'Σύρετε ⋮⋮ σε οποιαδήποτε ενότητα'}
          </p>
        )}

        {rentOnly ? (
          <div className="admin-nav-zone admin-nav-zone--shared">
            <ZoneHeader tone="shared" icon="apartment" title="Γραφείο" subtitle="Κοινά εργαλεία" />
            {renderItemList(mainItems, 'main', { cardStyle: true })}
          </div>
        ) : (
          <>
            {showSharedZone ? (
              <div className="admin-nav-zone admin-nav-zone--shared admin-nav-zone--shared-cards">
                <ZoneHeader
                  tone="shared"
                  icon="hub"
                  title="Κοινά"
                  subtitle="Λεωφορεία & ενοικιάσεις"
                />
                {renderItemList(sharedItems, 'main', { cardStyle: true })}
              </div>
            ) : null}

            {showBusesPin && !showSharedZone ? (
              <div className="admin-nav-zone admin-nav-zone--rent-hint">
                <p className="admin-nav-rent-hint-text">
                  Ανοίξτε την κάρτα <strong>Λεωφορεία</strong> κάτω — το μενού εμφανίζεται δεξιά.
                </p>
              </div>
            ) : null}

            {showServiceSwitch && serviceMode === 'rent' ? (
              <div className="admin-nav-zone admin-nav-zone--rent-hint">
                <p className="admin-nav-rent-hint-text">
                  Τα εργαλεία ενοικίασης ανοίγουν από την κάρτα <strong>Ενοικιάσεις</strong> κάτω.
                  Για εκδρομές / οδηγούς πατήστε <strong>Όλα</strong> ή <strong>Λεωφ.</strong> πάνω.
                </p>
              </div>
            ) : null}

            {showServiceSwitch && serviceMode === 'buses' ? (
              <div className="admin-nav-zone admin-nav-zone--rent-hint">
                <p className="admin-nav-rent-hint-text">
                  Ανοίξτε την κάρτα <strong>Λεωφορεία</strong> κάτω — Εκδρομές, στόλος και GPS στα δεξιά.
                </p>
              </div>
            ) : null}

            {menuLooksEmpty ? (
              <div className="admin-nav-zone admin-nav-zone--rent-hint">
                <p className="admin-nav-rent-hint-text mb-2">
                  Το μενού φαίνεται άδειο. Επαναφέρετε την προεπιλογή.
                </p>
                <button
                  type="button"
                  onClick={resetMenu}
                  className="w-full rounded-xl bg-slate-900 text-white text-xs font-bold py-2.5 hover:bg-slate-800"
                >
                  Επαναφορά μενού
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Pinned hubs — Λεωφορεία · Ενοικιάσεις · Ρυθμίσεις */}
      <div className="shrink-0 border-t border-black/[0.06] px-2.5 py-2.5 bg-white/80 backdrop-blur-sm space-y-2">
        {showBusesPin ? (
          <button
            type="button"
            onClick={() => openBusesHub(busesHubActive ? activeTab : DEFAULT_BUSES_HUB_TAB)}
            className={`admin-nav-service-card admin-nav-service-card--buses${
              busesHubActive ? ' is-active' : ''
            }`}
            title="Λεωφορεία — εκδρομές, στόλος, GPS"
            aria-current={busesHubActive ? 'page' : undefined}
          >
            <span className="admin-nav-service-card-icon" aria-hidden>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                directions_bus
              </span>
            </span>
            <span className="admin-nav-service-card-copy">
              <span className="admin-nav-service-card-kicker">Υπηρεσία</span>
              <span className="admin-nav-service-card-title">Λεωφορεία</span>
              <span className="admin-nav-service-card-sub">Εκδρομές · στόλος · GPS</span>
            </span>
            <span className="material-symbols-outlined admin-nav-service-card-chevron" aria-hidden>
              chevron_right
            </span>
          </button>
        ) : null}

        {showRentPin ? (
          <button
            type="button"
            onClick={() => openRentDesk(fleetRentalTab || DEFAULT_RENT_DESK_TAB)}
            className={`admin-nav-service-card admin-nav-service-card--rent${
              rentDeskActive ? ' is-active' : ''
            }`}
            title="Υπηρεσία ενοικίασης"
            aria-current={rentDeskActive ? 'page' : undefined}
          >
            <span className="admin-nav-service-card-glow" aria-hidden />
            <span className="admin-nav-service-card-icon" aria-hidden>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                directions_car
              </span>
            </span>
            <span className="admin-nav-service-card-copy">
              <span className="admin-nav-service-card-kicker">Υπηρεσία</span>
              <span className="admin-nav-service-card-title">Ενοικιάσεις</span>
              <span className="admin-nav-service-card-sub">Desk · στόλος · /rent app</span>
            </span>
            <span className="material-symbols-outlined admin-nav-service-card-chevron" aria-hidden>
              chevron_right
            </span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => openSettings(settingsSubTab || DEFAULT_TENANT_SETTINGS_TAB)}
          className={`admin-nav-service-card admin-nav-service-card--settings${
            settingsActive ? ' is-active' : ''
          }`}
          title="Ρυθμίσεις · κοινό για λεωφορεία & ενοικιάσεις"
          aria-current={settingsActive ? 'page' : undefined}
        >
          <span className="admin-nav-service-card-icon" aria-hidden>
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              settings
            </span>
          </span>
          <span className="admin-nav-service-card-copy">
            <span className="admin-nav-service-card-kicker">Γραφείο</span>
            <span className="admin-nav-service-card-title">Ρυθμίσεις</span>
            <span className="admin-nav-service-card-sub">
              {showServiceSwitch ? 'Λεωφορεία & ενοικιάσεις' : 'Εμφάνιση · πληρωμές · συμβόλαια'}
            </span>
          </span>
          <span className="material-symbols-outlined admin-nav-service-card-chevron" aria-hidden>
            chevron_right
          </span>
        </button>
      </div>
    </nav>
  );
}
