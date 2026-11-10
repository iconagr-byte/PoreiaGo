/**
 * Single «Εύρεση κράτησης» link — destination from office modules (bus vs rent).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchOfficeModules } from '../services/officeModulesApi.js';
import {
  BOOKING_LOOKUP_LABEL,
  resolveBookingLookupHref,
} from '../lib/booking/resolveBookingLookupHref.js';

export default function BookingLookupEntryLink({
  preferRent = false,
  className = '',
  label = BOOKING_LOOKUP_LABEL,
} = {}) {
  const [href, setHref] = useState(() =>
    preferRent ? '/rent/my-booking' : '/my-booking',
  );

  useEffect(() => {
    let cancelled = false;
    fetchOfficeModules()
      .then((modules) => {
        if (cancelled) return;
        setHref(resolveBookingLookupHref(modules, { preferRent }));
      })
      .catch(() => {
        if (!cancelled) setHref(preferRent ? '/rent/my-booking' : '/my-booking');
      });
    return () => {
      cancelled = true;
    };
  }, [preferRent]);

  return (
    <Link to={href} className={className}>
      {label}
    </Link>
  );
}
