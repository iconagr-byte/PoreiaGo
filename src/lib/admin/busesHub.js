/** Buses hub — one sidebar card «Λεωφορεία», menu rail on the right. */

import { isFleetOpsSubTab } from './fleetOpsHub.js';

export const DEFAULT_BUSES_HUB_TAB = 'routes';

export const BUSES_HUB_TABS = [
  {
    id: 'routes',
    label: 'Εκδρομές',
    description: 'Δρομολόγια, θέσεις και τιμές',
    icon: 'route',
    accent: 'emerald',
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
