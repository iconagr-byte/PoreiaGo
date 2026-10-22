/**
 * Bidirectional bridge between Page Design admin (parent) and storefront
 * preview iframe — Divi-like inline Builder without chrome toolbar.
 *
 * Uses BroadcastChannel + window.postMessage (iframe → parent).
 */

const CHANNEL_NAME = 'poreiago-pdw-bridge';
export const PDW_BRIDGE_SOURCE = 'poreiago-pdw';

export const PDW_BRIDGE = {
  /** iframe → parent: select left-nav section */
  SELECT_SECTION: 'select-section',
  /** parent → iframe: highlight focused section */
  SECTION_FOCUS: 'section-focus',
  /** iframe → parent: merge appearance into editor form (Save / dirty) */
  APPEARANCE_SYNC: 'appearance-sync',
  /** iframe → parent: jump to Themes gallery */
  REQUEST_THEMES: 'request-themes',
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
  try {
    window.dispatchEvent(new CustomEvent(CHANNEL_NAME, { detail: payload }));
  } catch {
    /* ignore */
  }
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
