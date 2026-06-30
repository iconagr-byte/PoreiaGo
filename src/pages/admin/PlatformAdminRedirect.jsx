import { Navigate, useLocation } from 'react-router-dom';

/** Παλιό URL — ανακατεύθυνση στο ενιαίο Back Office (αρχική: Dashboard). */
export default function PlatformAdminRedirect() {
  const location = useLocation();
  const settingsSubTab = location.state?.platformTab || location.state?.settingsSubTab;

  if (settingsSubTab) {
    return (
      <Navigate
        to="/admin"
        replace
        state={{
          activeTab: 'settings',
          settingsSubTab,
          plan: location.state?.plan,
          interval: location.state?.interval,
        }}
      />
    );
  }

  return <Navigate to="/admin" replace state={{ activeTab: 'dashboard' }} />;
}
