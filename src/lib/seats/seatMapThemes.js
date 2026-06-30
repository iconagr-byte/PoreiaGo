/** Premium seat-map palettes keyed by trip `vehicleType` / fleet category. */

export const SEAT_MAP_THEMES = {
  'Luxury Coach': {
    id: 'luxury-coach',
    label: 'Luxury Coach',
    vipLabel: 'VIP Gold',
    frameOuter: 'from-amber-500/35 via-slate-500/20 to-amber-900/30',
    frameInner: 'from-[#0c1222] via-[#111827] to-[#0a0f18]',
    driverIconBorder: 'border-amber-500/30',
    driverIconText: 'text-amber-400/90',
    driverLabel: 'text-amber-200/90',
    shine: 'via-amber-400/30',
    interior: 'from-[#151c2c] to-[#0d121c]',
    rail: 'from-amber-600/20 via-amber-400/10 to-transparent',
    aisle:
      'bg-[repeating-linear-gradient(180deg,rgba(212,175,55,0.15)_0px,rgba(212,175,55,0.15)_6px,transparent_6px,transparent_12px)]',
    rowNumber: 'text-amber-200/35',
    rearAccent: 'via-amber-500/25',
    footerCount: 'text-amber-700/90',
    vip: {
      cushion:
        'bg-gradient-to-b from-[#f7e7b8] via-[#e8c872] to-[#c9a227] border-amber-300/60 text-slate-900 shadow-[0_4px_14px_rgba(212,175,55,0.35)]',
      headrest: 'bg-gradient-to-b from-[#fff8e7] to-[#d4af37]',
      badge: 'bg-slate-900 border-amber-300/80',
      badgeIcon: 'text-amber-300',
      legend: 'bg-gradient-to-b from-[#f7e7b8] to-[#c9a227] border-amber-300/50',
    },
    selected: {
      cushion:
        'bg-gradient-to-b from-slate-950 to-slate-800 border-amber-400/70 text-amber-100 shadow-[0_0_18px_rgba(212,175,55,0.45)] ring-1 ring-amber-300/50',
      headrest: 'bg-slate-700 ring-1 ring-amber-400/40',
      ring: 'ring-amber-400/60',
      legend:
        'bg-gradient-to-b from-slate-950 to-slate-800 border-amber-400/60 shadow-[0_0_8px_rgba(212,175,55,0.35)]',
    },
    available: {
      cushion:
        'bg-gradient-to-b from-[#faf8f5] to-[#ebe6dc] border-white/40 text-slate-800 shadow-[0_3px_10px_rgba(0,0,0,0.25)] hover:border-amber-200/50',
      headrest: 'bg-gradient-to-b from-white to-[#e8e4dc]',
      legend: 'bg-gradient-to-b from-[#faf8f5] to-[#ebe6dc] border-white/50',
    },
  },
  'Premium Express': {
    id: 'premium-express',
    label: 'Premium Express',
    vipLabel: 'VIP Platinum',
    frameOuter: 'from-sky-400/30 via-slate-400/15 to-indigo-900/25',
    frameInner: 'from-[#0a1628] via-[#0f172a] to-[#070d18]',
    driverIconBorder: 'border-sky-400/35',
    driverIconText: 'text-sky-300/90',
    driverLabel: 'text-sky-100/85',
    shine: 'via-sky-300/25',
    interior: 'from-[#111827] to-[#0a101c]',
    rail: 'from-sky-500/15 via-slate-300/10 to-transparent',
    aisle:
      'bg-[repeating-linear-gradient(180deg,rgba(148,163,184,0.18)_0px,rgba(148,163,184,0.18)_6px,transparent_6px,transparent_12px)]',
    rowNumber: 'text-sky-200/30',
    rearAccent: 'via-sky-400/20',
    footerCount: 'text-sky-700/90',
    vip: {
      cushion:
        'bg-gradient-to-b from-[#f8fafc] via-[#cbd5e1] to-[#64748b] border-slate-200/70 text-slate-800 shadow-[0_4px_14px_rgba(100,116,139,0.35)]',
      headrest: 'bg-gradient-to-b from-white to-[#94a3b8]',
      badge: 'bg-slate-800 border-slate-200/80',
      badgeIcon: 'text-sky-200',
      legend: 'bg-gradient-to-b from-[#f8fafc] to-[#64748b] border-slate-300/50',
    },
    selected: {
      cushion:
        'bg-gradient-to-b from-[#0c4a6e] to-[#1e3a5f] border-sky-300/60 text-sky-50 shadow-[0_0_18px_rgba(56,189,248,0.4)] ring-1 ring-sky-300/40',
      headrest: 'bg-sky-900 ring-1 ring-sky-300/35',
      ring: 'ring-sky-300/55',
      legend:
        'bg-gradient-to-b from-[#0c4a6e] to-[#1e3a5f] border-sky-300/50 shadow-[0_0_8px_rgba(56,189,248,0.35)]',
    },
    available: {
      cushion:
        'bg-gradient-to-b from-[#f8fafc] to-[#e2e8f0] border-white/50 text-slate-700 shadow-[0_3px_10px_rgba(15,23,42,0.2)] hover:border-sky-200/60',
      headrest: 'bg-gradient-to-b from-white to-[#e2e8f0]',
      legend: 'bg-gradient-to-b from-[#f8fafc] to-[#e2e8f0] border-white/50',
    },
  },
  'VIP Minibus': {
    id: 'vip-minibus',
    label: 'VIP Minibus',
    vipLabel: 'VIP Rose',
    frameOuter: 'from-rose-400/30 via-slate-500/15 to-rose-950/30',
    frameInner: 'from-[#1a0a12] via-[#150c14] to-[#0f0810]',
    driverIconBorder: 'border-rose-400/35',
    driverIconText: 'text-rose-300/90',
    driverLabel: 'text-rose-100/85',
    shine: 'via-rose-300/25',
    interior: 'from-[#1f1018] to-[#120a10]',
    rail: 'from-rose-500/20 via-rose-300/10 to-transparent',
    aisle:
      'bg-[repeating-linear-gradient(180deg,rgba(244,114,182,0.12)_0px,rgba(244,114,182,0.12)_6px,transparent_6px,transparent_12px)]',
    rowNumber: 'text-rose-200/30',
    rearAccent: 'via-rose-400/20',
    footerCount: 'text-rose-800/80',
    vip: {
      cushion:
        'bg-gradient-to-b from-[#fce7f3] via-[#f9a8d4] to-[#be185d] border-rose-200/60 text-rose-950 shadow-[0_4px_14px_rgba(190,24,93,0.3)]',
      headrest: 'bg-gradient-to-b from-[#fff1f2] to-[#fb7185]',
      badge: 'bg-rose-950 border-rose-200/70',
      badgeIcon: 'text-rose-200',
      legend: 'bg-gradient-to-b from-[#fce7f3] to-[#be185d] border-rose-200/50',
    },
    selected: {
      cushion:
        'bg-gradient-to-b from-[#4a1c2e] to-[#701a3a] border-rose-300/55 text-rose-50 shadow-[0_0_18px_rgba(244,114,182,0.35)] ring-1 ring-rose-300/40',
      headrest: 'bg-rose-900 ring-1 ring-rose-300/35',
      ring: 'ring-rose-300/55',
      legend:
        'bg-gradient-to-b from-[#4a1c2e] to-[#701a3a] border-rose-300/50 shadow-[0_0_8px_rgba(244,114,182,0.3)]',
    },
    available: {
      cushion:
        'bg-gradient-to-b from-[#fff1f2] to-[#fecdd3] border-white/40 text-rose-950/80 shadow-[0_3px_10px_rgba(76,5,25,0.15)] hover:border-rose-200/60',
      headrest: 'bg-gradient-to-b from-white to-[#fecdd3]',
      legend: 'bg-gradient-to-b from-[#fff1f2] to-[#fecdd3] border-white/50',
    },
  },
  Standard: {
    id: 'standard',
    label: 'Standard Coach',
    vipLabel: 'VIP Comfort',
    frameOuter: 'from-emerald-500/25 via-slate-500/15 to-emerald-950/25',
    frameInner: 'from-[#0a1410] via-[#0f1712] to-[#080f0c]',
    driverIconBorder: 'border-emerald-500/30',
    driverIconText: 'text-emerald-400/90',
    driverLabel: 'text-emerald-100/85',
    shine: 'via-emerald-400/25',
    interior: 'from-[#121f18] to-[#0a120e]',
    rail: 'from-emerald-600/15 via-emerald-400/10 to-transparent',
    aisle:
      'bg-[repeating-linear-gradient(180deg,rgba(52,211,153,0.12)_0px,rgba(52,211,153,0.12)_6px,transparent_6px,transparent_12px)]',
    rowNumber: 'text-emerald-200/30',
    rearAccent: 'via-emerald-500/20',
    footerCount: 'text-emerald-800/85',
    vip: {
      cushion:
        'bg-gradient-to-b from-[#d1fae5] via-[#6ee7b7] to-[#059669] border-emerald-200/60 text-emerald-950 shadow-[0_4px_14px_rgba(5,150,105,0.28)]',
      headrest: 'bg-gradient-to-b from-[#ecfdf5] to-[#34d399]',
      badge: 'bg-emerald-950 border-emerald-300/70',
      badgeIcon: 'text-emerald-200',
      legend: 'bg-gradient-to-b from-[#d1fae5] to-[#059669] border-emerald-200/50',
    },
    selected: {
      cushion:
        'bg-gradient-to-b from-[#064e3b] to-[#065f46] border-emerald-300/55 text-emerald-50 shadow-[0_0_16px_rgba(52,211,153,0.35)] ring-1 ring-emerald-300/40',
      headrest: 'bg-emerald-900 ring-1 ring-emerald-300/35',
      ring: 'ring-emerald-300/55',
      legend:
        'bg-gradient-to-b from-[#064e3b] to-[#065f46] border-emerald-300/50 shadow-[0_0_8px_rgba(52,211,153,0.3)]',
    },
    available: {
      cushion:
        'bg-gradient-to-b from-[#f0fdf4] to-[#dcfce7] border-white/45 text-emerald-950/80 shadow-[0_3px_10px_rgba(6,78,59,0.12)] hover:border-emerald-200/55',
      headrest: 'bg-gradient-to-b from-white to-[#dcfce7]',
      legend: 'bg-gradient-to-b from-[#f0fdf4] to-[#dcfce7] border-white/50',
    },
  },
};

const DEFAULT_SEAT_MAP_THEME = SEAT_MAP_THEMES['Luxury Coach'];

export { DEFAULT_SEAT_MAP_THEME };

/** @param {string | undefined | null} vehicleType */
export function getSeatMapTheme(vehicleType) {
  if (!vehicleType) return DEFAULT_SEAT_MAP_THEME;
  if (SEAT_MAP_THEMES[vehicleType]) return SEAT_MAP_THEMES[vehicleType];

  const normalized = String(vehicleType).trim().toLowerCase();
  const match = Object.entries(SEAT_MAP_THEMES).find(
    ([key]) => key.toLowerCase() === normalized,
  );
  if (match) return match[1];

  if (normalized.includes('luxury')) return SEAT_MAP_THEMES['Luxury Coach'];
  if (normalized.includes('premium') || normalized.includes('express')) {
    return SEAT_MAP_THEMES['Premium Express'];
  }
  if (normalized.includes('minibus') || normalized.includes('vip')) {
    return SEAT_MAP_THEMES['VIP Minibus'];
  }
  if (normalized.includes('standard')) return SEAT_MAP_THEMES.Standard;

  return DEFAULT_SEAT_MAP_THEME;
}

/** @param {{ vehicleType?: string, vehiclePlate?: string }} trip */
export function resolveTripSeatMapTheme(trip) {
  return getSeatMapTheme(trip?.vehicleType);
}

/** Header chrome classes per theme (SeatSelection hero strip). */
export function getSeatMapHeaderClasses(theme) {
  const t = theme || DEFAULT_SEAT_MAP_THEME;
  if (t.id === 'premium-express') {
    return {
      wrapper:
        'bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 border-sky-400/20 shadow-[0_20px_50px_rgba(14,116,144,0.2)]',
      glow: 'bg-sky-400/10',
      badge: 'text-sky-300/90',
      accent: 'text-sky-200',
      plate: 'text-sky-200/40',
    };
  }
  if (t.id === 'vip-minibus') {
    return {
      wrapper:
        'bg-gradient-to-br from-rose-950 via-slate-900 to-rose-950 border-rose-400/20 shadow-[0_20px_50px_rgba(190,24,93,0.15)]',
      glow: 'bg-rose-400/10',
      badge: 'text-rose-300/90',
      accent: 'text-rose-200',
      plate: 'text-rose-200/40',
    };
  }
  if (t.id === 'standard') {
    return {
      wrapper:
        'bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 border-emerald-500/20 shadow-[0_20px_50px_rgba(5,150,105,0.15)]',
      glow: 'bg-emerald-400/10',
      badge: 'text-emerald-300/90',
      accent: 'text-emerald-200',
      plate: 'text-emerald-200/40',
    };
  }
  return {
    wrapper:
      'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-amber-500/20 shadow-[0_20px_50px_rgba(15,23,42,0.25)]',
    glow: 'bg-amber-400/10',
    badge: 'text-amber-300/90',
    accent: 'text-amber-200',
    plate: 'text-amber-200/40',
  };
}

export function getSeatMapCheckoutButtonClass(hasSelection, theme) {
  if (!hasSelection) return 'bg-slate-200 text-slate-400 cursor-not-allowed';
  const t = theme || DEFAULT_SEAT_MAP_THEME;
  if (t.id === 'premium-express') {
    return 'bg-gradient-to-r from-sky-900 to-slate-900 text-sky-50 hover:from-sky-800 hover:to-slate-800 shadow-lg shadow-sky-900/25';
  }
  if (t.id === 'vip-minibus') {
    return 'bg-gradient-to-r from-rose-950 to-slate-900 text-rose-50 hover:from-rose-900 hover:to-slate-800 shadow-lg shadow-rose-950/25';
  }
  if (t.id === 'standard') {
    return 'bg-gradient-to-r from-emerald-900 to-slate-900 text-emerald-50 hover:from-emerald-800 hover:to-slate-800 shadow-lg shadow-emerald-900/20';
  }
  return 'bg-gradient-to-r from-slate-900 to-slate-800 text-amber-50 hover:from-slate-800 hover:to-slate-700 shadow-lg shadow-slate-900/20';
}
