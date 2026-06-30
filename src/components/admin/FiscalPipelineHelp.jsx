import { useState } from 'react';

const CHECKLIST = [
  'Redis + Celery worker + Celery beat τρέχουν',
  'Provider ρυθμισμένος (Φορολογία) — Native AADE / Prosvasis / Epsilon',
  'STRIPE_CHECKOUT_WEBHOOK_SECRET για κάρτα',
  'SMTP για email με MARK',
];

const RECON_ROWS = [
  { status: 'Λείπει fiscal', action: 'Έκδοση — νέα απόδειξη για το κενό' },
  { status: 'Αποτυχία', action: 'Επανάληψη — υπάρχει FAILED invoice' },
  { status: 'Σε εξέλιξη', action: 'Αναμονή ή stuck recovery (45 λεπτά)' },
];

export default function FiscalPipelineHelp({ className = '' }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          'inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-violet-200 text-violet-800 text-xs font-bold hover:bg-violet-50'
        }
        title="Οδηγός fiscal pipeline"
      >
        <span className="material-symbols-outlined text-[16px]">menu_book</span>
        Οδηγός
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fiscal-help-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-[24px] bg-white shadow-xl border border-violet-100 p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="fiscal-help-title" className="text-lg font-bold text-gray-900">
                  Fiscal pipeline — γρήγορος οδηγός
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Πληρωμή → Celery → myDATA MARK → email / SMS / ERP webhook
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
                aria-label="Κλείσιμο"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <section>
              <h4 className="text-xs font-bold uppercase tracking-wide text-violet-800 mb-2">
                Dev — γρήγορο start
              </h4>
              <pre className="text-[11px] bg-slate-900 text-slate-100 rounded-xl p-3 overflow-x-auto leading-relaxed">
{`make dev              # Postgres + Redis + migrate
make dev-api          # Terminal 1
make celery-worker    # Terminal 2
make celery-beat      # Terminal 3`}
              </pre>
              <p className="text-[11px] text-gray-500 mt-1">
                Πλήρες Docker: <code>make stack-full</code> · Οδηγός: <code>docs/LOCAL-DEV.md</code>
              </p>
            </section>

            <section>
              <h4 className="text-xs font-bold uppercase tracking-wide text-violet-800 mb-2">
                Observability
              </h4>
              <p className="text-sm text-gray-700">
                Prometheus: <code>GET /metrics</code> — gauges (queue, stuck), counters (dispatch, outcomes), histogram (provider latency).
                Απενεργοποίηση: <code>METRICS_ENABLED=false</code>
              </p>
            </section>

            <section>
              <h4 className="text-xs font-bold uppercase tracking-wide text-violet-800 mb-2">
                Production checklist
              </h4>
              <ul className="text-sm text-gray-700 space-y-1.5 list-disc pl-5">
                {CHECKLIST.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h4 className="text-xs font-bold uppercase tracking-wide text-violet-800 mb-2">
                Reconciliation
              </h4>
              <div className="text-sm space-y-2">
                {RECON_ROWS.map((row) => (
                  <div key={row.status} className="rounded-xl border border-gray-100 px-3 py-2">
                    <span className="font-bold text-gray-900">{row.status}</span>
                    <span className="text-gray-600"> — {row.action}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Αν υπάρχει FAILED invoice, η χειροκίνητη «Έκδοση» απορρίπτεται — χρησιμοποιήστε «Επανάληψη».
              </p>
            </section>

            <section>
              <h4 className="text-xs font-bold uppercase tracking-wide text-violet-800 mb-2">
                Beat (αυτόματα)
              </h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>
                  <span className="font-semibold">Auto-retry</span> — κάθε ~15 λεπτά (max 3, cooldown 30 λεπτά)
                </li>
                <li>
                  <span className="font-semibold">Stuck recovery</span> — κάθε 10 λεπτά (PENDING/QUEUED &gt; 45 λεπτά)
                </li>
                <li>
                  <span className="font-semibold">Admin email digest</span> — καθημερινά 08:00 αν υπάρχουν failed/stuck/gaps
                </li>
              </ul>
            </section>

            <section>
              <h4 className="text-xs font-bold uppercase tracking-wide text-violet-800 mb-2">
                Ακύρωση κράτησης
              </h4>
              <p className="text-sm text-gray-700">
                Admin ακύρωση με εκδοθείσες αποδείξεις → αυτόματο <strong>πιστωτικό</strong> (myDATA 11.4/5.2)
                ανά MARK. Εμφανίζεται στη λίστα αποδείξεων ως «Πιστωτικό».
              </p>
            </section>

            <section className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-xs text-slate-700">
                <span className="font-bold">Smoke test (terminal):</span>
                {' '}
                <code className="text-[11px] bg-white px-1.5 py-0.5 rounded border">
                  cd backend && python -m scripts.fiscal_pipeline_smoke
                </code>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Πλήρες runbook: <code>docs/FISCAL-PIPELINE-RUNBOOK.md</code>
                {' · '}
                Monitoring: <code>GET /api/v1/health</code>
              </p>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
