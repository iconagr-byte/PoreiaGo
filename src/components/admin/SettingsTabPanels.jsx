import PlatformSettingsPanel from './PlatformSettingsPanel.jsx';
import PaymentManagementPanel from './PaymentManagementPanel.jsx';
import FiscalSettingsPanel from './FiscalSettingsPanel.jsx';
import SeatPricingPanel from './SeatPricingPanel.jsx';
import TelemetrySettingsPanel from './TelemetrySettingsPanel.jsx';
import UsersManagementPanel from './UsersManagementPanel.jsx';
import BrandingPanel from './BrandingPanel.jsx';
import HomepageSettingsPanel from './HomepageSettingsPanel.jsx';
import PartnerWebhooksPanel from './PartnerWebhooksPanel.jsx';
import DriversHub from './DriversHub.jsx';
import GdprCompliancePanel from './GdprCompliancePanel.jsx';
import LoginAuditPanel from './LoginAuditPanel.jsx';
import ContractsPanel from './ContractsPanel.jsx';
import SuperAdminPanel from './SuperAdminPanel.jsx';
import SaasConnectionPanel from './SaasConnectionPanel.jsx';
import BackupPanel from './BackupPanel.jsx';
import { isSaasSuperAdmin } from '../../lib/saasJwt.js';
import { PLATFORM_ONLY_TAB_IDS } from '../../lib/admin/settingsTabs.js';

/** Κοινό περιεχόμενο καρτελών ρυθμίσεων — tenant + super admin. */
export default function SettingsTabPanels({
  tab,
  onOpenPayments,
  contractPrefs,
}) {
  const superAdmin = isSaasSuperAdmin();
  if (PLATFORM_ONLY_TAB_IDS.has(tab) && !superAdmin) {
    return (
      <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Η ενότητα «{tab}» είναι μόνο για διαχειριστή πλατφόρμας (super admin).
      </div>
    );
  }

  if (tab === 'tenants') return <SuperAdminPanel />;
  if (tab === 'saas_infra') return <SaasConnectionPanel />;
  if (tab === 'backup') return <BackupPanel />;

  if (tab === 'platform') {
    return (
      <>
        <PlatformSettingsPanel onOpenPayments={onOpenPayments} />
        <SeatPricingPanel />
      </>
    );
  }
  if (tab === 'payments') return <PaymentManagementPanel />;
  if (tab === 'fiscal') return <FiscalSettingsPanel />;
  if (tab === 'contracts') {
    return (
      <ContractsPanel
        initialPlan={contractPrefs?.plan}
        initialInterval={contractPrefs?.interval}
      />
    );
  }
  if (tab === 'compliance') return <GdprCompliancePanel />;
  if (tab === 'logins') return <LoginAuditPanel />;
  if (tab === 'homepage') return <HomepageSettingsPanel />;
  // Domain της προσωπικής σελίδας γραφείου — όχι κάτω από platform Growth.
  if (tab === 'domain') return <BrandingPanel />;
  if (tab === 'growth') {
    return (
      <div className="space-y-6">
        <PartnerWebhooksPanel />
      </div>
    );
  }
  if (tab === 'drivers') {
    return <DriversHub showPageHeader={false} />;
  }
  if (tab === 'users') return <UsersManagementPanel />;
  if (tab === 'telematics') return <TelemetrySettingsPanel />;

  return null;
}
