/**
 * Bidirectional bridge between Page Design admin (parent) and storefront
 * preview iframe — Divi-like inline Builder without chrome toolbar.
 *
 * Uses BroadcastChannel + window.postMessage (iframe ↔ parent / parent → iframes).
 */

const CHANNEL_NAME = 'poreiago-pdw-bridge';
export const PDW_BRIDGE_SOURCE = 'poreiago-pdw';

export const PDW_BRIDGE = {
  /** iframe → parent: select left-nav section */
  SELECT_SECTION: 'select-section',
  /** parent → iframe: highlight focused section */
  SECTION_FOCUS: 'section-focus',
  /** parent → iframe: smooth-scroll preview to section (re-fires on same nav click) */
  SCROLL_TO_SECTION: 'scroll-to-section',
  /** iframe → parent: merge appearance into editor form (Save / dirty) */
  APPEARANCE_SYNC: 'appearance-sync',
  /** iframe → parent: jump to Themes gallery */
  REQUEST_THEMES: 'request-themes',
};

/**
 * Ordered CSS selectors (or `{ top: true }`) for each Page Design nav section.
 * Prefer stable `data-pdw-*` / `#id` anchors on the storefront preview.
 */
export const PDW_SECTION_SCROLL_TARGETS = {
  themes: [{ top: true }],
  general: [
    '[data-pdw-editable="hero"]',
    '#hero',
    '#pdw-hero',
    'main',
  ],
  header: [
    '[data-pdw-editable="header"]',
    '#header',
    '#pdw-header',
    'header',
    { top: true },
  ],
  hero: ['[data-pdw-editable="hero"]', '#hero', '#pdw-hero'],
  /** Slider edits live on the hero canvas */
  slider: ['[data-pdw-editable="hero"]', '#hero', '#pdw-hero'],
  trips: [
    '[data-pdw-editable="trips"]',
    '#trips',
    '#pdw-trips',
    '#search-results',
    '#programma-ekdromon',
  ],
  branding: [
    '[data-pdw-brand]',
    '#pdw-brand',
    '[data-pdw-editable="header"]',
    '#header',
    { top: true },
  ],
  footer: [
    '[data-pdw-editable="footer"]',
    '#footer',
    '#pdw-footer',
    'footer',
  ],
};

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

export function isPdwBridgeMessage(data) {
  return Boolean(data && typeof data === 'object' && data.source === PDW_BRIDGE_SOURCE && data.type);
}

function postToChildIframes(payload) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  // Only the top (admin) window fans out into preview iframes.
  if (window.parent && window.parent !== window) return;
  try {
    document.querySelectorAll('iframe').forEach((frame) => {
      try {
        frame.contentWindow?.postMessage(payload, '*');
      } catch {
        /* cross-origin or detached */
      }
    });
  } catch {
    /* ignore */
  }
}

/** Publish a bridge event to the other frame / same-tab listeners. */
export function postPdwBridge(partial) {
  if (typeof window === 'undefined' || !partial?.type) return;
  const payload = {
    source: PDW_BRIDGE_SOURCE,
    ...partial,
    _at: Date.now(),
  };
  try {
    getChannel()?.postMessage(payload);
  } catch {
    /* ignore */
  }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, '*');
    }
  } catch {
    /* ignore */
  }
  postToChildIframes(payload);
  try {
    window.dispatchEvent(new CustomEvent(CHANNEL_NAME, { detail: payload }));
  } catch {
    /* ignore */
  }
}

/**
 * Parent helper: ask the live preview to smooth-scroll to a left-nav section.
 * @param {string} sectionId
 */
export function postPdwScrollToSection(sectionId) {
  if (!sectionId) return;
  postPdwBridge({ type: PDW_BRIDGE.SCROLL_TO_SECTION, section: sectionId });
}

/**
 * Resolve the first matching scroll target for a Page Design section.
 * @param {string} sectionId
 * @param {Document|ParentNode} [root]
 * @returns {Element|null|{ top: true }|null}
 */
export function resolvePdwScrollTarget(sectionId, root) {
  const doc = root || (typeof document !== 'undefined' ? document : null);
  if (!sectionId || !doc) return null;
  const targets = PDW_SECTION_SCROLL_TARGETS[sectionId];
  if (!targets?.length) {
    const byAttr =
      typeof doc.querySelector === 'function'
        ? doc.querySelector(`[data-pdw-editable="${sectionId}"]`)
        : null;
    return byAttr || null;
  }
  for (const target of targets) {
    if (target && typeof target === 'object' && target.top) {
      return { top: true };
    }
    if (typeof target === 'string' && typeof doc.querySelector === 'function') {
      const el = doc.querySelector(target);
      if (el) return el;
    }
  }
  return null;
}

/**
 * Smooth-scroll the preview document to the matching storefront section.
 * @param {string} sectionId
 * @param {{ behavior?: ScrollBehavior, block?: ScrollLogicalPosition, root?: Document }} [opts]
 * @returns {boolean}
 */
export function scrollPreviewToSection(sectionId, opts = {}) {
  const {
    behavior = 'smooth',
    block = 'start',
    root = typeof document !== 'undefined' ? document : null,
  } = opts;
  if (!sectionId || !root) return false;

  const attempt = () => {
    const target = resolvePdwScrollTarget(sectionId, root);
    if (!target) return false;
    if (target.top) {
      const win = root.defaultView || (typeof window !== 'undefined' ? window : null);
      const scroller = root.scrollingElement || root.documentElement || root.body;
      if (typeof scroller?.scrollTo === 'function') {
        scroller.scrollTo({ top: 0, behavior });
      } else if (win) {
        win.scrollTo({ top: 0, behavior });
      }
      return true;
    }
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior, block });
      return true;
    }
    return false;
  };

  let ok = attempt();
  if (!ok && typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      attempt();
    });
  }
  return ok;
}

/**
 * @param {(msg: object) => void} onMessage
 * @returns {() => void}
 */
export function subscribePdwBridge(onMessage) {
  if (typeof window === 'undefined' || typeof onMessage !== 'function') {
    return () => {};
  }

  const handle = (data) => {
    if (isPdwBridgeMessage(data)) onMessage(data);
  };

  const onBc = (e) => handle(e?.data);
  const onWin = (e) => handle(e?.data);
  const onCustom = (e) => handle(e?.detail);

  let bc = null;
  try {
    bc = getChannel();
    bc?.addEventListener?.('message', onBc);
  } catch {
    bc = null;
  }
  window.addEventListener('message', onWin);
  window.addEventListener(CHANNEL_NAME, onCustom);

  return () => {
    try {
      bc?.removeEventListener?.('message', onBc);
    } catch {
      /* ignore */
    }
    window.removeEventListener('message', onWin);
    window.removeEventListener(CHANNEL_NAME, onCustom);
  };
}
