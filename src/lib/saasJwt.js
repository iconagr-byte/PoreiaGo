/**
 * Client-side JWT payload helpers (UI gating only — server enforces RBAC).
 */
import { getSaasToken } from '../services/saasApi.js';

const ROLES_KEY = 'saas_roles';

export function decodeJwtPayload(token) {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function storeSaasRolesFromToken(token) {
  const payload = decodeJwtPayload(token);
  const roles = Array.isArray(payload?.roles) ? payload.roles : [];
  localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
  return roles;
}

export function storeSaasRoles(roles) {
  const list = Array.isArray(roles) ? roles : [];
  localStorage.setItem(ROLES_KEY, JSON.stringify(list));
  return list;
}

export function getSaasRoles() {
  const token = getSaasToken();
  if (!token) {
    clearSaasRoles();
    return [];
  }
  try {
    const cached = localStorage.getItem(ROLES_KEY);
    if (cached) return JSON.parse(cached);
  } catch {
    /* fall through */
  }
  return storeSaasRolesFromToken(token);
}

export function clearSaasRoles() {
  localStorage.removeItem(ROLES_KEY);
}

export function isSaasTokenExpired(token = getSaasToken()) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now() + 30_000;
}

export function hasSaasRole(role) {
  return getSaasRoles().includes(role);
}

export function isSaasSuperAdmin() {
  return hasSaasRole('superadmin');
}

export function isSaasTenantAdmin() {
  return hasSaasRole('tenant_admin') || isSaasSuperAdmin();
}

export function isImpersonating(token = getSaasToken()) {
  const payload = decodeJwtPayload(token);
  return Boolean(payload?.impersonating);
}

export function getImpersonationTarget(token = getSaasToken()) {
  const payload = decodeJwtPayload(token);
  return payload?.impersonation_target || payload?.tenant_id || null;
}

export function getOriginalSub(token = getSaasToken()) {
  const payload = decodeJwtPayload(token);
  return payload?.original_sub || null;
}
