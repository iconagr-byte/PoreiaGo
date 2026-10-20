import { upsertCustomer } from './customers/customerStore.js';
import { clearWalletTenantId, setWalletTenantId } from './wallet/walletTenantSeal.js';

export const ROLES = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  DRIVER: 'driver',
};

const CUSTOMER_TOKEN_KEY = 'customer_access_token';
const CUSTOMER_PHONE_KEY = 'userPhone';
const CUSTOMER_ID_KEY = 'customerCustomerId';

export function getUserRole() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('userRole');
}

export function isCustomer() {
  return getUserRole() === ROLES.CUSTOMER;
}

export function isAdmin() {
  return getUserRole() === ROLES.ADMIN;
}

export function isDriver() {
  return getUserRole() === ROLES.DRIVER;
}

export function getCustomerEmail() {
  return localStorage.getItem('userEmail');
}

export function getCustomerToken() {
  return localStorage.getItem(CUSTOMER_TOKEN_KEY);
}

export function setCustomerToken(token) {
  if (token) localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  else localStorage.removeItem(CUSTOMER_TOKEN_KEY);
}

/** Μόνο πελάτες — My Wallet / κρατήσεις / λογαριασμός.
 * Session lives in localStorage until logoutCustomer() (JWT ~7 days).
 */
export function loginAsCustomer(email, profile = {}, accessToken = null) {
  localStorage.removeItem('driverApiKey');
  localStorage.setItem('userRole', ROLES.CUSTOMER);
  localStorage.setItem('userEmail', email.trim().toLowerCase());
  if (profile.name) localStorage.setItem('userName', profile.name);
  else localStorage.removeItem('userName');
  if (profile.picture) localStorage.setItem('userPicture', profile.picture);
  else localStorage.removeItem('userPicture');
  if (profile.provider) localStorage.setItem('authProvider', profile.provider);
  else localStorage.removeItem('authProvider');
  const phone = String(profile.phone || '').trim();
  if (phone) localStorage.setItem(CUSTOMER_PHONE_KEY, phone);
  else localStorage.removeItem(CUSTOMER_PHONE_KEY);
  const cid = profile.customerId || profile.customer_id || null;
  if (cid) localStorage.setItem(CUSTOMER_ID_KEY, String(cid));
  else localStorage.removeItem(CUSTOMER_ID_KEY);
  if (accessToken) setCustomerToken(accessToken);
  else if (profile.access_token) setCustomerToken(profile.access_token);

  // Seal My Wallet to the office stamped at login (never mix offices).
  const tid = profile.tenant_id || profile.tenantId || null;
  if (tid) setWalletTenantId(tid);

  upsertCustomer({
    email,
    name: profile.name,
    picture: profile.picture,
    phone: profile.phone,
    authProvider: profile.provider || 'email',
    id: cid,
  });
}

export function getCustomerName() {
  return localStorage.getItem('userName');
}

export function getCustomerPhone() {
  return localStorage.getItem(CUSTOMER_PHONE_KEY) || '';
}

export function getCustomerId() {
  return localStorage.getItem(CUSTOMER_ID_KEY) || '';
}

export function getCustomerPicture() {
  return localStorage.getItem('userPicture');
}

export function getAuthProvider() {
  return localStorage.getItem('authProvider');
}

export function logoutCustomer() {
  localStorage.removeItem('userRole');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userName');
  localStorage.removeItem('userPicture');
  localStorage.removeItem('authProvider');
  localStorage.removeItem(CUSTOMER_PHONE_KEY);
  localStorage.removeItem(CUSTOMER_ID_KEY);
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  clearWalletTenantId();
}
