import { useEffect } from 'react';
import { isNativeApp } from '../lib/capacitor/isNativeApp.js';

/**
 * Hard-lock document scroll while a form control is focused.
 * Android WebView otherwise yanks scrollY→0 on each keypress (card digits).
 * Uses position:fixed body lock (same pattern as iOS soft-keyboard fixes).
 */
export function useNativeInputScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !isNativeApp()) return undefined;

    let lockedY = 0;
    let locked = false;
    let unlockTimer = null;

    const readY = () =>
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    const lock = () => {
      if (unlockTimer) {
        clearTimeout(unlockTimer);
        unlockTimer = null;
      }
      if (locked) return;
      lockedY = readY();
      locked = true;
      const b = document.body;
      const root = document.documentElement;
      b.dataset.pgScrollLock = '1';
      root.style.overflow = 'hidden';
      b.style.position = 'fixed';
      b.style.top = `-${lockedY}px`;
      b.style.left = '0';
      b.style.right = '0';
      b.style.width = '100%';
      b.style.overflow = 'hidden';
    };

    const unlock = () => {
      if (!locked) return;
      locked = false;
      const b = document.body;
      const root = document.documentElement;
      delete b.dataset.pgScrollLock;
      root.style.overflow = '';
      b.style.position = '';
      b.style.top = '';
      b.style.left = '';
      b.style.right = '';
      b.style.width = '';
      b.style.overflow = '';
      window.scrollTo(0, lockedY);
      document.documentElement.scrollTop = lockedY;
      document.body.scrollTop = lockedY;
    };

    const isField = (el) =>
      el instanceof HTMLElement && el.matches('input, textarea, select');

    const onFocusIn = (e) => {
      if (!isField(e.target)) return;
      lock();
    };

    const onFocusOut = () => {
      // Android WebView often has relatedTarget=null; wait a tick for next field.
      if (unlockTimer) clearTimeout(unlockTimer);
      unlockTimer = setTimeout(() => {
        unlockTimer = null;
        if (isField(document.activeElement)) return;
        unlock();
      }, 80);
    };

    // Belt-and-suspenders: if anything still moves scroll while locked, pin it.
    const onScroll = () => {
      if (!locked) return;
      if (readY() !== 0) {
        // With position:fixed, window scroll should stay 0; ignore.
        return;
      }
    };

    window.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('focusout', onFocusOut, true);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (unlockTimer) clearTimeout(unlockTimer);
      unlock();
      window.removeEventListener('focusin', onFocusIn, true);
      window.removeEventListener('focusout', onFocusOut, true);
      window.removeEventListener('scroll', onScroll);
    };
  }, [enabled]);
}
