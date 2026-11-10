const PREVIEW_KEY = 'aerostride_homepage_preview_v1';
const STORAGE_KEY = 'aerostride_site_appearance_v1';
const CHANNEL_NAME = 'poreiago-homepage-preview';
const EVENT_NAME = 'poreiago-homepage-preview';

let channel = null;

function getChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      channel = null;
    }
  }
  return channel;
}

function stripPreviewMeta(data) {
  if (!data || typeof data !== 'object') return null;
  const { _previewAt, ...appearance } = data;
  return appearance;
}

/** Γράφει draft στο localStorage για live preview (storefront + iframe). */
export function pushHomepagePreviewDraft(appearance) {
  try {
    const payload = { ...appearance, _previewAt: Date.now() };
    sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(payload));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
    try {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: appearance }));
    } catch {
      /* ignore */
    }
    try {
      getChannel()?.postMessage(payload);
    } catch {
      /* ignore */
    }
  } catch {
    /* quota */
  }
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
  try {
    sessionStorage.removeItem(PREVIEW_KEY);
  } catch {
    /* ignore */
  }
}

export function isStorefrontPreviewMode() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('preview') === '1';
}

/**
 * Subscribe to live draft updates from the page-design editor (same-window
 * CustomEvent, cross-frame BroadcastChannel, and localStorage storage events).
 * @param {(appearance: object|null) => void} onDraft
 * @returns {() => void} unsubscribe
 */
export function subscribeHomepagePreviewDraft(onDraft) {
  if (typeof window === 'undefined' || typeof onDraft !== 'function') {
    return () => {};
  }

  const emit = () => {
    onDraft(readHomepagePreviewDraft());
  };

  const onStorage = (e) => {
    if (
      e.key === PREVIEW_KEY ||
      e.key === STORAGE_KEY ||
      (e.key == null && e.storageArea === localStorage)
    ) {
      emit();
    }
  };

  const onCustom = (e) => {
    if (e?.detail && typeof e.detail === 'object') {
      onDraft(stripPreviewMeta({ ...e.detail }));
      return;
    }
    emit();
  };

  const onChannel = (e) => {
    onDraft(stripPreviewMeta(e?.data));
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(EVENT_NAME, onCustom);
  let bc = null;
  try {
    bc = getChannel();
    bc?.addEventListener?.('message', onChannel);
  } catch {
    bc = null;
  }

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(EVENT_NAME, onCustom);
    try {
      bc?.removeEventListener?.('message', onChannel);
    } catch {
      /* ignore */
    }
  };
}
