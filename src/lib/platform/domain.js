/** PoreiaGo platform hostname — tenant subdomains use *.poreiago.com */
export const DEFAULT_PLATFORM_DOMAIN = 'poreiago.com';
export const DEFAULT_INGRESS_CNAME = 'www.poreiago.com';

export function getPlatformBaseDomain() {
  try {
    const fromEnv = import.meta.env?.VITE_OLYMPUS_BASE_DOMAIN;
    if (fromEnv && String(fromEnv).trim()) {
      return String(fromEnv).trim().toLowerCase().replace(/^www\./, '');
    }
  } catch {
    /* non-Vite runtime (node tests) */
  }
  return DEFAULT_PLATFORM_DOMAIN;
}

export function getDefaultIngressCname() {
  try {
    const fromEnv = import.meta.env?.VITE_OLYMPUS_INGRESS_CNAME;
    if (fromEnv && String(fromEnv).trim()) {
      return String(fromEnv).trim().toLowerCase();
    }
  } catch {
    /* non-Vite runtime */
  }
  return DEFAULT_INGRESS_CNAME;
}

export function tenantSubdomainFqdn(subdomain, baseDomain = getPlatformBaseDomain()) {
  const sub = String(subdomain || 'agency').trim().toLowerCase();
  return `${sub}.${baseDomain}`;
}
