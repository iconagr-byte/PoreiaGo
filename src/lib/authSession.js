import toast from 'react-hot-toast';

const SAAS_TOKEN_KEY = 'saas_access_token';
const SAAS_TENANT_KEY = 'saas_tenant_id';
const SAAS_EMAIL_KEY = 'saas_user_email';
const SAAS_ROLES_KEY = 'saas_roles';
const IMPERSONATION_ORIGINAL_TOKEN_KEY = 'saas_impersonation_original_token';
const IMPERSONATION_ORIGINAL_TENANT_KEY = 'saas_impersonation_original_tenant_id';
const IMPERSONATION_ORIGINAL_ROLES_KEY = 'saas_impersonation_original_roles';

let authFailureHandled = false;

export function isAuthFailureStatus(status) {
  return status === 401 || status === 403;
}

/** Office / partner surfaces that should bounce to /admin/login on JWT expiry. */
export function isOfficeAuthSurface(pathname = '') {
  const path = String(pathname || '');
  return (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/partner' ||
    path.startsWith('/partner/')
  );
}

function clearLocalAuthSession() {
  localStorage.removeItem(SAAS_TOKEN_KEY);
  localStorage.removeItem(SAAS_TENANT_KEY);
  localStorage.removeItem(SAAS_EMAIL_KEY);
  localStorage.removeItem(SAAS_ROLES_KEY);
  localStorage.removeItem(IMPERSONATION_ORIGINAL_TOKEN_KEY);
  localStorage.removeItem(IMPERSONATION_ORIGINAL_TENANT_KEY);
  localStorage.removeItem(IMPERSONATION_ORIGINAL_ROLES_KEY);
  localStorage.removeItem('userRole');
}

/** Clear session and redirect once — avoids repeated token error toasts. */
export function handleAuthFailure(message = 'Η σύνδεσή σας έληξε — συνδεθείτε ξανά') {
  if (authFailureHandled) return;
  authFailureHandled = true;
  clearLocalAuthSession();

  const path = typeof window !== 'undefined' ? window.location.pathname || '' : '';
  const onDriverApp = path === '/driver' || path.startsWith('/driver/');
  // Driver PWA: silent session clear — connection events are audited server-side.
  // Do not show the office «σύνδεση έληξε» banner on the driver surface.
  if (onDriverApp) {
    window.setTimeout(() => {
      window.location.assign('/driver');
    }, 0);
    return;
  }

  // Marketing / B2C (/, /rent, /trip/…, /login, …): stale office JWT must NOT
  // dump prospective buyers onto Σύνδεση Διαχείρισης (/admin/login).
  if (!isOfficeAuthSurface(path)) {
    return;
  }

  toast.error(message, { id: 'auth-expired' });
  window.setTimeout(() => {
    window.location.assign('/admin/login');
  }, 400);
}

/** Test helper — reset one-shot guard between cases. */
export function resetAuthFailureGuard() {
  authFailureHandled = false;
}
