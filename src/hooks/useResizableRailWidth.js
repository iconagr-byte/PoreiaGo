import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Persisted left-rail width for admin hubs (Buses / Rent / Settings).
 * Drag the handle left/right to tune the menu vs content split.
 */
export function useResizableRailWidth({
  storageKey,
  defaultWidth = 320,
  minWidth = 220,
  maxWidth = 480,
} = {}) {
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return defaultWidth;
    try {
      const raw = localStorage.getItem(storageKey);
      const n = Number(raw);
      if (Number.isFinite(n) && n >= minWidth && n <= maxWidth) return Math.round(n);
    } catch {
      /* ignore */
    }
    return defaultWidth;
  });

  const dragRef = useRef(null);

  const clamp = useCallback(
    (value) => Math.min(maxWidth, Math.max(minWidth, Math.round(value))),
    [minWidth, maxWidth],
  );

  const persist = useCallback(
    (next) => {
      setWidth(next);
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  const onPointerDown = useCallback(
    (event) => {
      if (event.button != null && event.button !== 0) return;
      event.preventDefault();
      const startX = event.clientX;
      const startW = width;
      dragRef.current = { startX, startW };
      const target = event.currentTarget;
      target.setPointerCapture?.(event.pointerId);

      const onMove = (e) => {
        const state = dragRef.current;
        if (!state) return;
        persist(clamp(state.startW + (e.clientX - state.startX)));
      };
      const onUp = (e) => {
        dragRef.current = null;
        target.releasePointerCapture?.(e.pointerId);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        document.body.style.removeProperty('cursor');
        document.body.style.removeProperty('user-select');
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [width, clamp, persist],
  );

  useEffect(() => {
    return () => {
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };
  }, []);

  return { width, onPointerDown, minWidth, maxWidth };
}
