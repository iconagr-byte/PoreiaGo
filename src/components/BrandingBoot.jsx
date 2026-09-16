import { useEffect } from 'react';
import { fetchBranding } from '../services/growthApi.js';
import { fetchSiteAppearance } from '../services/siteAppearanceApi.js';
import {
  applyBrandingToDocument,
  cacheBranding,
  loadCachedBranding,
  platformDocumentTitle,
  purgeLegacyBrandingCache,
  syncDocumentMetaTitle,
  tenantDocumentTitle,
} from '../lib/branding/applyBranding.js';
import { isPlatformMarketingHost, isTenantStorefrontHost } from '../lib/platform/tenantHost.js';

/** Loads tenant branding on app start (white-label). */
export default function BrandingBoot() {
  useEffect(() => {
    purgeLegacyBrandingCache();

    const host = window.location.hostname;
    const onTenant = isTenantStorefrontHost(host);
    const cached = loadCachedBranding();

    if (onTenant) {
      // Never leave PoreiaGo in the tab/SERP on Achillio (or any office domain).
      syncDocumentMetaTitle(tenantDocumentTitle(cached?.display_name, host));
      if (cached) applyBrandingToDocument(cached);
    } else {
      syncDocumentMetaTitle(platformDocumentTitle());
      if (cached && !isPlatformMarketingHost(host)) applyBrandingToDocument(cached);
    }

    // Prefer server SEO payload (same source Googlebot sees via seo-shell).
    fetch(`/api/site/seo?host=${encodeURIComponent(host)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((seo) => {
        if (!seo?.title) return;
        syncDocumentMetaTitle(seo.title, seo.description || '');
      })
      .catch(() => {});

    fetchBranding(host)
      .then((branding) => {
        cacheBranding(branding);
        // Guest booking lookup / wallet need tenant_id on custom domains (no SaaS login).
        // Never overwrite saas_tenant_id while an office JWT session is active —
        // that remaps officeStorageKey and can leak trips across offices.
        if (branding?.tenant_id && typeof localStorage !== 'undefined') {
          try {
            const hasOfficeJwt = Boolean(localStorage.getItem('saas_access_token'));
            if (hasOfficeJwt) {
              /* keep JWT tenant */
            } else if (onTenant) {
              // Guest booking lookup / wallet on office domains need tenant_id.
              localStorage.setItem('saas_tenant_id', branding.tenant_id);
              window.dispatchEvent(new Event('saas-session-changed'));
            }
            // Marketing host (www.poreiago.com): never seed saas_tenant_id —
            // that remaps officeStorageKey and can pull visitors into an office.
          } catch {
            /* ignore */
          }
        }
      })
      .catch(async () => {
        if (!onTenant) {
          syncDocumentMetaTitle(platformDocumentTitle());
          return;
        }
        try {
          const appearance = await fetchSiteAppearance(host);
          const name = appearance?.footer_brand_name || appearance?.display_name || '';
          syncDocumentMetaTitle(tenantDocumentTitle(name, host));
        } catch {
          syncDocumentMetaTitle(tenantDocumentTitle(cached?.display_name, host));
        }
      });
  }, []);

  return null;
}
