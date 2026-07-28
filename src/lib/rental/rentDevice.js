/**
 * Device detection for Rent customer app.
 * Mobile → Wallet-first PWA. Desktop → may browse fleet before login.
 */

const MOBILE_MQ = '(max-width: 900px)';
const TOUCH_HANDHELD_MQ = '(hover: none) and (pointer: coarse) and (max-width: 1200px)';

export function isRentMobileViewport() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia(MOBILE_MQ).matches) return true;
    if (window.matchMedia(TOUCH_HANDHELD_MQ).matches) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Subscribe to viewport changes (resize / rotate). Returns unsubscribe. */
export function subscribeRentMobileViewport(onChange) {
  if (typeof window === 'undefined') return () => {};
  const notify = () => {
    try {
      onChange(isRentMobileViewport());
    } catch {
      /* ignore */
    }
  };
  const mqs = [MOBILE_MQ, TOUCH_HANDHELD_MQ]
    .map((q) => {
      try {
        return window.matchMedia(q);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  mqs.forEach((mq) => {
    if (mq.addEventListener) mq.addEventListener('change', notify);
    else if (mq.addListener) mq.addListener(notify);
  });
  return () => {
    mqs.forEach((mq) => {
      if (mq.removeEventListener) mq.removeEventListener('change', notify);
      else if (mq.removeListener) mq.removeListener(notify);
    });
  };
}
