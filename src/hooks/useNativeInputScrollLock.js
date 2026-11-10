import { useEffect } from 'react';
import { isNativeApp } from '../lib/capacitor/isNativeApp.js';

/**
 * Pin window.scrollY while a form field is focused.
 * Do NOT use position:fixed / touch-action:none — those block Android
 * numeric IME (card number fields become untouchable / untypable).
 */
export function useNativeInputScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !isNativeApp()) return undefined;

    let anchorY = null;
    let focused = false;
    let unlockTimer = null;

    const readY = () =>
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    const writeY = (y) => {
      window.scrollTo(0, y);
      document.documentElement.scrollTop = y;
      document.body.scrollTop = y;
    };

    const isField = (el) =>
      el instanceof HTMLElement && el.matches('input, textarea, select');

    const pin = () => {
      if (!focused || anchorY == null) return;
      if (Math.abs(readY() - anchorY) > 1) writeY(anchorY);
    };

    const onFocusIn = (e) => {
      if (!isField(e.target)) return;
      if (unlockTimer) {
        clearTimeout(unlockTimer);
        unlockTimer = null;
      }
      focused = true;
      // Capture after the browser’s own scroll-into-view for the field.
      requestAnimationFrame(() => {
        if (focused) anchorY = readY();
      });
    };

    const onFocusOut = () => {
      if (unlockTimer) clearTimeout(unlockTimer);
      unlockTimer = setTimeout(() => {
        unlockTimer = null;
        if (isField(document.activeElement)) return;
        focused = false;
        anchorY = null;
      }, 80);
    };

    const onScroll = () => {
      if (!focused || anchorY == null) return;
      // WebView sometimes snaps to 0 on keypress — bounce back.
      if (readY() < 12 && anchorY > 24) writeY(anchorY);
    };

    const onViewport = () => {
      requestAnimationFrame(pin);
    };

    window.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('focusout', onFocusOut, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.visualViewport?.addEventListener('resize', onViewport);
    window.visualViewport?.addEventListener('scroll', onViewport);

    return () => {
      if (unlockTimer) clearTimeout(unlockTimer);
      window.removeEventListener('focusin', onFocusIn, true);
      window.removeEventListener('focusout', onFocusOut, true);
      window.removeEventListener('scroll', onScroll);
      window.visualViewport?.removeEventListener('resize', onViewport);
      window.visualViewport?.removeEventListener('scroll', onViewport);
    };
  }, [enabled]);
}
