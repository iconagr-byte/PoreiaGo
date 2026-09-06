/** Fleet operations hub — settings-style card rail catalog. */

export const FLEET_OPS_OVERVIEW_TAB = 'fleet';

export const DEFAULT_FLEET_OPS_TAB = 'fleet_kpis';

/** Full catalog for FleetOpsHub (Δείκτες → Ειδοποιήσεις). */
export const FLEET_OPS_HUB_TABS = [
  {
    id: 'fleet_kpis',
    label: 'Δείκτες στόλου',
    description: 'KPIs, πληρότητα και απόδοση',
    icon: 'analytics',
    accent: 'violet',
  },
  {
    id: 'driver_chat',
    label: 'Chat Οδηγών',
    description: 'Μηνύματα γραφείου ↔ οδηγός',
    icon: 'forum',
    accent: 'sky',
  },
  {
    id: 'fleet_route_playback',
    label: 'Ιστορικό Διαδρομής',
    description: 'Playback GPS διαδρομών',
    icon: 'route',
    accent: 'indigo',
  },
  {
    id: 'fleet_calendar',
    label: 'Ημερολόγιο',
    description: 'ΚΤΕΟ, ασφάλειες & service',
    icon: 'calendar_month',
    accent: 'sky',
  },
  {
    id: 'fleet_availability',
    label: 'Διαθεσιμότητα',
    description: 'Ποια οχήματα δέχονται κράτηση',
    icon: 'event_available',
    accent: 'emerald',
  },
  {
    id: 'fleet_documents',
    label: 'Έγγραφα',
    description: 'Άδειες, ασφάλειες & PDF',
    icon: 'folder_managed',
    accent: 'violet',
  },
  {
    id: 'fleet_expenses',
    label: 'Έξοδα στόλου',
    description: 'Καύσιμα, διόδια & κόστη',
    icon: 'local_gas_station',
    accent: 'amber',
  },
  {
    id: 'fleet_digest',
    label: 'Ειδοποιήσεις',
    description: 'Digest, email & push στόλου',
    icon: 'notifications_active',
    accent: 'rose',
  },
];

/** Compact tiles still used on the fleet overview page. */
export const FLEET_OPS_ITEMS = FLEET_OPS_HUB_TABS.filter((t) =>
  [
    'fleet_calendar',
    'fleet_availability',
    'fleet_documents',
    'fleet_expenses',
    'fleet_digest',
  ].includes(t.id),
).map((t) => ({
  ...t,
  label: t.id === 'fleet_expenses' ? 'Έξοδα' : t.label,
}));

const HUB_ID_SET = new Set(FLEET_OPS_HUB_TABS.map((t) => t.id));

export function isFleetOpsSubTab(id) {
  return HUB_ID_SET.has(String(id || '').trim());
}

export function sanitizeFleetOpsSubTab(id) {
  const raw = String(id || '').trim();
  if (HUB_ID_SET.has(raw)) return raw;
  return DEFAULT_FLEET_OPS_TAB;
}

const ACCENT = {
  sky: {
    card: 'from-sky-50/90 to-blue-50/40 border-sky-100/80 hover:border-sky-200',
    active: 'ring-2 ring-sky-400/70 border-sky-300 bg-white shadow-md',
    icon: 'bg-sky-500 text-white shadow-sky-200/60',
    badge: 'bg-sky-100 text-sky-800',
    badgeWarn: 'bg-rose-100 text-rose-800',
    rail: 'sky',
  },
  indigo: {
    card: 'from-indigo-50/90 to-blue-50/30 border-indigo-100/80 hover:border-indigo-200',
    active: 'ring-2 ring-indigo-400/70 border-indigo-300 bg-white shadow-md',
    icon: 'bg-indigo-500 text-white shadow-indigo-200/60',
    badge: 'bg-indigo-100 text-indigo-800',
    badgeWarn: 'bg-rose-100 text-rose-800',
    rail: 'indigo',
  },
  emerald: {
    card: 'from-emerald-50/90 to-teal-50/30 border-emerald-100/80 hover:border-emerald-200',
    active: 'ring-2 ring-emerald-400/70 border-emerald-300 bg-white shadow-md',
    icon: 'bg-emerald-500 text-white shadow-emerald-200/60',
    badge: 'bg-emerald-100 text-emerald-800',
    badgeWarn: 'bg-rose-100 text-rose-800',
    rail: 'emerald',
  },
  violet: {
    card: 'from-violet-50/90 to-indigo-50/30 border-violet-100/80 hover:border-violet-200',
    active: 'ring-2 ring-violet-400/70 border-violet-300 bg-white shadow-md',
    icon: 'bg-violet-500 text-white shadow-violet-200/60',
    badge: 'bg-violet-100 text-violet-800',
    badgeWarn: 'bg-rose-100 text-rose-800',
    rail: 'violet',
  },
  amber: {
    card: 'from-amber-50/90 to-orange-50/30 border-amber-100/80 hover:border-amber-200',
    active: 'ring-2 ring-amber-400/70 border-amber-300 bg-white shadow-md',
    icon: 'bg-amber-500 text-white shadow-amber-200/60',
    badge: 'bg-amber-100 text-amber-800',
    badgeWarn: 'bg-rose-100 text-rose-800',
    rail: 'amber',
  },
  rose: {
    card: 'from-rose-50/90 to-orange-50/20 border-rose-100/80 hover:border-rose-200',
    active: 'ring-2 ring-rose-400/70 border-rose-300 bg-white shadow-md',
    icon: 'bg-rose-500 text-white shadow-rose-200/60',
    badge: 'bg-rose-100 text-rose-800',
    badgeWarn: 'bg-rose-100 text-rose-800',
    rail: 'rose',
  },
};

export function fleetOpsAccent(accent) {
  return ACCENT[accent] || ACCENT.sky;
}

/** Badge label for each hub tile from aggregated stats. */
export function fleetOpsBadge(itemId, stats) {
  if (!stats) return null;
  switch (itemId) {
    case 'fleet_calendar': {
      const n = stats.calendarUrgent ?? 0;
      if (n > 0) return { text: `${n} επείγον`, warn: true };
      const total = stats.calendarTotal ?? 0;
      return total > 0 ? { text: `${total} θέματα`, warn: false } : null;
    }
    case 'fleet_availability': {
      const blocked = stats.blocked ?? 0;
      if (blocked > 0) return { text: `${blocked} μπλοκ`, warn: true };
      const avail = stats.available ?? 0;
      return avail > 0 ? { text: `${avail} ελεύθερα`, warn: false } : null;
    }
    case 'fleet_documents': {
      const n = stats.documents ?? 0;
      return n > 0 ? { text: `${n} αρχεία`, warn: false } : null;
    }
    case 'fleet_expenses': {
      const total = Number(stats.expenseTotal || 0);
      if (total <= 0) return null;
      return {
        text: total >= 1000 ? `€${(total / 1000).toFixed(1)}k` : `€${Math.round(total)}`,
        warn: false,
      };
    }
    case 'fleet_digest': {
      const n = stats.alerts ?? 0;
      return n > 0 ? { text: `${n} alerts`, warn: true } : null;
    }
    default:
      return null;
  }
}
