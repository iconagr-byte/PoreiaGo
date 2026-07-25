import { useEffect } from 'react';
import { fetchBranding } from '../services/growthApi.js';
import { fetchSiteAppearance } from '../services/siteAppearanceApi.js';
import {
  applyBrandingToDocument,
  cacheBranding,
  loadCachedBranding,
  platformDocumentTitle,
  purgeLegacyBrandingCache,
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
      document.title = tenantDocumentTitle(cached?.display_name, host);
      if (cached) applyBrandingToDocument(cached);
    } else {
      document.title = platformDocumentTitle();
      if (cached && !isPlatformMarketingHost(host)) applyBrandingToDocument(cached);
    }

    fetchBranding(host)
      .then((branding) => {
        cacheBranding(branding);
        // Guest booking lookup / wallet need tenant_id on custom domains (no SaaS login).
        if (branding?.tenant_id && typeof localStorage !== 'undefined') {
          try {
            const prev = localStorage.getItem('saas_tenant_id') || '';
            if (!prev || onTenant) {
              localStorage.setItem('saas_tenant_id', branding.tenant_id);
              window.dispatchEvent(new Event('saas-session-changed'));
            }
          } catch {
            /* ignore */
          }
        }
      })
      .catch(async () => {
        if (!onTenant) {
          document.title = platformDocumentTitle();
          return;
        }
        try {
          const appearance = await fetchSiteAppearance(host);
          const name = appearance?.footer_brand_name || appearance?.display_name || '';
          document.title = tenantDocumentTitle(name, host);
        } catch {
          document.title = tenantDocumentTitle(cached?.display_name, host);
        }
      });
  }, []);

  return null;
}
