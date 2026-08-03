/** Admin sidebar — τμήματα: λειτουργίες · ενοικιάσεις · πλατφόρμα SaaS · ρυθμίσεις. */

import {
  TENANT_SETTINGS_TABS,
  PLATFORM_OPERATOR_TABS,
} from './settingsTabs.js';
import { settingsTabToNavItem } from './settingsSidebar.js';
import { buildRentDeskNavItems, RENT_DESK_NAV_IDS } from './rentDeskNav.js';

export const NAV_LAYOUT_STORAGE_KEY = 'aerostride_admin_nav_layout_v13';
export const NAV_ORDER_STORAGE_KEY = 'aerostride_admin_nav_order';
/** One-shot factory reset so broken local layouts cannot hide the sidebar. */
export const NAV_FACTORY_RESET_KEY = 'poreiago_admin_nav_factory_reset_v13';

export const DND_NAV_ID = 'application/x-aerostride-nav-id';

/** Hub subtabs only — never shown as top-level sidebar rows. */
export const FLEET_OPS_ONLY_IDS = [
  'fleet_kpis',
  'driver_chat',
  'fleet_route_playback',
  'fleet_calendar',
  'fleet_availability',
  'fleet_documents',
  'fleet_expenses',
  'fleet_digest',
];

const FLEET_OPS_ONLY_SET = new Set(FLEET_OPS_ONLY_IDS);

/** Core left-nav rows that must always remain reachable in «main». */
const CRITICAL_MAIN_IDS = [
  'dashboard',
  'fleet_live_map',
  'routes',
  'customers',
  'fleet',
  'fleet_ops',
  'drivers',
  'lost_found',
  'bookings',
  'email',
];

/** Platform SaaS tabs (Tenants, SaaS Infra, Backup, Growth) — superadmin only. */
export const PLATFORM_NAV_IDS = PLATFORM_OPERATOR_TABS.map((t) => `settings_${t.id}`);

export const DEFAULT_MAIN_NAV_ORDER = [
  'dashboard',
  'fleet_live_map',
  'routes',
  'customers',
  'loyalty',
  'fleet',
  'fleet_ops',
  'drivers',
  'lost_found',
  'email',
  'email_templates',
  'bookings',
];

/** Rent desk tabs under sidebar section «Ενοικιάσεις». */
export const DEFAULT_RENT_NAV_ORDER = [...RENT_DESK_NAV_IDS];

/** Rent-only office — no bus trips / coach fleet / driver ops. */
export const RENT_ONLY_MAIN_NAV_ORDER = [
  'dashboard',
  'customers',
  'loyalty',
  'fleet_live_map',
  'email',
  'email_templates',
];

export const RENT_ONLY_RENT_NAV_ORDER = [...RENT_DESK_NAV_IDS];

export const RENT_ONLY_SETTINGS_NAV_ORDER = [
  'settings_platform',
  'settings_homepage',
  'settings_domain',
  'settings_payments',
  'settings_fiscal',
  'settings_contracts',
  'settings_compliance',
  'settings_users',
];

export const RENT_ONLY_TAB_IDS = new Set([
  ...RENT_ONLY_MAIN_NAV_ORDER,
  'settings',
  'fleet_rental',
]);

/** Old single «Ενοικιάσεις» entry — replaced by rent desk subtabs. */
export const LEGACY_NAV_IDS = new Set([
  'settings',
  'payments',
  'fleet_active_drivers',
  'fleet_rental',
  'settings_telematics',
  'hybrid_sla',
]);

const PLATFORM_IDS = PLATFORM_NAV_IDS;
const OFFICE_SETTINGS_IDS = TENANT_SETTINGS_TABS.map((t) => `settings_${t.id}`);
const PLATFORM_ID_SET = new Set(PLATFORM_IDS);
const SECTION_KEYS = ['main', 'rent', 'fleet_ops', 'platform', 'settings'];

export function getDefaultNavLayout(isSuperAdmin) {
  return {
    main: [...DEFAULT_MAIN_NAV_ORDER],
    rent: [...DEFAULT_RENT_NAV_ORDER],
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

/**
 * Preserve free cross-section placement; only drop unknown / forbidden ids.
 * Also rescue menu rows that were dragged into the orphaned «fleet_ops» bucket
 * (that section is no longer rendered as a sidebar zone).
 */
function migrateNavLayout(layout, isSuperAdmin) {
  const defaults = getDefaultNavLayout(isSuperAdmin);
  const known = allKnownNavIds(isSuperAdmin);
  const next = { main: [], rent: [], fleet_ops: [], platform: [], settings: [] };
  const seen = new Set();

  for (const section of SECTION_KEYS) {
    if (section === 'platform' && !isSuperAdmin) continue;
    for (const id of layout[section] || []) {
      if (!id || LEGACY_NAV_IDS.has(id) || id === 'live_tracking') continue;
      if (!known.has(id)) continue;
      if (!isSuperAdmin && PLATFORM_ID_SET.has(id)) continue;
      if (seen.has(id)) continue;

      // fleet_ops section may only hold hub subtabs — everything else belongs in main.
      if (section === 'fleet_ops' && !FLEET_OPS_ONLY_SET.has(id)) {
        seen.add(id);
        next.main.push(id);
        continue;
      }

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

  // Guarantee core office tools are always in main (repair empty / wiped menus).
  for (const id of CRITICAL_MAIN_IDS) {
    if (!known.has(id) || seen.has(id)) continue;
    if (next.main.includes(id)) continue;
    seen.add(id);
    next.main.push(id);
  }
  for (const id of CRITICAL_MAIN_IDS) {
    if (next.main.includes(id)) continue;
    // Was only in another section — pull into main.
    for (const section of SECTION_KEYS) {
      if (section === 'main') continue;
      const idx = next[section].indexOf(id);
      if (idx < 0) continue;
      next[section].splice(idx, 1);
      next.main.push(id);
      break;
    }
  }

  // Keep fleet_ops bucket = hub subtabs only.
  next.fleet_ops = FLEET_OPS_ONLY_IDS.filter((id) => known.has(id));

  return next;
}

function splitLegacyFlatOrder(flat, isSuperAdmin) {
  const layout = getDefaultNavLayout(isSuperAdmin);
  const main = [];
  const rent = [];
  const platform = [];
  const settings = [];
  const fleet_ops = [];

  for (const id of flat) {
    if (LEGACY_NAV_IDS.has(id) || id === 'live_tracking') continue;
    if (PLATFORM_IDS.includes(id)) {
      if (isSuperAdmin) platform.push(id);
    } else if (OFFICE_SETTINGS_IDS.includes(id)) settings.push(id);
    else if (FLEET_OPS_ONLY_IDS.includes(id)) fleet_ops.push(id);
    else if (DEFAULT_RENT_NAV_ORDER.includes(id)) rent.push(id);
    else if (layout.main.includes(id) || ADMIN_NAV_ITEMS[id]) main.push(id);
  }

  return migrateNavLayout({ main, rent, fleet_ops, platform, settings }, isSuperAdmin);
}

export function loadNavLayout(isSuperAdmin) {
  const defaults = getDefaultNavLayout(isSuperAdmin);
  const storageKey = layoutStorageKey(isSuperAdmin);
  const legacyKeys = [
    storageKey,
    isSuperAdmin ? 'aerostride_admin_nav_layout_v12_super' : 'aerostride_admin_nav_layout_v12',
    isSuperAdmin ? 'aerostride_admin_nav_layout_v11_super' : 'aerostride_admin_nav_layout_v11',
    isSuperAdmin ? 'aerostride_admin_nav_layout_v10_super' : 'aerostride_admin_nav_layout_v10',
    isSuperAdmin ? 'aerostride_admin_nav_layout_v9_super' : 'aerostride_admin_nav_layout_v9',
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
            rent: parsed.rent || [],
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

/** Wipe all known layout keys and write a clean default menu. */
export function resetNavLayoutToDefault(isSuperAdmin) {
  const defaults = getDefaultNavLayout(isSuperAdmin);
  const keys = [
    layoutStorageKey(isSuperAdmin),
    layoutStorageKey(!isSuperAdmin),
    'aerostride_admin_nav_layout_v13',
    'aerostride_admin_nav_layout_v13_super',
    'aerostride_admin_nav_layout_v12',
    'aerostride_admin_nav_layout_v12_super',
    'aerostride_admin_nav_layout_v11',
    'aerostride_admin_nav_layout_v11_super',
    'aerostride_admin_nav_layout_v10',
    'aerostride_admin_nav_layout_v10_super',
    'aerostride_admin_nav_layout_v9',
    'aerostride_admin_nav_layout_v9_super',
    'aerostride_admin_nav_layout_v7',
    'aerostride_admin_nav_layout_v7_super',
    'aerostride_admin_nav_layout_v6',
    'aerostride_admin_nav_layout_v6_super',
    NAV_ORDER_STORAGE_KEY,
    `${NAV_ORDER_STORAGE_KEY}_super`,
  ];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  saveNavLayout(isSuperAdmin, defaults);
  try {
    localStorage.setItem(NAV_FACTORY_RESET_KEY, '1');
  } catch {
    /* ignore */
  }
  return defaults;
}

/**
 * One-shot hard reset for browsers that still have a broken custom layout.
 * Returns the layout to use (fresh defaults when reset runs).
 */
export function ensureFactoryNavReset(isSuperAdmin) {
  try {
    if (localStorage.getItem(NAV_FACTORY_RESET_KEY) === '1') {
      return loadNavLayout(isSuperAdmin);
    }
  } catch {
    /* fall through to reset */
  }
  return resetNavLayoutToDefault(isSuperAdmin);
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
  loyalty: {
    id: 'loyalty',
    label: 'Επιβραβεύσεις',
    icon: 'stars',
    filled: true,
    type: 'tab',
    tab: 'loyalty',
    navGroup: 'main',
    accent: 'amber',
  },
  fleet: {
    id: 'fleet',
    label: 'Στόλος λεωφορείων',
    icon: 'directions_bus',
    filled: true,
    type: 'tab',
    tab: 'fleet',
    navGroup: 'main',
    accent: 'sky',
  },
  fleet_ops: {
    id: 'fleet_ops',
    label: 'Λειτουργίες στόλου',
    icon: 'query_stats',
    filled: true,
    type: 'tab',
    tab: 'fleet_ops',
    navGroup: 'main',
    accent: 'cyan',
  },
  ...buildRentDeskNavItems(),
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
    label: 'Κρατήσεις λεωφορείων',
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
    rent: [...(layout.rent || [])],
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

export function getRentOnlyNavLayout(isSuperAdmin) {
  return {
    main: [...RENT_ONLY_MAIN_NAV_ORDER],
    rent: [...RENT_ONLY_RENT_NAV_ORDER],
    fleet_ops: [],
    platform: isSuperAdmin ? [...PLATFORM_IDS] : [],
    settings: [...RENT_ONLY_SETTINGS_NAV_ORDER],
  };
}

/**
 * Shape sidebar for office product mode.
 * - rent_only → fixed Rent desk menu (no buses)
 * - both / trips_only → stored layout as today
 */
export function navLayoutForOfficeMode(layout, officeMode, isSuperAdmin) {
  if (officeMode === 'rent_only') {
    return getRentOnlyNavLayout(isSuperAdmin);
  }
  return layout || getDefaultNavLayout(isSuperAdmin);
}

/** Tabs that bus-only / shared offices use but Rent-only must not open. */
const BUS_ONLY_TABS = new Set([
  'routes',
  'fleet',
  'drivers',
  'lost_found',
  'bookings',
  'driver_scan',
  'fleet_ops',
  ...FLEET_OPS_ONLY_IDS,
]);

export function isAdminTabAllowedForOfficeMode(tabId, officeMode) {
  if (officeMode !== 'rent_only') return true;
  if (!tabId) return true;
  if (tabId === 'settings') return true;
  if (BUS_ONLY_TABS.has(tabId)) return false;
  return RENT_ONLY_MAIN_NAV_ORDER.includes(tabId) || tabId === 'fleet_rental';
}

export function defaultAdminTabForOfficeMode(officeMode) {
  return officeMode === 'rent_only' ? 'fleet_rental' : 'dashboard';
}

export function navItemsInOrder(order, isSuperAdmin) {
  return navItemsFromIds(order, isSuperAdmin);
}
