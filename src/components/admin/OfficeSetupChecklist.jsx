import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchTenantBrandingSettings } from '../../services/growthApi.js';
import { fetchPlatformSettings } from '../../services/platformApi.js';
import { fetchAdminPaymentSettings } from '../../services/paymentSettingsApi.js';
import { getPlatformBaseDomain } from '../../lib/platform/domain.js';

const DISMISS_KEY = 'poreiago_setup_checklist_v1';

/**
 * Shopify-style setup guide on the admin dashboard.
 * PoreiaGo subdomain works first; custom domain / email / payments / fleet are optional next steps.
 */
export default function OfficeSetupChecklist({
  rentEnabled = false,
  fleetCount = 0,
  onOpenDomain,
  onOpenPayments,
  onOpenFleet,
  onOpenAppearance,
}) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [state, setState] = useState({
    loading: true,
    subdomainFqdn: '',
    customDomain: '',
    companyName: '',
    hasIban: false,
  });

  const refresh = useCallback(async () => {
    try {
      const [branding, plat, payments] = await Promise.all([
        fetchTenantBrandingSettings().catch(() => null),
        fetchPlatformSettings().catch(() => null),
        fetchAdminPaymentSettings().catch(() => null),
      ]);
      const accounts = Array.isArray(payments?.bank_accounts) ? payments.bank_accounts : [];
      const iban =
        Boolean(String(payments?.iban || '').trim()) ||
        accounts.some((a) => String(a?.iban || '').trim());
      setState({
        loading: false,
        subdomainFqdn:
          branding?.subdomain_fqdn ||
          (branding?.subdomain
            ? `${branding.subdomain}.${branding.platform_domain || getPlatformBaseDomain()}`
            : ''),
        customDomain: String(branding?.custom_domain || '')
          .trim()
          .toLowerCase()
          .replace(/^www\./, ''),
        companyName: String(plat?.company_name || branding?.display_name || '').trim(),
        hasIban: iban,
      });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const steps = useMemo(() => {
    const base = getPlatformBaseDomain();
    const host = state.subdomainFqdn || `γραφείο.${base}`;
    return [
      {
        id: 'poreiago',
        title: 'Λειτουργείτε στο PoreiaGo',
        detail: host ? `Έτοιμο: ${host}` : 'Το subdomain της πλατφόρμας είναι ενεργό',
        done: true,
        required: true,
        actionLabel: null,
        onAction: null,
      },
      {
        id: 'office',
        title: 'Επωνυμία γραφείου',
        detail: state.companyName || 'Συμπληρώστε τα στοιχεία του γραφείου',
        done: Boolean(state.companyName),
        required: true,
        actionLabel: 'Ρυθμίσεις',
        onAction: onOpenAppearance,
      },
      {
        id: 'domain',
        title: 'Δικό σας domain (προαιρετικό)',
        detail: state.customDomain
          ? `www.${state.customDomain}`
          : 'Αργότερα: CNAME www → www.poreiago.com',
        done: Boolean(state.customDomain),
        required: false,
        actionLabel: state.customDomain ? 'Έλεγχος DNS' : 'Οδηγός domain',
        onAction: onOpenDomain,
      },
      {
        id: 'payments',
        title: 'IBAN / πληρωμές',
        detail: state.hasIban ? 'Τραπεζικός λογαριασμός καταχωρημένος' : 'Για προκαταβολές και αποδείξεις',
        done: state.hasIban,
        required: false,
        actionLabel: 'Πληρωμές',
        onAction: onOpenPayments,
      },
      {
        id: 'fleet',
        title: rentEnabled ? 'Πρώτο όχημα ενοικίασης' : 'Πρώτο λεωφορείο / στόλος',
        detail: fleetCount > 0 ? `${fleetCount} στο στόλο` : 'Για να ξεκινήσουν οι κρατήσεις',
        done: fleetCount > 0,
        required: true,
        actionLabel: 'Στόλος',
        onAction: onOpenFleet,
      },
    ];
  }, [
    state,
    fleetCount,
    rentEnabled,
    onOpenAppearance,
    onOpenDomain,
    onOpenPayments,
    onOpenFleet,
  ]);

  const tracked = steps;
  const doneCount = tracked.filter((s) => s.done).length;
  const allCoreDone = tracked.filter((s) => s.required).every((s) => s.done);

  if (hidden || state.loading) return null;
  if (allCoreDone && state.customDomain) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  const pct = Math.round((doneCount / Math.max(tracked.length, 1)) * 100);

  return (
    <section
      className="mb-4 rounded-[22px] border border-sky-200/80 bg-gradient-to-b from-sky-50/90 via-white to-white px-4 py-4 sm:px-5 space-y-3"
      aria-label="Ολοκλήρωση γραφείου"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-sky-800/70">
            Ολοκλήρωση γραφείου
          </p>
          <h3 className="font-bold text-slate-900 text-[15px] sm:text-base mt-0.5">
            Πρώτα PoreiaGo — μετά το δικό σας domain
          </h3>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">
            Το γραφείο δουλεύει αμέσως στο subdomain της πλατφόρμας. Το custom domain το
            συνδέετε όποτε είστε έτοιμοι από τον οδηγό.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          Απόκρυψη
        </button>
      </div>

      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden>
        <div
          className="h-full rounded-full bg-sky-600 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs font-semibold text-slate-500">
        {doneCount} από {tracked.length} βασικά βήματα
      </p>

      <ul className="space-y-2">
        {steps.map((step) => (
          <li
            key={step.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                step.done
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-500'
              }`}
              aria-hidden
            >
              {step.done ? '✓' : '·'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-slate-900">
                {step.title}
                {step.required ? null : (
                  <span className="ml-1.5 text-[11px] font-semibold text-slate-400">προαιρετικό</span>
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 break-all">{step.detail}</p>
            </div>
            {!step.done && step.onAction && step.actionLabel ? (
              <button
                type="button"
                onClick={step.onAction}
                className="rounded-full bg-sky-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-800"
              >
                {step.actionLabel}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
