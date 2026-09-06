/**
 * Design-page gating from office contract modules (pure helpers).
 */

export function isRentOnlyModules(modules) {
  return Boolean(modules?.rent_enabled) && !modules?.trips_enabled;
}

export function officeModeFromModules(modules) {
  if (isRentOnlyModules(modules)) return 'rent_only';
  if (modules?.rent_enabled && modules?.trips_enabled) return 'both';
  return 'trips_only';
}

/**
 * Which landing pages the office may design, based on paid contract modules.
 * @returns {{ id: 'home'|'rent', allowed: boolean }[]}
 */
export function designPagesForModules(modules) {
  const mode = officeModeFromModules(modules);
  if (mode === 'rent_only') {
    return [{ id: 'rent', allowed: true }];
  }
  if (mode === 'trips_only') {
    return [{ id: 'home', allowed: true }];
  }
  return [
    { id: 'home', allowed: true },
    { id: 'rent', allowed: true },
  ];
}

/** Resolve design page id against contract; falls back to first allowed. */
export function resolveDesignPageForModules(requested, modules) {
  const allowed = designPagesForModules(modules).map((p) => p.id);
  const want = requested === 'rent' ? 'rent' : 'home';
  if (allowed.includes(want)) return want;
  return allowed[0] || 'home';
}

export function contractDesignLabel(mode) {
  if (mode === 'rent_only') return 'Συμβόλαιο · μόνο Ενοικιάσεις';
  if (mode === 'both') return 'Συμβόλαιο · Λεωφορεία + Ενοικιάσεις';
  return 'Συμβόλαιο · μόνο Λεωφορεία';
}
