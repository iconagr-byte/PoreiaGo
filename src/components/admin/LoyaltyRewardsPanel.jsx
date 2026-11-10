import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  LOYALTY_TIER_LABELS,
  LOYALTY_TX_LABELS,
  createLoyaltyAccount,
  deleteLoyaltyAccount,
  fetchLoyaltyAccounts,
  fetchLoyaltyMeta,
  fetchLoyaltyTransactions,
  postLoyaltyTransaction,
  updateLoyaltyAccount,
} from '../../services/loyaltyApi.js';

const EMPTY_ACCOUNT = {
  display_name: '',
  client_email: '',
  client_id: '',
  lifetime_miles: 0,
  redeemable_miles: 0,
  tier: 'STANDARD',
};

const EMPTY_TX = {
  tx_type: 'EARN',
  miles: '',
  multiplier: 1,
  notes: '',
  source_kind: '',
  source_id: '',
  distance_km: '',
};

const TIER_BADGE = {
  STANDARD: 'bg-slate-100 text-slate-700',
  SILVER: 'bg-slate-200 text-slate-800',
  GOLD: 'bg-amber-100 text-amber-800',
  PLATINUM: 'bg-violet-100 text-violet-800',
};

function fmtMiles(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('el-GR', { maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

/**
 * Full Miles+Bonus admin — accounts CRUD + earn/redeem/adjust ledger.
 */
export default function LoyaltyRewardsPanel() {
  const [accounts, setAccounts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_ACCOUNT);
  const [txForm, setTxForm] = useState(EMPTY_TX);

  const selected = useMemo(
    () => accounts.find((a) => a.id === selectedId) || null,
    [accounts, selectedId],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((a) => {
      if (tierFilter && a.tier !== tierFilter) return false;
      if (!q) return true;
      const hay = [a.display_name, a.client_email, a.client_id, a.tier]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [accounts, query, tierFilter]);

  const kpis = useMemo(() => {
    const totalRedeemable = accounts.reduce((s, a) => s + (Number(a.redeemable_miles) || 0), 0);
    const totalLifetime = accounts.reduce((s, a) => s + (Number(a.lifetime_miles) || 0), 0);
    const byTier = accounts.reduce((acc, a) => {
      const t = a.tier || 'STANDARD';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});
    return {
      members: accounts.length,
      totalRedeemable,
      totalLifetime,
      byTier,
    };
  }, [accounts]);

  const load = useCallback(async ({ quiet } = {}) => {
    setLoading(true);
    try {
      const [rows, m] = await Promise.all([
        fetchLoyaltyAccounts(),
        fetchLoyaltyMeta().catch(() => null),
      ]);
      setAccounts(rows);
      if (m) setMeta(m);
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return rows[0]?.id || '';
      });
    } catch (err) {
      setAccounts([]);
      if (!quiet) toast.error(err.message || 'Αποτυχία φόρτωσης επιβραβεύσεων');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTx = useCallback(async (accountId) => {
    if (!accountId) {
      setTransactions([]);
      return;
    }
    setTxLoading(true);
    try {
      const rows = await fetchLoyaltyTransactions(accountId);
      setTransactions(rows);
    } catch (err) {
      setTransactions([]);
      toast.error(err.message || 'Αποτυχία ιστορικού');
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadTx(selectedId);
  }, [selectedId, loadTx]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_ACCOUNT });
    setEditorOpen(true);
  };

  const openEdit = (account) => {
    setEditing(account);
    setForm({
      display_name: account.display_name || '',
      client_email: account.client_email || '',
      client_id: account.client_id || '',
      lifetime_miles: account.lifetime_miles ?? 0,
      redeemable_miles: account.redeemable_miles ?? 0,
      tier: account.tier || 'STANDARD',
    });
    setEditorOpen(true);
    setSelectedId(account.id);
  };

  const saveAccount = async (e) => {
    e?.preventDefault?.();
    const email = String(form.client_email || '').trim();
    const name = String(form.display_name || '').trim();
    if (!email && !name) {
      toast.error('Βάλε όνομα ή email');
      return;
    }
    setSaving(true);
    try {
      const body = {
        display_name: name || null,
        client_email: email || null,
        client_id: String(form.client_id || '').trim() || null,
        lifetime_miles: Number(form.lifetime_miles) || 0,
        redeemable_miles: Number(form.redeemable_miles) || 0,
        tier: form.tier || null,
      };
      const row = editing
        ? await updateLoyaltyAccount(editing.id, body)
        : await createLoyaltyAccount(body);
      toast.success(editing ? 'Ο λογαριασμός ενημερώθηκε' : 'Νέος λογαριασμός Miles+Bonus');
      setEditorOpen(false);
      await load({ quiet: true });
      setSelectedId(row.id);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = async (account) => {
    if (!account?.id) return;
    if (
      !window.confirm(
        `Διαγραφή λογαριασμού «${account.display_name || account.client_email || account.id}»; Θα χαθεί και το ιστορικό miles.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await deleteLoyaltyAccount(account.id);
      toast.success('Ο λογαριασμός διαγράφηκε');
      if (selectedId === account.id) setSelectedId('');
      await load({ quiet: true });
    } catch (err) {
      toast.error(err.message || 'Αποτυχία διαγραφής');
    } finally {
      setSaving(false);
    }
  };

  const submitTx = async (e) => {
    e?.preventDefault?.();
    if (!selectedId) {
      toast.error('Επίλεξε λογαριασμό');
      return;
    }
    const miles = Number(txForm.miles);
    if (!Number.isFinite(miles) || miles === 0) {
      toast.error('Βάλε μη μηδενικά miles');
      return;
    }
    setSaving(true);
    try {
      await postLoyaltyTransaction({
        loyalty_account_id: selectedId,
        tx_type: txForm.tx_type,
        miles,
        multiplier: Number(txForm.multiplier) || 1,
        notes: String(txForm.notes || '').trim() || null,
        source_kind: String(txForm.source_kind || '').trim() || null,
        source_id: String(txForm.source_id || '').trim() || null,
        distance_km:
          txForm.distance_km === '' || txForm.distance_km == null
            ? null
            : Number(txForm.distance_km),
      });
      toast.success('Η συναλλαγή καταχωρήθηκε');
      setTxForm(EMPTY_TX);
      await load({ quiet: true });
      await loadTx(selectedId);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία συναλλαγής');
    } finally {
      setSaving(false);
    }
  };

  const tiers = meta?.tiers || Object.keys(LOYALTY_TIER_LABELS);
  const thresholds = meta?.thresholds || [];

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700/80 mb-1">
            Miles + Bonus
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Επιβραβεύσεις
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Πλήρης διαχείριση λογαριασμών loyalty — προσθήκη μελών, επίπεδα (tier), κέρδος /
            εξαργύρωση / διόρθωση miles και ιστορικό συναλλαγών.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Ανανέωση
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-500 shadow-sm shadow-amber-600/20"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Νέος λογαριασμός
          </button>
        </div>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Μέλη" value={String(kpis.members)} icon="group" />
        <KpiCard label="Διαθέσιμα miles" value={fmtMiles(kpis.totalRedeemable)} icon="toll" />
        <KpiCard label="Lifetime miles" value={fmtMiles(kpis.totalLifetime)} icon="airline_stops" />
        <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tiers</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tiers.map((t) => (
              <span
                key={t}
                className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${TIER_BADGE[t] || TIER_BADGE.STANDARD}`}
              >
                {LOYALTY_TIER_LABELS[t] || t}: {kpis.byTier[t] || 0}
              </span>
            ))}
          </div>
        </div>
      </div>

      {thresholds.length ? (
        <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 to-white px-4 py-3 text-sm text-amber-950/80">
          <span className="font-bold">Όρια tier:</span>{' '}
          {thresholds
            .slice()
            .reverse()
            .map((t) => `${LOYALTY_TIER_LABELS[t.tier] || t.tier} ≥ ${fmtMiles(t.lifetime_miles)}`)
            .join(' · ')}
        </div>
      ) : null}

      <div className="grid xl:grid-cols-[1.05fr_0.95fr] gap-5 items-start">
        <section className="rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.04] flex flex-wrap gap-2 items-center justify-between">
            <h2 className="font-bold text-slate-900">Λογαριασμοί</h2>
            <div className="flex flex-wrap gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Αναζήτηση ονόματος / email…"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm min-w-[12rem]"
              />
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Όλα τα tiers</option>
                {tiers.map((t) => (
                  <option key={t} value={t}>
                    {LOYALTY_TIER_LABELS[t] || t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-slate-500">Φόρτωση…</p>
          ) : !visible.length ? (
            <div className="p-10 text-center">
              <span className="material-symbols-outlined text-4xl text-amber-300">stars</span>
              <p className="mt-3 font-bold text-slate-900">Δεν υπάρχουν λογαριασμοί ακόμα</p>
              <p className="mt-1 text-sm text-slate-500">Πρόσθεσε το πρώτο μέλος Miles+Bonus.</p>
              <button
                type="button"
                onClick={openCreate}
                className="mt-4 inline-flex items-center gap-1 rounded-full bg-amber-600 text-white px-4 py-2 text-sm font-bold"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Νέος λογαριασμός
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-black/[0.04] max-h-[36rem] overflow-auto">
              {visible.map((a) => {
                const active = a.id === selectedId;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full text-left px-4 py-3.5 flex gap-3 items-center transition ${
                        active ? 'bg-amber-50/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                          active ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {(a.display_name || a.client_email || '?').slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-slate-900 truncate">
                            {a.display_name || 'Χωρίς όνομα'}
                          </p>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                              TIER_BADGE[a.tier] || TIER_BADGE.STANDARD
                            }`}
                          >
                            {LOYALTY_TIER_LABELS[a.tier] || a.tier}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{a.client_email || '—'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-slate-900 tabular-nums text-sm">
                          {fmtMiles(a.redeemable_miles)}
                        </p>
                        <p className="text-[11px] text-slate-400">διαθέσιμα</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          {!selected ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Επίλεξε λογαριασμό για λεπτομέρειες και συναλλαγές.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {selected.display_name || 'Χωρίς όνομα'}
                    </h2>
                    <p className="text-sm text-slate-500">{selected.client_email || '—'}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span
                        className={`font-bold rounded-full px-2 py-0.5 ${
                          TIER_BADGE[selected.tier] || TIER_BADGE.STANDARD
                        }`}
                      >
                        {LOYALTY_TIER_LABELS[selected.tier] || selected.tier}
                      </span>
                      {selected.client_id ? <span>CRM id: {selected.client_id}</span> : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(selected)}
                      className="rounded-xl border px-3 py-2 text-xs font-bold hover:bg-slate-50"
                    >
                      Επεξεργασία
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAccount(selected)}
                      className="rounded-xl border border-rose-200 text-rose-700 px-3 py-2 text-xs font-bold hover:bg-rose-50"
                    >
                      Διαγραφή
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700/70">
                      Διαθέσιμα
                    </p>
                    <p className="text-xl font-bold text-amber-900 tabular-nums">
                      {fmtMiles(selected.redeemable_miles)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Lifetime
                    </p>
                    <p className="text-xl font-bold text-slate-900 tabular-nums">
                      {fmtMiles(selected.lifetime_miles)}
                    </p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={submitTx}
                className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-5 space-y-3"
              >
                <h3 className="font-bold text-slate-900">Νέα συναλλαγή miles</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700 text-xs">Τύπος</span>
                    <select
                      className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                      value={txForm.tx_type}
                      onChange={(e) => setTxForm((p) => ({ ...p, tx_type: e.target.value }))}
                    >
                      {Object.keys(LOYALTY_TX_LABELS).map((t) => (
                        <option key={t} value={t}>
                          {LOYALTY_TX_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700 text-xs">Miles</span>
                    <input
                      type="number"
                      step="0.01"
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={txForm.miles}
                      onChange={(e) => setTxForm((p) => ({ ...p, miles: e.target.value }))}
                      placeholder="π.χ. 500"
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700 text-xs">Πολλαπλασιαστής</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={txForm.multiplier}
                      onChange={(e) => setTxForm((p) => ({ ...p, multiplier: e.target.value }))}
                    />
                  </label>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700 text-xs">Πηγή</span>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={txForm.source_kind}
                      onChange={(e) => setTxForm((p) => ({ ...p, source_kind: e.target.value }))}
                      placeholder="booking / trip / manual"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700 text-xs">Source ID</span>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={txForm.source_id}
                      onChange={(e) => setTxForm((p) => ({ ...p, source_id: e.target.value }))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-bold text-slate-700 text-xs">Απόσταση (km)</span>
                    <input
                      type="number"
                      step="0.1"
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={txForm.distance_km}
                      onChange={(e) => setTxForm((p) => ({ ...p, distance_km: e.target.value }))}
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="font-bold text-slate-700 text-xs">Σημειώσεις</span>
                  <input
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={txForm.notes}
                    onChange={(e) => setTxForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="π.χ. Προσφορά καλοκαιριού"
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                  {saving ? 'Καταχώρηση…' : 'Καταχώρηση συναλλαγής'}
                </button>
              </form>

              <div className="rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-black/[0.04] flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Ιστορικό συναλλαγών</h3>
                  {txLoading ? <span className="text-xs text-slate-400">Φόρτωση…</span> : null}
                </div>
                {!transactions.length ? (
                  <p className="p-6 text-sm text-slate-500">Δεν υπάρχουν συναλλαγές ακόμα.</p>
                ) : (
                  <ul className="divide-y divide-black/[0.04] max-h-80 overflow-auto">
                    {transactions.map((tx) => (
                      <li key={tx.id} className="px-4 py-3 flex gap-3 items-start text-sm">
                        <span
                          className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            tx.tx_type === 'EARN'
                              ? 'bg-emerald-50 text-emerald-700'
                              : tx.tx_type === 'REDEEM'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {LOYALTY_TX_LABELS[tx.tx_type] || tx.tx_type}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 tabular-nums">
                            {Number(tx.miles) > 0 ? '+' : ''}
                            {fmtMiles(tx.miles)} miles
                          </p>
                          <p className="text-xs text-slate-500">
                            Υπόλοιπο: {fmtMiles(tx.balance_after)}
                            {tx.notes ? ` · ${tx.notes}` : ''}
                          </p>
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {fmtDate(tx.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {editorOpen ? (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Λογαριασμός επιβραβεύσεων"
          onClick={() => setEditorOpen(false)}
        >
          <form
            onSubmit={saveAccount}
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-black/[0.06] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-black/[0.04] flex items-center justify-between bg-gradient-to-r from-amber-50 to-white">
              <h3 className="font-bold text-slate-900">
                {editing ? 'Επεξεργασία λογαριασμού' : 'Νέος λογαριασμός'}
              </h3>
              <button
                type="button"
                className="rounded-full p-1.5 hover:bg-black/5"
                onClick={() => setEditorOpen(false)}
                aria-label="Κλείσιμο"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-sm">
                <span className="font-bold text-slate-700 text-xs">Όνομα</span>
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={form.display_name}
                  onChange={(e) => setForm((p) => ({ ...p, display_name: e.target.value }))}
                  placeholder="π.χ. Μαρία Παπαδοπούλου"
                />
              </label>
              <label className="block text-sm">
                <span className="font-bold text-slate-700 text-xs">Email</span>
                <input
                  type="email"
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={form.client_email}
                  onChange={(e) => setForm((p) => ({ ...p, client_email: e.target.value }))}
                  placeholder="member@email.com"
                />
              </label>
              <label className="block text-sm">
                <span className="font-bold text-slate-700 text-xs">CRM / Client ID (προαιρετικό)</span>
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={form.client_id}
                  onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="font-bold text-slate-700 text-xs">Lifetime miles</span>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={form.lifetime_miles}
                    onChange={(e) => setForm((p) => ({ ...p, lifetime_miles: e.target.value }))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-bold text-slate-700 text-xs">Διαθέσιμα miles</span>
                  <input
                    type="number"
                    step="0.01"
                    className="mt-1 w-full rounded-xl border px-3 py-2"
                    value={form.redeemable_miles}
                    onChange={(e) => setForm((p) => ({ ...p, redeemable_miles: e.target.value }))}
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="font-bold text-slate-700 text-xs">Tier</span>
                <select
                  className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                  value={form.tier}
                  onChange={(e) => setForm((p) => ({ ...p, tier: e.target.value }))}
                >
                  {tiers.map((t) => (
                    <option key={t} value={t}>
                      {LOYALTY_TIER_LABELS[t] || t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="px-5 py-4 border-t border-black/[0.04] flex justify-end gap-2 bg-slate-50/80">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-full px-4 py-2 text-sm font-bold text-slate-600 hover:bg-white"
              >
                Ακύρωση
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-amber-600 text-white px-5 py-2 text-sm font-bold disabled:opacity-60"
              >
                {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <span className="material-symbols-outlined text-amber-500 text-[20px]">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
