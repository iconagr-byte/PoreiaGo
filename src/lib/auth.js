import { upsertCustomer } from './customers/customerStore.js';

export const ROLES = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  DRIVER: 'driver',
};

const CUSTOMER_TOKEN_KEY = 'customer_access_token';

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

/** Μόνο πελάτες — My Wallet / κρατήσεις / λογαριασμός */
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
  if (accessToken) setCustomerToken(accessToken);
  else if (profile.access_token) setCustomerToken(profile.access_token);

  upsertCustomer({
    email,
    name: profile.name,
    picture: profile.picture,
    phone: profile.phone,
    authProvider: profile.provider || 'email',
    id: profile.customerId || profile.customer_id,
  });
}

export function getCustomerName() {
  return localStorage.getItem('userName');
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
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
}
