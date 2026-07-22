/** Admin sidebar — τμήματα: λειτουργίες · πλατφόρμα SaaS · ρυθμίσεις. */

import {
  TENANT_SETTINGS_TABS,
  PLATFORM_OPERATOR_TABS,
} from './settingsTabs.js';
import { settingsTabToNavItem } from './settingsSidebar.js';

export const NAV_LAYOUT_STORAGE_KEY = 'aerostride_admin_nav_layout_v3';
export const NAV_ORDER_STORAGE_KEY = 'aerostride_admin_nav_order';

export const DND_NAV_ID = 'application/x-aerostride-nav-id';

/** Ids that belong only under «Λειτουργίες Στόλου» — never also in main. */
export const FLEET_OPS_ONLY_IDS = [
  'fleet_kpis',
  'fleet_live_map',
  'fleet_active_drivers',
  'driver_chat',
  'fleet_route_playback',
];

/** Debug / platform-operator tools — not for normal office admins. */
export const SUPER_ONLY_MAIN_IDS = ['live_tracking'];

export const DEFAULT_MAIN_NAV_ORDER = [
  'dashboard',
  'routes',
  'customers',
  'fleet',
  'drivers',
  'lost_found',
  'email',
  'email_templates',
  'bookings',
];

export const LEGACY_NAV_IDS = new Set(['settings', 'payments']);

const PLATFORM_IDS = PLATFORM_OPERATOR_TABS.map((t) => `settings_${t.id}`);
const OFFICE_SETTINGS_IDS = TENANT_SETTINGS_TABS.map((t) => `settings_${t.id}`);

export function getDefaultNavLayout(isSuperAdmin) {
  return {
    main: isSuperAdmin
      ? [...DEFAULT_MAIN_NAV_ORDER.slice(0, 5), 'live_tracking', ...DEFAULT_MAIN_NAV_ORDER.slice(5)]
      : [...DEFAULT_MAIN_NAV_ORDER],
    fleet_ops: [...FLEET_OPS_ONLY_IDS],
    platform: isSuperAdmin ? [...PLATFORM_IDS] : [],
    settings: [...OFFICE_SETTINGS_IDS],
  };
}

function layoutStorageKey(isSuperAdmin) {
  return isSuperAdmin ? `${NAV_LAYOUT_STORAGE_KEY}_super` : NAV_LAYOUT_STORAGE_KEY;
}

function mergeSectionOrder(saved, defaults) {
  const known = new Set(defaults);
  const valid = saved.filter((id) => known.has(id));
  const missing = defaults.filter((id) => !valid.includes(id));
  return [...valid, ...missing];
}

function migrateNavLayout(layout, isSuperAdmin) {
  const defaults = getDefaultNavLayout(isSuperAdmin);
  const fleetOpsSet = new Set(FLEET_OPS_ONLY_IDS);
  const superOnlyMain = new Set(SUPER_ONLY_MAIN_IDS);

  let main = [...(layout.main || [])].filter(
    (id) =>
      id !== 'drivers' &&
      id !== 'email_templates' &&
      !fleetOpsSet.has(id) &&
      (isSuperAdmin || !superOnlyMain.has(id)),
  );
  let settings = [...(layout.settings || [])].filter((id) => OFFICE_SETTINGS_IDS.includes(id));

  const fleetIdx = main.indexOf('fleet');
  const driversInsertAt = fleetIdx >= 0 ? fleetIdx + 1 : main.length;
  if (!main.includes('drivers')) {
    main.splice(driversInsertAt, 0, 'drivers');
  }

  const emailIdx = main.indexOf('email');
  const templatesInsertAt = emailIdx >= 0 ? emailIdx + 1 : main.length;
  if (!main.includes('email_templates')) {
    main.splice(templatesInsertAt, 0, 'email_templates');
  }

  // Re-merge against defaults, then force-dedupe fleet ops out of main again.
  main = mergeSectionOrder(main, defaults.main).filter(
    (id) => !fleetOpsSet.has(id) && (isSuperAdmin || !superOnlyMain.has(id)),
  );

  return {
    main,
    fleet_ops: mergeSectionOrder(layout.fleet_ops || defaults.fleet_ops || [], defaults.fleet_ops || []),
    platform: isSuperAdmin
      ? mergeSectionOrder(layout.platform || [], defaults.platform)
      : [],
    settings: mergeSectionOrder(settings, defaults.settings),
  };
}

function splitLegacyFlatOrder(flat, isSuperAdmin) {
  const layout = getDefaultNavLayout(isSuperAdmin);
  const main = [];
  const platform = [];
  const settings = [];

  for (const id of flat) {
    if (LEGACY_NAV_IDS.has(id)) continue;
    if (layout.main.includes(id) || ADMIN_NAV_ITEMS[id]) main.push(id);
    else if (PLATFORM_IDS.includes(id)) platform.push(id);
    else if (OFFICE_SETTINGS_IDS.includes(id)) settings.push(id);
  }

  return {
    main: mergeSectionOrder(main, layout.main),
    platform: mergeSectionOrder(platform, layout.platform),
    settings: mergeSectionOrder(settings, layout.settings),
  };
}

export function loadNavLayout(isSuperAdmin) {
  const defaults = getDefaultNavLayout(isSuperAdmin);
  const storageKey = layoutStorageKey(isSuperAdmin);

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.main)) {
        return migrateNavLayout(
          {
            main: mergeSectionOrder(parsed.main, defaults.main),
            fleet_ops: mergeSectionOrder(parsed.fleet_ops || [], defaults.fleet_ops || []),
            platform: mergeSectionOrder(parsed.platform || [], defaults.platform),
            settings: mergeSectionOrder(parsed.settings || [], defaults.settings),
          },
          isSuperAdmin,
        );
      }
    }

    const legacyRaw =
      localStorage.getItem(isSuperAdmin ? `${NAV_ORDER_STORAGE_KEY}_super` : NAV_ORDER_STORAGE_KEY) ||
      localStorage.getItem(NAV_ORDER_STORAGE_KEY);
    if (legacyRaw) {
      const flat = JSON.parse(legacyRaw);
      if (Array.isArray(flat)) {
        return migrateNavLayout(splitLegacyFlatOrder(flat, isSuperAdmin), isSuperAdmin);
      }
    }
  } catch {
    /* fall through */
  }

  return defaults;
}

export function saveNavLayout(isSuperAdmin, layout) {
  localStorage.setItem(layoutStorageKey(isSuperAdmin), JSON.stringify(layout));
}

export const ADMIN_NAV_ITEMS = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    filled: true,
    type: 'tab',
    tab: 'dashboard',
    navGroup: 'main',
    accent: 'indigo',
  },
  routes: {
    id: 'routes',
    label: 'Εκδρομές',
    icon: 'route',
    filled: true,
    type: 'tab',
    tab: 'routes',
    navGroup: 'main',
    accent: 'emerald',
  },
  customers: {
    id: 'customers',
    label: 'Πελάτες',
    icon: 'group',
    filled: true,
    type: 'tab',
    tab: 'customers',
    navGroup: 'main',
    accent: 'violet',
  },
  fleet: {
    id: 'fleet',
    label: 'Στόλος',
    icon: 'directions_bus',
    filled: true,
    type: 'tab',
    tab: 'fleet',
    navGroup: 'main',
    accent: 'sky',
  },
  drivers: {
    id: 'drivers',
    label: 'Οδηγοί / App',
    icon: 'badge',
    filled: true,
    type: 'tab',
    tab: 'drivers',
    navGroup: 'main',
    accent: 'indigo',
  },
  live_tracking: {
    id: 'live_tracking',
    label: 'Live GPS (poll)',
    icon: 'share_location',
    filled: true,
    type: 'tab',
    tab: 'live_tracking',
    navGroup: 'main',
    accent: 'cyan',
    superOnly: true,
  },
  fleet_live_map: {
    id: 'fleet_live_map',
    label: 'Ζωντανός Χάρτης',
    icon: 'map',
    filled: true,
    type: 'tab',
    tab: 'fleet_live_map',
    navGroup: 'fleet_ops',
    accent: 'cyan',
  },
  fleet_kpis: {
    id: 'fleet_kpis',
    label: 'Fleet KPIs',
    icon: 'analytics',
    filled: true,
    type: 'tab',
    tab: 'fleet_kpis',
    navGroup: 'fleet_ops',
    accent: 'violet',
  },
  fleet_active_drivers: {
    id: 'fleet_active_drivers',
    label: 'Ενεργοί Οδηγοί',
    icon: 'groups',
    filled: true,
    type: 'tab',
    tab: 'fleet_active_drivers',
    navGroup: 'fleet_ops',
    accent: 'teal',
  },
  driver_chat: {
    id: 'driver_chat',
    label: 'Chat Οδηγών',
    icon: 'forum',
    filled: true,
    type: 'tab',
    tab: 'driver_chat',
    navGroup: 'fleet_ops',
    accent: 'sky',
  },
  fleet_route_playback: {
    id: 'fleet_route_playback',
    label: 'Ιστορικό Διαδρομής',
    icon: 'route',
    filled: true,
    type: 'tab',
    tab: 'fleet_route_playback',
    navGroup: 'fleet_ops',
    accent: 'indigo',
  },
  lost_found: {
    id: 'lost_found',
    label: 'Απωλεσθέντα',
    icon: 'support_agent',
    filled: true,
    type: 'tab',
    tab: 'lost_found',
    variant: 'rose',
    navGroup: 'main',
    accent: 'rose',
  },
  email: {
    id: 'email',
    label: 'Email',
    icon: 'mail',
    filled: false,
    type: 'email',
    navGroup: 'main',
    accent: 'amber',
  },
  email_templates: {
    id: 'email_templates',
    label: 'Πρότυπα',
    icon: 'dashboard_customize',
    filled: true,
    type: 'tab',
    tab: 'email_templates',
    navGroup: 'main',
    accent: 'violet',
  },
  bookings: {
    id: 'bookings',
    label: 'Κρατήσεις',
    icon: 'book_online',
    filled: false,
    type: 'tab',
    tab: 'bookings',
    navGroup: 'main',
    accent: 'blue',
  },
  driver_scan: {
    id: 'driver_scan',
    label: 'Driver Scan',
    icon: 'qr_code_scanner',
    filled: false,
    type: 'navigate',
    path: '/driver',
    variant: 'driver',
    navGroup: 'main',
    accent: 'teal',
  },
};

export function resolveNavItem(id, isSuperAdmin) {
  if (ADMIN_NAV_ITEMS[id]) {
    const item = ADMIN_NAV_ITEMS[id];
    if (item.superOnly && !isSuperAdmin) return null;
    return item;
  }
  if (!id.startsWith('settings_')) return null;

  const tabId = id.slice('settings_'.length);
  const platformTab = PLATFORM_OPERATOR_TABS.find((t) => t.id === tabId);
  if (platformTab) {
    return isSuperAdmin ? settingsTabToNavItem(platformTab) : null;
  }

  const officeTab = TENANT_SETTINGS_TABS.find((t) => t.id === tabId);
  return officeTab ? settingsTabToNavItem(officeTab) : null;
}

export function navItemsFromIds(ids, isSuperAdmin) {
  const seen = new Set();
  const out = [];
  for (const id of ids || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const item = resolveNavItem(id, isSuperAdmin);
    if (item) out.push(item);
  }
  return out;
}

export function reorderNav(order, fromId, toIndex) {
  const fromIdx = order.indexOf(fromId);
  if (fromIdx < 0) return order;
  let toIdx = Math.max(0, Math.min(toIndex, order.length));
  if (fromIdx === toIdx) return order;
  const copy = [...order];
  const [moved] = copy.splice(fromIdx, 1);
  if (fromIdx < toIdx) toIdx -= 1;
  copy.splice(toIdx, 0, moved);
  return copy;
}

export function updateSectionOrder(layout, section, nextOrder) {
  return { ...layout, [section]: nextOrder };
}

/** @deprecated */
export function loadFullNavOrder(isSuperAdmin) {
  const { main, platform, settings } = loadNavLayout(isSuperAdmin);
  return [...main, ...platform, ...settings];
}

/** @deprecated */
export function saveFullNavOrder(isSuperAdmin, order) {
  saveNavLayout(isSuperAdmin, splitLegacyFlatOrder(order, isSuperAdmin));
}

/** @deprecated */
export function loadNavOrder() {
  return loadNavLayout(false).main;
}

/** @deprecated */
export function saveNavOrder(order) {
  saveNavLayout(false, { ...loadNavLayout(false), main: order });
}

export const DEFAULT_ADMIN_NAV_ORDER = DEFAULT_MAIN_NAV_ORDER;

export function navItemsInOrder(order, isSuperAdmin) {
  return navItemsFromIds(order, isSuperAdmin);
}
