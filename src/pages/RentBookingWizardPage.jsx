import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { resolveOfficeBrand } from '../lib/branding/officeBrand.js';
import { resolveRentAppBranding } from '../lib/rental/rentAppBranding.js';
import { useRentMobile } from '../lib/rental/rentDevice.js';
import { setupRentalPwa } from '../lib/rental/registerRentalPwa.js';
import { fetchSiteAppearance } from '../services/siteAppearanceApi.js';
import RentBookingServicesStep from '../components/rental/RentBookingServicesStep.jsx';
import RentBookingDetailsStep from '../components/rental/RentBookingDetailsStep.jsx';
import '../styles/wallet-pass.css';
import '../styles/rental-pwa.css';

/**
 * Full-bleed booking wizard shell — services + details steps.
 */
export default function RentBookingWizardPage() {
  const isMobile = useRentMobile();
  const location = useLocation();
  const [branding, setBranding] = useState(() => resolveRentAppBranding({}, { guest: true }));
  const isDetails = (location.pathname || '').includes('/rent/book/details');

  useEffect(() => {
    setupRentalPwa();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSiteAppearance()
      .then((data) => {
        if (cancelled) return;
        const brand = resolveOfficeBrand(data || {});
        setBranding(
          resolveRentAppBranding(
            {
              ...(data || {}),
              footer_brand_name: data?.footer_brand_name || brand.displayName || brand.name,
              display_name: brand.displayName || brand.name,
            },
            { guest: true },
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={`rent-wiz-stage${isMobile ? '' : ' rent-wiz-stage--desktop'}`}>
      <div className="rent-wiz-shell">
        <div className="rent-wiz-topbar">
          <Link to="/rent" className="rent-wiz-brand">
            {branding.brandLabel}
          </Link>
          <Link
            to={isDetails ? '/rent/book/services' : '/rent#rent-guest-fleet'}
            className="rent-wiz-back"
          >
            {isDetails ? '← Υπηρεσίες' : '← Στόλος'}
          </Link>
        </div>
        {isDetails ? (
          <RentBookingDetailsStep brandLabel={branding.brandLabel} />
        ) : (
          <RentBookingServicesStep brandLabel={branding.brandLabel} />
        )}
      </div>
    </div>
  );
}
