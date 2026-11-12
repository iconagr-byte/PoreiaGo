/**
 * Embed desktop rent booking wizard inside My Wallet without leaving the shell.
 */

export function parseWizardNavTarget(to) {
  const s = String(to || '');
  if (s.includes('/rent/book/payment')) return 'payment';
  if (s.includes('/rent/book/details')) return 'details';
  if (s.includes('/rent/book/services')) return 'services';
  if (s.includes('/wallet')) return 'done';
  if (
    s.includes('need_dates') ||
    s.includes('#rent-pickup') ||
    s.includes('#rent-guest') ||
    s === '/rent' ||
    s.startsWith('/rent?') ||
    s.startsWith('/rent#')
  ) {
    return 'fleet';
  }
  if (s.includes('/rent/login') || s.includes('/login')) return 'login';
  return null;
}

/**
 * @param {(to: string, opts?: object) => void} routerNavigate
 * @param {(to: string, opts?: object) => boolean|void} [onWizardNav]
 */
export function createEmbeddedWizardNavigate(routerNavigate, onWizardNav) {
  return (to, opts) => {
    const path =
      typeof to === 'string'
        ? to
        : to && typeof to === 'object'
          ? String(to.pathname || '') + String(to.search || '') + String(to.hash || '')
          : String(to || '');
    if (typeof onWizardNav === 'function') {
      const handled = onWizardNav(path, opts);
      if (handled === true) return;
    }
    if (typeof routerNavigate === 'function') {
      routerNavigate(to, opts);
    }
  };
}
