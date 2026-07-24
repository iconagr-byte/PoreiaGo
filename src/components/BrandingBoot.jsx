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
