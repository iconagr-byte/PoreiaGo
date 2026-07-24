import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { loadTrips } from '../../lib/trips/tripStore.js';
import { computeHybridSla } from '../../lib/hybrid/slaRebook.js';
import { runHybridGdprPurge } from '../../lib/hybrid/gdprPurge.js';
import {
  deletePartnerAccount,
  listPartnerAccounts,
  upsertPartnerAccount,
} from '../../lib/hybrid/partnerPortal.js';
import { fetchHybridProvidersStatus } from '../../services/hybridTripApi.js';

export default function HybridSlaDashboard() {
  const trips = useMemo(() => loadTrips(), []);
  const sla = useMemo(() => computeHybridSla({ trips }), [trips]);
  const [partners, setPartners] = useState(() => listPartnerAccounts());
  const [form, setForm] = useState({ name: '', email: '', password: 'partner', tripIds: '' });
  const [providers, setProviders] = useState(null);

  const refreshPartners = () => setPartners(listPartnerAccounts());

  useEffect(() => {
    let cancelled = false;
    fetchHybridProvidersStatus()
      .then((data) => {
        if (!cancelled) setProviders(data);
      })
      .catch(() => {
        if (!cancelled) setProviders(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addPartner = async () => {
    if (!form.email.trim()) {
      toast.error('Email συνεργάτη');
      return;
    }
    await upsertPartnerAccount({
      name: form.name,
      email: form.email,
      password: form.password || 'partner',
      tripIds: String(form.tripIds || '')
        .split(/[,\s]+/)
        .filter(Boolean)
        .map(Number),
    });
    setForm({ name: '', email: '', password: 'partner', tripIds: '' });
    refreshPartners();
    toast.success('Partner account αποθηκεύτηκε');
  };

  const purgeEnded = () => {
    const n = runHybridGdprPurge({ onlyEnded: true, actor: 'office' });
    toast.success(n ? `Διαγράφηκαν PII από ${n} εκδρομές` : 'Καμία ολοκληρωμένη εκδρομή για purge');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Hybrid SLA & partners</h2>
        <p className="text-sm text-slate-500 mt-1">
          Καθυστερήσεις, στενές συνδέσεις, late pickups και partner portal accounts.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="font-bold">Live providers (env)</h3>
        <p className="text-sm text-slate-500">
          Keys στο <code className="text-xs bg-slate-100 px-1 rounded">deploy/.env.prod</code> — βλ.{' '}
          <code className="text-xs bg-slate-100 px-1 rounded">deploy/HYBRID-PROVIDERS.md</code>.
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          <ProviderPill label="Aviationstack" status={providers?.aviationstack} />
          <ProviderPill label="Twilio SMS" status={providers?.twilio_sms} />
          <ProviderPill label="Twilio WhatsApp" status={providers?.twilio_whatsapp} />
        </div>
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Delayed flights" value={sla.delayedFlights} />
        <Kpi label="Tight connections" value={sla.tightConnections} />
        <Kpi label="Critical links" value={sla.criticalConnections} tone="rose" />
        <Kpi label="Late pickups" value={sla.latePickups} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="font-bold mb-3">Incidents</h3>
        {sla.incidents.length === 0 ? (
          <p className="text-sm text-slate-500 italic">Καμία ειδοποίηση αυτή τη στιγμή.</p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {sla.incidents.map((inc, i) => (
              <li
                key={`${inc.tripId}-${i}`}
                className={`rounded-lg px-3 py-2 text-sm border ${
                  inc.severity === 'critical'
                    ? 'border-rose-200 bg-rose-50 text-rose-800'
                    : inc.severity === 'warn'
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : 'border-slate-200 bg-slate-50'
                }`}
              >
                <span className="font-semibold">{inc.tripTitle || `#${inc.tripId}`}</span>
                <span className="text-xs opacity-70"> · {inc.type}</span>
                <p className="mt-0.5">{inc.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">GDPR hybrid purge</h3>
          <button type="button" onClick={purgeEnded} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">
            Purge ολοκληρωμένων εκδρομών
          </button>
        </div>
        <p className="text-sm text-slate-500">
          Ανωνυμοποιεί ονόματα / PNR / notes σε local hybrid manifest, rooming και luggage μετά το τέλος της εκδρομής.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="font-bold">Partner portal accounts</h3>
        <p className="text-sm text-slate-500">
          Login στο <code className="text-xs bg-slate-100 px-1 rounded">/partner/login</code> — όχι μόνο share link.
        </p>
        <div className="grid sm:grid-cols-4 gap-2">
          <input className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" placeholder="Όνομα" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" placeholder="Password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" placeholder="Trip IDs (1,2)" value={form.tripIds} onChange={(e) => setForm((f) => ({ ...f, tripIds: e.target.value }))} />
        </div>
        <button type="button" onClick={addPartner} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">
          Αποθήκευση partner
        </button>
        <ul className="divide-y divide-slate-100">
          {partners.map((p) => (
            <li key={p.id} className="py-2 flex items-center justify-between gap-2 text-sm">
              <span>
                <strong>{p.name}</strong> · {p.email}
                {p.tripIds?.length ? ` · trips ${p.tripIds.join(',')}` : ''}
              </span>
              <button
                type="button"
                className="text-rose-600 text-xs font-bold"
                onClick={() => {
                  deletePartnerAccount(p.id);
                  refreshPartners();
                }}
              >
                Διαγραφή
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div className={`rounded-xl border px-3 py-3 ${tone === 'rose' ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function ProviderPill({ label, status }) {
  const mode = status?.mode || 'unknown';
  const live = mode === 'live';
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        live ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${live ? 'text-emerald-800' : 'text-slate-600'}`}>
        {live ? 'Live' : mode === 'stub' ? 'Stub (λείπουν keys)' : '—'}
      </p>
    </div>
  );
}
