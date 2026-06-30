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
  toast.error(message, { id: 'auth-expired' });
  window.setTimeout(() => {
    window.location.assign('/admin/login');
  }, 400);
}
