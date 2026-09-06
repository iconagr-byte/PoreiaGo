import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  DEFAULT_OFFICE_MODULES,
  fetchOfficeModules,
  shouldShowRentStorefront,
} from '../../services/officeModulesApi.js';
import { isPlatformMarketingHost, isTenantStorefrontHost } from '../../lib/platform/tenantHost.js';

/**
 * Blocks /rent surfaces on tenant storefronts without an active Rent contract/add-on.
 * PoreiaGo marketing host keeps Rent as product demo.
 */
export default function RentStorefrontGate({ children }) {
  const [state, setState] = useState(() => ({
    loading: isTenantStorefrontHost() && !isPlatformMarketingHost(),
    allowed: isPlatformMarketingHost() || !isTenantStorefrontHost(),
    modules: DEFAULT_OFFICE_MODULES,
  }));

  useEffect(() => {
    if (isPlatformMarketingHost()) {
      setState({ loading: false, allowed: true, modules: DEFAULT_OFFICE_MODULES });
      return undefined;
    }
    if (!isTenantStorefrontHost()) {
      setState({ loading: false, allowed: true, modules: DEFAULT_OFFICE_MODULES });
      return undefined;
    }

    let cancelled = false;
    fetchOfficeModules()
      .then((modules) => {
        if (cancelled) return;
        setState({
          loading: false,
          allowed: shouldShowRentStorefront(modules),
          modules,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ loading: false, allowed: false, modules: DEFAULT_OFFICE_MODULES });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="rent-gate-shell">
        <p className="rent-gate-copy">Φόρτωση…</p>
      </div>
    );
  }

  if (!state.allowed) {
    return <Navigate to="/" replace />;
  }

  return children;
}

/** Optional inline message when Rent is disabled (admin previews). */
export function RentUnavailableNotice() {
  return (
    <div className="rent-gate-shell">
      <div className="rent-gate-card">
        <span className="material-symbols-outlined rent-gate-icon" aria-hidden>
          directions_car
        </span>
        <h1>Ενοικιάσεις μη διαθέσιμες</h1>
        <p>
          Το γραφείο δεν έχει ενεργό συμβόλαιο Rent. Για εκδρομές λεωφορείου, δείτε την αρχική
          σελίδα.
        </p>
        <Link to="/" className="rent-gate-cta">
          Πίσω στην αρχική
        </Link>
      </div>
    </div>
  );
}
