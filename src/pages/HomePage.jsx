import FrontPage from '../pages/FrontPage.jsx';
import StorefrontDemoPage from '../pages/StorefrontDemoPage.jsx';
import { isTenantStorefrontHost } from '../lib/platform/tenantHost.js';

/**
 * `/` on www.poreiago.com → platform marketing.
 * `/` on office custom domain / slug.poreiago.com → office storefront.
 */
export default function HomePage() {
  if (isTenantStorefrontHost()) {
    return <StorefrontDemoPage />;
  }
  return <FrontPage />;
}
