/**
 * Which Stitch campaign packs unlock from office contract / modules.
 *
 * - rent → Rent standalone plan or Rent add-on (rent_enabled)
 * - newsletter → active bus/agency or Rent contract (paid / trial office)
 */

import { canAccessPlatformOperatorUi, isImpersonating } from '../saasJwt.js';
import { isPlatformMarketingHost } from '../platform/tenantHost.js';

const ACTIVE_SUB_STATUSES = new Set([
  'active',
  'trialing',
  'trial',
  'paid',
  'ok',
]);

/**
 * @param {{
 *   rentEnabled?: boolean,
 *   modules?: { rent_enabled?: boolean, plan?: string, trips_enabled?: boolean },
 *   subscription?: { status?: string, plan?: string } | null,
 *   hostname?: string,
 * }} opts
 */
export function resolveStitchTemplateAccess(opts = {}) {
  const modules = opts.modules || {};
  const rentEnabled =
    opts.rentEnabled != null
      ? Boolean(opts.rentEnabled)
      : Boolean(modules.rent_enabled);

  const hostname =
    opts.hostname ||
    (typeof window !== 'undefined' ? window.location.hostname : '');

  // Platform / superadmin always see locked packs (demo + sales).
  try {
    if (
      !isImpersonating() &&
      (canAccessPlatformOperatorUi() || isPlatformMarketingHost(hostname))
    ) {
      return { rentEnabled: true, newsletterEnabled: true, unlocked: true };
    }
  } catch {
    /* node / no localStorage */
  }

  const status = String(opts.subscription?.status || '').trim().toLowerCase();
  const plan = String(opts.subscription?.plan || modules.plan || '')
    .trim()
    .toLowerCase();
  const hasPlan = Boolean(plan) && plan !== 'none' && plan !== 'free';
  const statusOk = !status || ACTIVE_SUB_STATUSES.has(status);
  const newsletterEnabled = Boolean(hasPlan && statusOk) || rentEnabled;

  return {
    rentEnabled,
    newsletterEnabled,
    unlocked: rentEnabled || newsletterEnabled,
  };
}

export function isStitchTemplateUnlocked(template, access) {
  const req = template?.requiresModule;
  if (!req) return true;
  if (req === 'rent') return Boolean(access?.rentEnabled);
  if (req === 'newsletter') return Boolean(access?.newsletterEnabled);
  return true;
}

export function filterStitchCategories(categories, access) {
  return (categories || []).filter((cat) => {
    if (!cat.requiresModule) return true;
    if (cat.requiresModule === 'rent') return true; // keep visible (locked state in UI)
    if (cat.requiresModule === 'newsletter') return true;
    return true;
  });
}

export function stitchModuleLockCopy(requiresModule) {
  if (requiresModule === 'rent') {
    return {
      title: 'Απαιτεί συμβόλαιο Ενοικιάσεων',
      body: 'Ενεργοποιείται με το PoreiaGo Rent ή το add-on Ενοικιάσεις στο συμβόλαιό σας.',
      cta: 'Άνοιγμα συμβολαίων',
    };
  }
  if (requiresModule === 'newsletter') {
    return {
      title: 'Απαιτεί ενεργό συμβόλαιο',
      body: 'Τα πρότυπα Newsletter ξεκλειδώνουν όταν αγοράσετε / ενεργοποιήσετε συμβόλαιο γραφείου.',
      cta: 'Άνοιγμα συμβολαίων',
    };
  }
  return {
    title: 'Κλειδωμένο',
    body: 'Διαθέσιμο με ενεργό συμβόλαιο.',
    cta: 'Άνοιγμα συμβολαίων',
  };
}
