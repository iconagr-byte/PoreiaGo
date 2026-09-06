/**
 * Drivers hub — accounts for the bus driver app.
 * Master QR / PWA install lives under Λεωφορεία → Master QR & PWA.
 */
import DriversManagementPanel from './DriversManagementPanel.jsx';

export default function DriversHub({ showPageHeader = true }) {
  return (
    <div className="drivers-hub relative space-y-8 pb-10 animate-in fade-in duration-500">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-56 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(24,24,27,0.06),_transparent_65%)]"
      />

      {showPageHeader ? (
        <header className="space-y-1.5 pt-1">
          <h2 className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-zinc-900 leading-none">
            Οδηγοί
          </h2>
          <p className="text-[15px] text-zinc-500 tracking-tight max-w-xl leading-relaxed">
            Λογαριασμοί εφαρμογής λεωφορείου. Για Master QR και εγκατάσταση PWA ανοίξτε{' '}
            <span className="font-semibold text-zinc-700">Master QR &amp; PWA</span> στο μενού
            Λεωφορεία.
          </p>
        </header>
      ) : null}

      <DriversManagementPanel />
    </div>
  );
}
