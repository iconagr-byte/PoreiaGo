import { useMemo, useState } from 'react';
import {
  dismissGuidance,
  getIosGpsEnvironment,
  getVisibleGuidanceSteps,
  isGuidanceDismissed,
} from '../../lib/driver/iosPwaGps.js';

/**
 * Οδηγίες για iPhone/iPad — PWA install, permissions, foreground GPS.
 */
export default function IosPwaGpsGuidance({ compact = false }) {
  const env = useMemo(() => getIosGpsEnvironment(), []);
  const steps = useMemo(() => getVisibleGuidanceSteps(env), [env]);
  const [dismissed, setDismissed] = useState(() => isGuidanceDismissed());
  const [expanded, setExpanded] = useState(() => env.needsInstallGuidance);

  if (!env.isIos || dismissed) return null;

  const critical = env.needsInstallGuidance;

  return (
    <div
      className={`rounded-2xl border text-sm leading-relaxed ${
        critical
          ? 'border-amber-500/50 bg-amber-950/40 text-amber-50'
          : 'border-sky-500/30 bg-sky-950/30 text-sky-50'
      }`}
      role="note"
      aria-label="Οδηγίες GPS για iPhone"
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex gap-3 min-w-0">
          <span className="material-symbols-outlined text-2xl shrink-0 text-[#facc15]" aria-hidden>
            phone_iphone
          </span>
          <div className="min-w-0">
            <p className="font-bold text-base">
              {critical ? 'iPhone: εγκατάσταση PWA απαιτείται' : 'Συμβουλές GPS για iPhone'}
            </p>
            <p className="text-xs mt-1 opacity-90">
              {critical
                ? 'Το Safari σε καρτέλα περιορίζει το GPS. Προσθέστε την εφαρμογή στην Αρχική για σταθερή βάρδια.'
                : 'Το iOS περιορίζει GPS στο background — ακολουθήστε τα παρακάτω.'}
            </p>
            {env.isStandalone ? (
              <p className="text-[11px] mt-2 text-emerald-300 font-semibold">✓ Ανοίχτηκε ως PWA (standalone)</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {!compact ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] px-2 py-1 rounded-lg bg-black/30 font-bold"
            >
              {expanded ? 'Λιγότερα' : 'Λεπτομέρειες'}
            </button>
          ) : null}
          {!critical ? (
            <button
              type="button"
              onClick={() => {
                dismissGuidance();
                setDismissed(true);
              }}
              className="text-[11px] px-2 py-1 rounded-lg bg-black/30"
            >
              Κλείσιμο
            </button>
          ) : null}
        </div>
      </div>

      {(expanded || compact || critical) && (
        <ol className="px-4 pb-4 space-y-3 list-none">
          {steps.map((step, index) => (
            <li key={step.id} className="flex gap-3 rounded-xl bg-black/25 p-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#facc15] text-neutral-900 text-xs font-black">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="font-bold flex items-center gap-1.5 text-sm">
                  <span className="material-symbols-outlined text-base" aria-hidden>
                    {step.icon}
                  </span>
                  {step.title}
                </p>
                <p className="text-xs mt-1 opacity-90">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
