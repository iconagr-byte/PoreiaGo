import QRCode from 'react-qr-code';
import { getMasterQrPngUrl } from '../../services/platformApi.js';

export default function MasterQrIssuedModal({ open, issued, driverId, tripTitle, onClose }) {
  if (!open || !issued) return null;

  const qrValue = issued.auth_url || issued.qr_content;
  const expiresLabel = issued.expires_at
    ? new Date(issued.expires_at * 1000).toLocaleString('el-GR')
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="w-full max-w-lg rounded-[28px] bg-white shadow-2xl border border-black/[0.08] overflow-hidden"
        role="dialog"
        aria-labelledby="master-qr-modal-title"
      >
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-indigo-400" />
        <div className="p-6 sm:p-8 space-y-5">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-3">
              <span className="material-symbols-outlined text-[32px]">qr_code_2</span>
            </div>
            <h2 id="master-qr-modal-title" className="font-bold text-xl text-gray-900 tracking-tight">
              Master QR έτοιμο
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {tripTitle ? (
                <>
                  Εκδρομή <span className="font-bold text-gray-800">#{issued.trip_id}</span> — {tripTitle}
                </>
              ) : (
                <>Εκδρομή #{issued.trip_id}</>
              )}
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-primary/25 shadow-inner">
              <QRCode value={qrValue} size={200} />
            </div>
            <p className="text-xs text-gray-500 text-center max-w-sm leading-relaxed">
              Εκτύπωσε ή στείλε στον οδηγό — σκανάρει στο <strong>/driver</strong> χωρίς login.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            <a
              href={getMasterQrPngUrl(issued.trip_id, {
                driverId: issued.driver_id || driverId || undefined,
              })}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-full bg-primary text-white hover:bg-primary/90"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Λήψη PNG
            </a>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(qrValue)}
              className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200"
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
              Αντιγραφή link
            </button>
          </div>

          {expiresLabel && (
            <p className="text-center text-xs text-gray-400">
              Λήξη: <span className="font-medium text-gray-600">{expiresLabel}</span>
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-full bg-surface-container-low text-on-surface font-bold text-sm hover:bg-surface-container-high transition-colors"
          >
            Συνέχεια στη λίστα εκδρομών
          </button>
        </div>
      </div>
    </div>
  );
}
