import { useEffect } from 'react';
import { isNativeApp } from '../lib/capacitor/isNativeApp.js';

/**
 * Android WebView + adjustResize: focusing/typing in mid-page inputs can
 * yank window.scrollY to 0. Keep scroll anchored while an input is focused.
 */
export function useNativeInputScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !isNativeApp()) return undefined;

    let anchorY = null;
    let inputFocused = false;

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

    const restore = () => {
      if (!inputFocused || anchorY == null) return;
      const y = anchorY;
      // Double rAF: after WebView applies soft-input resize/layout.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!inputFocused) return;
          if (Math.abs(readY() - y) > 2) writeY(y);
        });
      });
    };

    const onFocusIn = (e) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      if (!el.matches('input, textarea, select')) return;
      inputFocused = true;
      anchorY = readY();
      // After focus scroll-into-view, re-read so we keep the post-focus position
      // (field visible) rather than freezing a pre-focus offset under the keyboard.
      requestAnimationFrame(() => {
        if (inputFocused) anchorY = readY();
      });
    };

    const onFocusOut = () => {
      inputFocused = false;
      anchorY = null;
    };

    const onScroll = () => {
      // If WebView snaps to top while typing, bounce back to the anchored field.
      if (!inputFocused || anchorY == null) return;
      if (readY() < 8 && anchorY > 40) {
        writeY(anchorY);
      }
    };

    window.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('focusout', onFocusOut, true);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.visualViewport?.addEventListener('resize', restore);
    window.visualViewport?.addEventListener('scroll', restore);

    return () => {
      window.removeEventListener('focusin', onFocusIn, true);
      window.removeEventListener('focusout', onFocusOut, true);
      window.removeEventListener('scroll', onScroll);
      window.visualViewport?.removeEventListener('resize', restore);
      window.visualViewport?.removeEventListener('scroll', restore);
    };
  }, [enabled]);
}
