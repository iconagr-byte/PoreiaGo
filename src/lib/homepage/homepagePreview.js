const PREVIEW_KEY = 'aerostride_homepage_preview_v1';
const STORAGE_KEY = 'aerostride_site_appearance_v1';

/** Γράφει draft στο localStorage για live preview (storefront + iframe). */
export function pushHomepagePreviewDraft(appearance) {
  try {
    const payload = { ...appearance, _previewAt: Date.now() };
    sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(payload));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    /* quota */
  }
}

function stripPreviewMeta(data) {
  if (!data || typeof data !== 'object') return null;
  const { _previewAt, ...appearance } = data;
  return appearance;
}

export function readHomepagePreviewDraft() {
  try {
    const raw = sessionStorage.getItem(PREVIEW_KEY);
    if (raw) return stripPreviewMeta(JSON.parse(raw));

    // Το iframe έχει δικό του sessionStorage — το draft συγχρονίζεται μέσω localStorage.
    if (isStorefrontPreviewMode()) {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) return JSON.parse(cached);
    }
  } catch {
    return null;
  }
  return null;
}

export function clearHomepagePreviewDraft() {
  sessionStorage.removeItem(PREVIEW_KEY);
}

export function isStorefrontPreviewMode() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('preview') === '1';
}
