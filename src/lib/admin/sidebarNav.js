/** Admin sidebar — τμήματα: λειτουργίες · πλατφόρμα SaaS · ρυθμίσεις. */

import {
  TENANT_SETTINGS_TABS,
  PLATFORM_OPERATOR_TABS,
} from './settingsTabs.js';
import { settingsTabToNavItem } from './settingsSidebar.js';

export const NAV_LAYOUT_STORAGE_KEY = 'aerostride_admin_nav_layout_v8';
export const NAV_ORDER_STORAGE_KEY = 'aerostride_admin_nav_order';

export const DND_NAV_ID = 'application/x-aerostride-nav-id';

/** Default ids under «Λειτουργίες Στόλου» (users can drag them anywhere). */
export const FLEET_OPS_ONLY_IDS = [
  'fleet_kpis',
  'fleet_active_drivers',
  'driver_chat',
  'fleet_route_playback',
  'fleet_calendar',
  'fleet_availability',
  'fleet_documents',
  'fleet_expenses',
  'fleet_digest',
];

/** Platform SaaS tabs (Tenants, SaaS Infra, Backup, Growth) — superadmin only. */
export const PLATFORM_NAV_IDS = PLATFORM_OPERATOR_TABS.map((t) => `settings_${t.id}`);

export const DEFAULT_MAIN_NAV_ORDER = [
  'dashboard',
  'fleet_live_map',
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

const PLATFORM_IDS = PLATFORM_NAV_IDS;
const OFFICE_SETTINGS_IDS = TENANT_SETTINGS_TABS.map((t) => `settings_${t.id}`);
const PLATFORM_ID_SET = new Set(PLATFORM_IDS);
const SECTION_KEYS = ['main', 'fleet_ops', 'platform', 'settings'];

export function getDefaultNavLayout(isSuperAdmin) {
  return {
    main: [...DEFAULT_MAIN_NAV_ORDER],
    fleet_ops: [...FLEET_OPS_ONLY_IDS],
    platform: isSuperAdmin ? [...PLATFORM_IDS] : [],
    settings: [...OFFICE_SETTINGS_IDS],
  };
}

function layoutStorageKey(isSuperAdmin) {
  return isSuperAdmin ? `${NAV_LAYOUT_STORAGE_KEY}_super` : NAV_LAYOUT_STORAGE_KEY;
}

function allKnownNavIds(isSuperAdmin) {
  const defaults = getDefaultNavLayout(isSuperAdmin);
  return new Set(SECTION_KEYS.flatMap((key) => defaults[key] || []));
}

/** Preserve free cross-section placement; only drop unknown / forbidden ids. */
function migrateNavLayout(layout, isSuperAdmin) {
  const defaults = getDefaultNavLayout(isSuperAdmin);
  const known = allKnownNavIds(isSuperAdmin);
  const next = { main: [], fleet_ops: [], platform: [], settings: [] };
  const seen = new Set();

  for (const section of SECTION_KEYS) {
    if (section === 'platform' && !isSuperAdmin) continue;
    for (const id of layout[section] || []) {
      if (!id || LEGACY_NAV_IDS.has(id) || id === 'live_tracking') continue;
      if (!known.has(id)) continue;
      if (!isSuperAdmin && PLATFORM_ID_SET.has(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      next[section].push(id);
    }
  }

  // Missing defaults land in their home section (first-time / new items only).
  for (const section of SECTION_KEYS) {
    if (section === 'platform' && !isSuperAdmin) {
      next.platform = [];
      continue;
    }
    for (const id of defaults[section] || []) {
      if (seen.has(id)) continue;
      if (!isSuperAdmin && PLATFORM_ID_SET.has(id)) continue;
      seen.add(id);
      next[section].push(id);
    }
  }

  return next;
}

function splitLegacyFlatOrder(flat, isSuperAdmin) {
  const layout = getDefaultNavLayout(isSuperAdmin);
  const main = [];
  const platform = [];
  const settings = [];
  const fleet_ops = [];

  for (const id of flat) {
    if (LEGACY_NAV_IDS.has(id) || id === 'live_tracking') continue;
    if (PLATFORM_IDS.includes(id)) {
      if (isSuperAdmin) platform.push(id);
    } else if (OFFICE_SETTINGS_IDS.includes(id)) settings.push(id);
    else if (FLEET_OPS_ONLY_IDS.includes(id)) fleet_ops.push(id);
    else if (layout.main.includes(id) || ADMIN_NAV_ITEMS[id]) main.push(id);
  }

  return migrateNavLayout({ main, fleet_ops, platform, settings }, isSuperAdmin);
}

export function loadNavLayout(isSuperAdmin) {
  const defaults = getDefaultNavLayout(isSuperAdmin);
  const storageKey = layoutStorageKey(isSuperAdmin);
  const legacyKeys = [
    storageKey,
    isSuperAdmin ? 'aerostride_admin_nav_layout_v7_super' : 'aerostride_admin_nav_layout_v7',
    isSuperAdmin ? 'aerostride_admin_nav_layout_v6_super' : 'aerostride_admin_nav_layout_v6',
  ];

  try {
    for (const key of legacyKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.main)) {
        return migrateNavLayout(
          {
            main: parsed.main || [],
            fleet_ops: parsed.fleet_ops || [],
            platform: parsed.platform || [],
            settings: parsed.settings || [],
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
  const safe = migrateNavLayout(layout || getDefaultNavLayout(isSuperAdmin), isSuperAdmin);
  localStorage.setItem(layoutStorageKey(isSuperAdmin), JSON.stringify(safe));
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
  fleet_live_map: {
    id: 'fleet_live_map',
    label: 'Ζωντανός Χάρτης',
    icon: 'map',
    filled: true,
    type: 'tab',
    tab: 'fleet_live_map',
    navGroup: 'main',
    accent: 'cyan',
  },
  fleet_kpis: {
    id: 'fleet_kpis',
    label: 'Δείκτες στόλου',
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
  fleet_calendar: {
    id: 'fleet_calendar',
    label: 'Ημερολόγιο',
    icon: 'calendar_month',
    filled: true,
    type: 'tab',
    tab: 'fleet_calendar',
    navGroup: 'fleet_ops',
    accent: 'amber',
  },
  fleet_availability: {
    id: 'fleet_availability',
    label: 'Διαθεσιμότητα',
    icon: 'event_available',
    filled: true,
    type: 'tab',
    tab: 'fleet_availability',
    navGroup: 'fleet_ops',
    accent: 'emerald',
  },
  fleet_documents: {
    id: 'fleet_documents',
    label: 'Έγγραφα',
    icon: 'folder_managed',
    filled: true,
    type: 'tab',
    tab: 'fleet_documents',
    navGroup: 'fleet_ops',
    accent: 'slate',
  },
  fleet_expenses: {
    id: 'fleet_expenses',
    label: 'Έξοδα στόλου',
    icon: 'local_gas_station',
    filled: true,
    type: 'tab',
    tab: 'fleet_expenses',
    navGroup: 'fleet_ops',
    accent: 'orange',
  },
  fleet_digest: {
    id: 'fleet_digest',
    label: 'Ειδοποιήσεις',
    icon: 'notifications_active',
    filled: true,
    type: 'tab',
    tab: 'fleet_digest',
    navGroup: 'fleet_ops',
    accent: 'rose',
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

/** Move a nav item within or across sections. */
export function moveNavItem(layout, itemId, toSection, toIndex) {
  if (!SECTION_KEYS.includes(toSection)) return layout;

  const next = {
    main: [...(layout.main || [])],
    fleet_ops: [...(layout.fleet_ops || [])],
    platform: [...(layout.platform || [])],
    settings: [...(layout.settings || [])],
  };

  let fromSection = null;
  let fromIdx = -1;
  for (const section of SECTION_KEYS) {
    const idx = next[section].indexOf(itemId);
    if (idx >= 0) {
      fromSection = section;
      fromIdx = idx;
      break;
    }
  }
  if (fromSection == null) return layout;

  if (fromSection === toSection) {
    next[toSection] = reorderNav(layout[toSection] || [], itemId, toIndex);
    return { ...layout, ...next };
  }

  next[fromSection].splice(fromIdx, 1);
  const insertAt = Math.max(0, Math.min(toIndex, next[toSection].length));
  next[toSection].splice(insertAt, 0, itemId);
  return { ...layout, ...next };
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
