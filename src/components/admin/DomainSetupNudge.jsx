import { useEffect, useState } from 'react';
import { fetchTenantBrandingSettings } from '../../services/growthApi.js';

const DISMISS_KEY = 'poreiago_domain_nudge_v1';

/**
 * Soft CTA on the admin home dashboard when the office has no custom domain yet.
 * Complements the first-login OfficeSetupWizard domain step.
 */
export default function DomainSetupNudge({ onOpenDomain }) {
  const [visible, setVisible] = useState(false);
  const [domain, setDomain] = useState('');

  useEffect(() => {
    let cancelled = false;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return undefined;
    } catch {
      /* ignore */
    }
    fetchTenantBrandingSettings()
      .then((data) => {
        if (cancelled) return;
        const custom = String(data?.custom_domain || '')
          .trim()
          .toLowerCase()
          .replace(/^www\./, '');
        setDomain(custom);
        if (!custom) setVisible(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible || domain) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <section
      className="mb-4 rounded-[22px] border border-sky-200/80 bg-gradient-to-r from-sky-50 via-white to-teal-50/60 px-4 py-4 sm:px-5 flex flex-wrap items-center justify-between gap-3"
      role="status"
    >
      <div className="min-w-0 flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
          <span className="material-symbols-outlined text-[22px]">language</span>
        </span>
        <div className="min-w-0">
          <p className="font-bold text-slate-900 text-[15px]">Συνδέστε το δικό σας domain</p>
          <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">
            Οδηγός βήμα-βήμα (όπως Achillio Travel): CNAME στο www → έλεγχος DNS → HTTPS.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          Αργότερα
        </button>
        <button
          type="button"
          onClick={() => {
            dismiss();
            onOpenDomain?.();
          }}
          className="rounded-full bg-sky-700 px-4 py-2 text-xs font-bold text-white hover:bg-sky-800"
        >
          Άνοιγμα οδηγού
        </button>
      </div>
    </section>
  );
}
