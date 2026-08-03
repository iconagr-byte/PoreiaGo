/**
 * Master QR + bus phone PWA install — buses hub menu item (not buried under Οδηγοί).
 */
import MasterQrPanel from './MasterQrPanel.jsx';
import BusPwaInstallGuide from './BusPwaInstallGuide.jsx';

export default function BusSetupTools() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 animate-in fade-in duration-300">
      <MasterQrPanel compact />
      <BusPwaInstallGuide />
    </div>
  );
}
