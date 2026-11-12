import { Link } from 'react-router-dom';

/**
 * Link that stays inside an embedded wallet wizard when onWizardNav is set.
 */
export default function RentWizardLink({
  to,
  onWizardNav,
  className = '',
  children,
  replace = false,
} = {}) {
  if (typeof onWizardNav === 'function') {
    return (
      <button
        type="button"
        className={className}
        onClick={() => onWizardNav(to, { replace })}
      >
        {children}
      </button>
    );
  }
  return (
    <Link to={to} className={className} replace={replace}>
      {children}
    </Link>
  );
}
