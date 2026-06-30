import toast from 'react-hot-toast';
import { getImpersonationTarget, isImpersonating } from '../../lib/saasJwt.js';
import { exitImpersonationSession, hasImpersonationBackup } from '../../services/saasApi.js';

export default function ImpersonationBanner() {
  if (!isImpersonating() || !hasImpersonationBackup()) {
    return null;
  }

  const target = getImpersonationTarget();

  const handleExit = () => {
    if (exitImpersonationSession()) {
      toast.success('Επιστροφή σε Super Admin');
      window.location.assign('/admin?tab=settings&sub=tenants');
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-amber-950">
        <span className="material-symbols-outlined align-middle mr-1 text-base">visibility</span>
        <strong>Impersonation ενεργή</strong>
        {target ? (
          <span className="ml-2 font-mono text-xs text-amber-800">tenant {target}</span>
        ) : null}
        <span className="block text-xs text-amber-800 mt-0.5">
          Βλέπετε το Control Panel ως tenant admin — οι ενέργειες καταγράφονται στο audit log.
        </span>
      </div>
      <button
        type="button"
        onClick={handleExit}
        className="px-4 py-2 rounded-full bg-amber-600 text-white text-sm font-bold hover:bg-amber-700"
      >
        Έξοδος impersonation
      </button>
    </div>
  );
}
