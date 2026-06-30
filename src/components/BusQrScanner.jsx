import { useState, useCallback } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import toast from 'react-hot-toast';

const scannerStyles = {
  container: {
    width: '100%',
    height: '100%',
    minHeight: '280px',
    position: 'relative',
    background: '#0f172a',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
};

/**
 * Camera QR scanner with desktop-friendly constraints and manual paste fallback.
 */
export default function BusQrScanner({
  onScan,
  paused = false,
  className = '',
  variant = 'dark',
  compact = false,
  quietCamera = false,
}) {
  const [cameraError, setCameraError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const isLight = variant === 'light';
  const viewMinH = compact ? 'min-h-[min(52dvh,360px)]' : 'min-h-[300px]';

  const handleError = useCallback((err) => {
    const msg =
      err?.message ||
      (typeof err === 'string' ? err : 'Δεν ήταν δυνατή η πρόσβαση στην κάμερα');
    setCameraError(msg);
    if (!quietCamera) {
      toast.error(msg, { duration: 6000 });
    }
  }, [quietCamera]);

  const handleDetected = useCallback(
    (codes) => {
      if (!codes?.length || paused) return;
      onScan?.(codes[0].rawValue);
    },
    [onScan, paused],
  );

  const submitManual = () => {
    const v = manualCode.trim();
    if (!v) return;
    onScan?.(v);
  };

  const scannerBg = isLight ? '#e8eaf6' : '#0f172a';
  const dynamicStyles = {
    ...scannerStyles,
    container: { ...scannerStyles.container, background: scannerBg, minHeight: compact ? '200px' : '280px' },
  };

  return (
    <div className={`flex flex-col gap-3 w-full ${className}`}>
      <div
        className={`relative w-full ${viewMinH} rounded-2xl overflow-hidden border ${
          isLight ? 'border-black/[0.06] bg-surface-container-low' : 'bg-slate-900 border-transparent'
        }`}
      >
        {!cameraError ? (
          <>
            <Scanner
              onScan={handleDetected}
              onError={handleError}
              paused={paused}
              allowMultiple={false}
              scanDelay={1500}
              constraints={{
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }}
              styles={dynamicStyles}
            />
            <div className="absolute inset-0 pointer-events-none">
              <div
                className={`absolute inset-0 ${
                  isLight
                    ? 'bg-gradient-to-b from-white/30 via-transparent to-white/50'
                    : 'bg-gradient-to-b from-slate-900/40 via-transparent to-slate-900/60'
                }`}
              />
              <div
                className={`absolute inset-8 border-2 rounded-xl ${
                  isLight ? 'border-primary/75' : 'border-primary/70 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]'
                }`}
              />
              <div className={`absolute left-8 top-8 w-7 h-7 border-l-[3px] border-t-[3px] rounded-tl-lg ${isLight ? 'border-primary' : 'border-white'}`} />
              <div className={`absolute right-8 top-8 w-7 h-7 border-r-[3px] border-t-[3px] rounded-tr-lg ${isLight ? 'border-primary' : 'border-white'}`} />
              <div className={`absolute left-8 bottom-8 w-7 h-7 border-l-[3px] border-b-[3px] rounded-bl-lg ${isLight ? 'border-primary' : 'border-white'}`} />
              <div className={`absolute right-8 bottom-8 w-7 h-7 border-r-[3px] border-b-[3px] rounded-br-lg ${isLight ? 'border-primary' : 'border-white'}`} />
              <div className="absolute left-8 right-8 top-1/2 h-0.5 bg-primary/50 animate-pulse" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-surface-container-low">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-3xl text-amber-600">videocam_off</span>
            </div>
            <p className="text-on-surface font-bold text-sm max-w-[240px]">{cameraError}</p>
            <p className="text-xs mt-2 text-on-surface-variant max-w-[260px] leading-relaxed">
              Επιτρέψτε την κάμερα ή επικολλήστε τον κωδικό παρακάτω.
            </p>
          </div>
        )}
      </div>

      <div
        className={`rounded-2xl p-3.5 ${
          isLight
            ? 'bg-surface-container-low border border-black/[0.05]'
            : 'bg-white/5 border border-white/10'
        }`}
      >
        <label className="text-xs font-bold text-on-surface-variant block mb-1">
          Χωρίς κάμερα
        </label>
        <p className="text-[11px] text-gray-500 mb-2">Επικόλληση Master QR (mq1… ή JWT)</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="mq1… ή JWT"
            disabled={paused}
            className={`flex-1 min-w-0 text-base px-3 py-3 min-h-[3rem] rounded-xl border focus:ring-2 focus:ring-primary focus:outline-none ${
              isLight
                ? 'bg-white border-black/[0.08] text-on-surface'
                : 'bg-white/10 border-white/20 text-white'
            }`}
            onKeyDown={(e) => e.key === 'Enter' && submitManual()}
          />
          <button
            type="button"
            onClick={submitManual}
            disabled={paused || !manualCode.trim()}
            className="driver-touch shrink-0 px-4 py-3 min-h-[3rem] rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            Σύνδεση
          </button>
        </div>
      </div>
    </div>
  );
}
