/**
 * Detect phone vs tablet for the driver PWA layout.
 * Tablet: shortest side ≥ 600px (iPad mini+) or width ≥ 768px.
 */

export function getDriverDeviceForm(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return 'phone';
  const w = Number(win.innerWidth) || 0;
  const h = Number(win.innerHeight) || 0;
  const shortSide = Math.min(w, h);
  if (shortSide >= 600 || w >= 768) return 'tablet';
  return 'phone';
}

export function isDriverTablet(win) {
  return getDriverDeviceForm(win) === 'tablet';
}

export function getDriverOrientation(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return 'portrait';
  return win.innerWidth >= win.innerHeight ? 'landscape' : 'portrait';
}

/**
 * Subscribe to viewport changes; returns cleanup.
 * @param {(info: { form: 'phone'|'tablet', orientation: 'portrait'|'landscape' }) => void} onChange
 */
export function watchDriverDeviceForm(onChange, win = typeof window !== 'undefined' ? window : null) {
  if (!win || typeof onChange !== 'function') return () => {};

  const emit = () => {
    onChange({
      form: getDriverDeviceForm(win),
      orientation: getDriverOrientation(win),
    });
  };

  emit();
  win.addEventListener('resize', emit);
  win.addEventListener('orientationchange', emit);
  return () => {
    win.removeEventListener('resize', emit);
    win.removeEventListener('orientationchange', emit);
  };
}
