import PlatformSettingsPanel from './PlatformSettingsPanel.jsx';
import PaymentManagementPanel from './PaymentManagementPanel.jsx';
import FiscalSettingsPanel from './FiscalSettingsPanel.jsx';
import SeatPricingPanel from './SeatPricingPanel.jsx';
import TelemetrySettingsPanel from './TelemetrySettingsPanel.jsx';
import UsersManagementPanel from './UsersManagementPanel.jsx';
import DriversManagementPanel from './DriversManagementPanel.jsx';
import BrandingPanel from './BrandingPanel.jsx';
import HomepageSettingsPanel from './HomepageSettingsPanel.jsx';
import PartnerWebhooksPanel from './PartnerWebhooksPanel.jsx';
import MasterQrPanel from './MasterQrPanel.jsx';
import GdprCompliancePanel from './GdprCompliancePanel.jsx';
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
  if (tab === 'homepage') return <HomepageSettingsPanel />;
  if (tab === 'growth') {
    return (
      <div className="space-y-6">
        <BrandingPanel />
        <PartnerWebhooksPanel />
      </div>
    );
  }
  if (tab === 'drivers') {
    return (
      <div className="space-y-6">
        <div className="rounded-[24px] border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 md:p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-700 mb-1">
                Εφαρμογή λεωφορείου
              </p>
              <h3 className="font-bold text-lg text-gray-900">Λογαριασμοί οδηγών για το /driver</h3>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                Δημιουργήστε λογαριασμούς με email και κωδικό για κάθε οδηγό. Μετά μπαίνουν στην
                εφαρμογή στο λεωφορείο χωρίς Master QR (το QR παραμένει ως εναλλακτική).
              </p>
            </div>
            <a
              href="/driver"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-sky-600 text-white text-sm font-bold px-4 py-2.5 hover:bg-sky-700 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">smartphone</span>
              Άνοιγμα εφαρμογής
            </a>
          </div>
        </div>
        <MasterQrPanel />
        <DriversManagementPanel />
      </div>
    );
  }
  if (tab === 'users') return <UsersManagementPanel />;
  if (tab === 'telematics') return <TelemetrySettingsPanel />;

  return null;
}
