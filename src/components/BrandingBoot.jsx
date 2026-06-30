import { useEffect } from 'react';
import { fetchBranding } from '../services/growthApi.js';
import { applyBrandingToDocument, cacheBranding, loadCachedBranding } from '../lib/branding/applyBranding.js';

/** Loads tenant branding on app start (white-label). */
export default function BrandingBoot() {
  useEffect(() => {
    const cached = loadCachedBranding();
    if (cached) applyBrandingToDocument(cached);

    fetchBranding(window.location.hostname)
      .then(cacheBranding)
      .catch(() => {});
  }, []);

  return null;
}
