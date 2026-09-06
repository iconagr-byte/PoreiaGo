/** Buses hub — one sidebar card «Λεωφορεία», menu rail on the right. */

import { isFleetOpsSubTab } from './fleetOpsHub.js';

export const DEFAULT_BUSES_HUB_TAB = 'routes';

export const BUSES_HUB_ORDER_KEY = 'poreiago_buses_hub_order_v1';

export const BUSES_HUB_TABS = [
  {
    id: 'routes',
    label: 'Εκδρομές',
    description: 'Δρομολόγια, θέσεις και τιμές',
    icon: 'route',
    accent: 'emerald',
  },
  {
    id: 'customers',
    label: 'Πελάτες λεωφορείων',
    description: 'CRM επιβατών — χωριστά από ενοικιάσεις',
    icon: 'group',
    accent: 'violet',
  },
  {
    id: 'fleet',
    label: 'Στόλος λεωφορείων',
    description: 'Οχήματα, πινακίδες και κατάσταση',
    icon: 'directions_bus',
    accent: 'sky',
  },
  {
    id: 'fleet_ops',
    label: 'Λειτουργίες στόλου',
    description: 'GPS · KPIs · ημερολόγιο',
    icon: 'query_stats',
    accent: 'cyan',
  },
  {
    id: 'drivers',
    label: 'Οδηγοί / App',
    description: 'Λογαριασμοί και βάρδιες',
    icon: 'badge',
    accent: 'indigo',
  },
  {
    id: 'bus_setup',
    label: 'Master QR & PWA',
    description: 'Είσοδος οδηγού και εγκατάσταση στο κινητό',
    icon: 'qr_code_2',
    accent: 'amber',
  },
  {
    id: 'lost_found',
    label: 'Απωλεσθέντα',
    description: 'Αναφορές επιβατών',
    icon: 'support_agent',
    accent: 'rose',
  },
  {
    id: 'bookings',
    label: 'Κρατήσεις λεωφορείων',
    description: 'Ticket desk και πληρωμές',
    icon: 'confirmation_number',
    accent: 'blue',
  },
];

export const BUSES_HUB_TAB_IDS = BUSES_HUB_TABS.map((t) => t.id);

const BUSES_HUB_ID_SET = new Set(BUSES_HUB_TAB_IDS);

/** Merge saved order with current catalog (keep known ids, append new ones). */
export function normalizeBusesHubOrder(raw) {
  const seen = new Set();
  const next = [];
  const input = Array.isArray(raw) ? raw : [];
  for (const id of input) {
    const key = String(id || '').trim();
    if (!BUSES_HUB_ID_SET.has(key) || seen.has(key)) continue;
    seen.add(key);
    next.push(key);
  }
  for (const id of BUSES_HUB_TAB_IDS) {
    if (seen.has(id)) continue;
    next.push(id);
  }
  return next;
}

export function loadBusesHubOrder() {
  try {
    const raw = JSON.parse(localStorage.getItem(BUSES_HUB_ORDER_KEY) || 'null');
    return normalizeBusesHubOrder(raw);
  } catch {
    return [...BUSES_HUB_TAB_IDS];
  }
}

export function saveBusesHubOrder(order) {
  const safe = normalizeBusesHubOrder(order);
  try {
    localStorage.setItem(BUSES_HUB_ORDER_KEY, JSON.stringify(safe));
  } catch {
    /* ignore */
  }
  return safe;
}

/** Move `fromId` so it inserts before `toIndex` in the current order. */
export function moveBusesHubTab(order, fromId, toIndex) {
  const current = normalizeBusesHubOrder(order);
  const from = current.indexOf(fromId);
  if (from < 0) return current;
  let to = Math.max(0, Math.min(Number(toIndex) || 0, current.length));
  // Dropping on self / immediately after self is a no-op.
  if (from === to || from + 1 === to) return current;
  const next = current.slice();
  next.splice(from, 1);
  if (to > from) to -= 1;
  next.splice(to, 0, fromId);
  return next;
}

export function busesHubTabsInOrder(order) {
  const ids = normalizeBusesHubOrder(order);
  const byId = new Map(BUSES_HUB_TABS.map((t) => [t.id, t]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/** Top-level buses hub tab, or a nested fleet-ops subtab. */
export function isBusesHubTab(tab) {
  const id = String(tab || '').trim();
  if (!id) return false;
  if (BUSES_HUB_ID_SET.has(id)) return true;
  return isFleetOpsSubTab(id);
}

export function sanitizeBusesHubTab(tab) {
  const id = String(tab || '').trim();
  if (BUSES_HUB_ID_SET.has(id)) return id;
  if (isFleetOpsSubTab(id)) return 'fleet_ops';
  return DEFAULT_BUSES_HUB_TAB;
}
