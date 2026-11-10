/**
 * Device detection for Rent customer app.
 * Phone → compact PWA chrome. Tablet/desktop → full-bleed layout.
 * `isRentMobileViewport` still groups phone+tablet for wallet-first product behavior.
 */
import { useEffect, useState } from 'react';

const MOBILE_MQ = '(max-width: 900px)';
const TOUCH_HANDHELD_MQ = '(hover: none) and (pointer: coarse) and (max-width: 1200px)';
/** Narrow phones only — tablets must not get the phone bezel chrome. */
const PHONE_MQ = '(max-width: 700px)';

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

/** True only on narrow phone widths (not iPad / tablet). */
export function isRentPhoneViewport() {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia(PHONE_MQ).matches;
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

export function subscribeRentPhoneViewport(onChange) {
  if (typeof window === 'undefined') return () => {};
  const notify = () => {
    try {
      onChange(isRentPhoneViewport());
    } catch {
      /* ignore */
    }
  };
  let mq;
  try {
    mq = window.matchMedia(PHONE_MQ);
  } catch {
    return () => {};
  }
  if (mq.addEventListener) mq.addEventListener('change', notify);
  else if (mq.addListener) mq.addListener(notify);
  return () => {
    if (mq.removeEventListener) mq.removeEventListener('change', notify);
    else if (mq.removeListener) mq.removeListener(notify);
  };
}

/** React hook — true on phone / tablet Rent surface. */
export function useRentMobile() {
  const [mobile, setMobile] = useState(() => isRentMobileViewport());
  useEffect(() => subscribeRentMobileViewport(setMobile), []);
  return mobile;
}

/** React hook — true only on narrow phones (phone chrome / compact auth). */
export function useRentPhone() {
  const [phone, setPhone] = useState(() => isRentPhoneViewport());
  useEffect(() => subscribeRentPhoneViewport(setPhone), []);
  return phone;
}
