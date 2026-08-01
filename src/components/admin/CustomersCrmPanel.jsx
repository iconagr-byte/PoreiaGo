import { useMemo, useState } from 'react';
import { loadAllCustomers } from '../../lib/customers/customerStore.js';
import { isPaid, isConfirmed } from '../../lib/bookingDisplay.js';
import CustomerBookingCard from './CustomerBookingCard.jsx';
import DashboardKpiCard from './DashboardKpiCard.jsx';

const TIERS = ['all', 'VIP', 'Platinum', 'Gold', 'Silver'];

const TIER_STYLES = {
  VIP: 'bg-violet-100 text-violet-800 border-violet-200/80',
  Platinum: 'bg-slate-800 text-slate-100 border-slate-700',
  Gold: 'bg-gradient-to-r from-amber-200 to-yellow-100 text-amber-900 border-amber-300/60',
  Silver: 'bg-sky-50 text-sky-800 border-sky-200',
};

function tierClass(tier) {
  return TIER_STYLES[tier] || TIER_STYLES.Silver;
}

function initials(name) {
  return String(name || '?').trim().substring(0, 2).toUpperCase() || '?';
}

function matchesQuery(customer, q) {
  if (!q) return true;
  const hay = [customer.name, customer.email, customer.phone, customer.company, customer.city, customer.afm]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

function sortCustomers(list, sortBy) {
  const next = [...list];
  switch (sortBy) {
    case 'name':
      next.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'el'));
      break;
    case 'points':
      next.sort((a, b) => (b.points || 0) - (a.points || 0));
      break;
    case 'tier': {
      const rank = { VIP: 0, Platinum: 1, Gold: 2, Silver: 3 };
      next.sort(
        (a, b) => (rank[a.tier] ?? 9) - (rank[b.tier] ?? 9) || String(a.name || '').localeCompare(String(b.name || ''), 'el'),
      );
      break;
    }
    case 'joined':
    default:
      next.sort((a, b) => String(b.joinDate || '').localeCompare(String(a.joinDate || '')));
      break;
  }
  return next;
}

function CustomerDetail({
  customer: selectedCustomer,
  customers,
  bookings,
  rentalBookings,
  onBack,
  openBookingTicket,
}) {
  const customer =
    customers.find((c) => c.id === selectedCustomer.id) ||
    loadAllCustomers().find((c) => c.id === selectedCustomer.id) ||
    selectedCustomer;
  const customerName = customer.name || 'Άγνωστος πελάτης';
  const customerBookings = bookings.filter(
    (b) =>
      b.customerId === customer.id ||
      b.customerName === customer.name ||
      b.email === customer.email,
  );
  const customerRentals = rentalBookings.filter(
    (b) =>
      b.client_id === customer.id ||
      (customer.email &&
        String(b.client_email || '')
          .trim()
          .toLowerCase() === String(customer.email).trim().toLowerCase()),
  );
  const totalSpent = customerBookings.reduce((sum, b) => sum + (b.price || 0), 0);
  const rentalSpent = customerRentals
    .filter((b) => b.rental_status !== 'CANCELLED')
    .reduce((sum, b) => sum + Number(b.total_cost || 0), 0);
  const paidTotal = customerBookings.filter(isPaid).reduce((sum, b) => sum + (b.price || 0), 0);
  const confirmedCount = customerBookings.filter(isConfirmed).length;
  const pendingCount = customerBookings.length - confirmedCount;

  return (
    <div className="space-y-stack-lg pb-stack-lg relative animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-4 mb-2">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white border border-sky-100 text-sky-700 hover:bg-sky-50 shadow-sm flex items-center justify-center transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <span className="font-bold text-slate-500">Πίσω στον κατάλογο πελατών</span>
      </div>

      <div className="relative overflow-hidden rounded-[32px] border border-sky-100/80 bg-gradient-to-br from-sky-50 via-white to-teal-50 p-5 sm:p-6 mb-2 shadow-[0_12px_40px_rgba(14,165,233,0.08)]">
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-teal-300/20 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-sky-500 text-white shadow-lg shadow-primary/25 flex items-center justify-center text-xl font-bold">
              {initials(customerName)}
            </div>
            <div>
              <h2 className="font-headline-lg font-bold text-slate-900 tracking-tight">{customerName}</h2>
              <p className="text-slate-600">{customer.email}</p>
              {customer.phone ? <p className="text-sm text-slate-500 mt-0.5">{customer.phone}</p> : null}
              {customer.company ? (
                <p className="text-sm text-slate-500 mt-0.5">
                  {customer.company}
                  {customer.afm ? ` · ΑΦΜ ${customer.afm}` : ''}
                </p>
              ) : null}
              <p className="text-sm text-slate-400 font-mono mt-1">{customer.id}</p>
              {Array.isArray(customer.tags) && customer.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {customer.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-white/80 border border-sky-100 px-2 py-0.5 text-[10px] font-bold text-slate-600"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
              {customer.notes ? (
                <p className="text-xs text-slate-500 mt-2 max-w-md leading-relaxed">{customer.notes}</p>
              ) : null}
            </div>
          </div>
          <span
            className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm border ${tierClass(customer.tier || 'Silver')}`}
          >
            {customer.tier || 'Silver'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50/60 p-5 rounded-3xl border border-amber-100 shadow-sm hover:-translate-y-0.5 transition-transform duration-300">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              stars
            </span>
          </div>
          <div className="text-[11px] font-bold text-amber-700/70 uppercase tracking-wider mb-1">AeroMiles</div>
          <div className="text-2xl font-bold text-amber-700">{customer.points ?? 0}</div>
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50/50 p-5 rounded-3xl border border-emerald-100 shadow-sm hover:-translate-y-0.5 transition-transform duration-300">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              verified
            </span>
          </div>
          <div className="text-[11px] font-bold text-emerald-700/70 uppercase tracking-wider mb-1">Επιβεβαιωμένες</div>
          <div className="text-2xl font-bold text-emerald-700">
            {confirmedCount}
            <span className="text-sm text-emerald-600/50 font-normal"> / {customerBookings.length}</span>
          </div>
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-sky-50 to-primary/[0.08] p-5 rounded-3xl border border-sky-100 shadow-sm hover:-translate-y-0.5 transition-transform duration-300">
          <div className="w-9 h-9 rounded-xl bg-sky-100 text-primary flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              account_balance_wallet
            </span>
          </div>
          <div className="text-[11px] font-bold text-sky-700/70 uppercase tracking-wider mb-1">Εισπράχθηκαν</div>
          <div className="text-2xl font-bold text-primary">€{paidTotal.toFixed(2)}</div>
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-indigo-50/40 p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:-translate-y-0.5 transition-transform duration-300">
          <div className="w-9 h-9 rounded-xl bg-slate-200/80 text-slate-700 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              receipt_long
            </span>
          </div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Σύνολο τιμολογίων</div>
          <div className="text-2xl font-bold text-slate-900">€{totalSpent.toFixed(2)}</div>
          {pendingCount > 0 && (
            <p className="text-xs text-amber-600 mt-1 font-bold">{pendingCount} εκκρεμείς</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-lg flex items-center gap-2.5 px-1">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-sky-500 text-white shadow-md shadow-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">receipt_long</span>
          </span>
          Ιστορικό εκδρομών & οικονομικά
        </h3>
        {customerBookings.length === 0 ? (
          <p className="p-8 text-center text-slate-500 bg-gradient-to-br from-slate-50 to-sky-50/40 rounded-3xl border border-sky-100">
            Δεν υπάρχουν καταγεγραμμένες κρατήσεις εκδρομών.
          </p>
        ) : (
          customerBookings.map((b) => (
            <CustomerBookingCard
              key={b.id}
              booking={b}
              onOpenDetail={openBookingTicket}
              onViewTicket={openBookingTicket}
            />
          ))
        )}
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-lg flex items-center gap-2.5 px-1">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-md shadow-teal-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">car_rental</span>
          </span>
          Ενοικιάσεις
          {customerRentals.length ? (
            <span className="text-sm font-semibold text-slate-400">
              · {customerRentals.length} · €{rentalSpent.toFixed(2)}
            </span>
          ) : null}
        </h3>
        {customerRentals.length === 0 ? (
          <p className="p-6 text-center text-slate-500 bg-gradient-to-br from-slate-50 to-teal-50/40 rounded-3xl border border-teal-100">
            Καμία ενοικίαση για αυτό το πρόσωπο.
          </p>
        ) : (
          customerRentals.map((r) => (
            <article
              key={r.id}
              className="rounded-2xl border border-teal-100 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-900">
                  {r.vehicle_model || 'Όχημα'} · {r.vehicle_plate || '—'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {r.start_time
                    ? new Date(r.start_time).toLocaleString('el-GR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                  {' → '}
                  {r.end_time
                    ? new Date(r.end_time).toLocaleString('el-GR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                  {r.pickup_location ? ` · ${r.pickup_location}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-teal-700">€{Number(r.total_cost || 0).toFixed(2)}</p>
                <p className="text-[11px] font-bold text-slate-500">{r.rental_status}</p>
              </div>
            </article>
          ))
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">Εγγραφή: {customer.joinDate}</p>
    </div>
  );
}

export default function CustomersCrmPanel({
  customers = [],
  selectedCustomer,
  setSelectedCustomer,
  bookings = [],
  rentalBookings = [],
  onAddCustomer,
  openBookingTicket,
}) {
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [sortBy, setSortBy] = useState('joined');

  const enriched = useMemo(() => {
    return customers.map((c) => {
      const email = String(c.email || '')
        .trim()
        .toLowerCase();
      const tripCount = bookings.filter(
        (b) =>
          b.customerId === c.id ||
          b.customerName === c.name ||
          (email && String(b.email || '').trim().toLowerCase() === email),
      ).length;
      const rentalCount = rentalBookings.filter(
        (b) =>
          b.client_id === c.id ||
          (email &&
            String(b.client_email || '')
              .trim()
              .toLowerCase() === email),
      ).length;
      return { ...c, tripCount, rentalCount };
    });
  }, [customers, bookings, rentalBookings]);

  const stats = useMemo(() => {
    const vipGold = enriched.filter((c) => c.tier === 'VIP' || c.tier === 'Gold' || c.tier === 'Platinum').length;
    const withPhone = enriched.filter((c) => c.phone).length;
    const points = enriched.reduce((s, c) => s + (Number(c.points) || 0), 0);
    return { total: enriched.length, vipGold, withPhone, points };
  }, [enriched]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = enriched.filter((c) => matchesQuery(c, q));
    if (tierFilter !== 'all') {
      list = list.filter((c) => (c.tier || 'Silver') === tierFilter);
    }
    return sortCustomers(list, sortBy);
  }, [enriched, query, tierFilter, sortBy]);

  if (selectedCustomer) {
    return (
      <CustomerDetail
        customer={selectedCustomer}
        customers={customers}
        bookings={bookings}
        rentalBookings={rentalBookings}
        onBack={() => setSelectedCustomer(null)}
        openBookingTicket={openBookingTicket}
      />
    );
  }

  return (
    <div className="relative space-y-6 pb-10 animate-in fade-in duration-500">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-56 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(14,165,233,0.08),_transparent_65%)]"
      />

      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1.5">
          <h2 className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-slate-900 leading-none">
            Πελατολόγιο
          </h2>
          <p className="text-[15px] text-slate-500 tracking-tight max-w-xl leading-relaxed">
            Κατάλογος πελατών, ιστορικό κρατήσεων και ενοικιάσεων. Miles+Bonus στο μενού Επιβραβεύσεις.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddCustomer}
          className="px-5 py-2.5 bg-primary text-white font-semibold text-sm rounded-full hover:scale-[1.03] active:scale-[0.98] transition-transform flex items-center gap-2 shadow-md shadow-primary/20 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Νέος πελάτης
        </button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <DashboardKpiCard label="Πελάτες" value={stats.total} icon="group" tone="sky" />
        <DashboardKpiCard label="VIP / Gold / Platinum" value={stats.vipGold} icon="workspace_premium" tone="violet" />
        <DashboardKpiCard label="Με τηλέφωνο" value={stats.withPhone} icon="call" tone="emerald" />
        <DashboardKpiCard label="AeroMiles" value={stats.points} icon="stars" tone="amber" />
      </div>

      <div className="rounded-[28px] border border-sky-100/80 bg-white/90 shadow-[0_8px_30px_rgba(15,23,42,0.04)] p-3 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <label className="relative flex-1 min-w-0">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
              search
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση ονόματος, email, τηλεφώνου, εταιρείας…"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 pl-11 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100 transition"
            />
          </label>
          <label className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ταξινόμηση</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            >
              <option value="joined">Νεότεροι</option>
              <option value="name">Όνομα</option>
              <option value="tier">Tier</option>
              <option value="points">AeroMiles</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {TIERS.map((t) => {
            const active = tierFilter === t;
            const label = t === 'all' ? 'Όλοι' : t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTierFilter(t)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            );
          })}
          <span className="ml-auto self-center text-xs font-semibold text-slate-400 tabular-nums">
            {filtered.length} από {enriched.length}
          </span>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {enriched.length === 0 ? (
          <EmptyState onAdd={onAddCustomer} />
        ) : filtered.length === 0 ? (
          <NoResults onClear={() => { setQuery(''); setTierFilter('all'); }} />
        ) : (
          filtered.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => setSelectedCustomer(customer)}
              className="w-full text-left rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm hover:border-sky-200 hover:shadow-md transition-all active:scale-[0.99]"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/15 to-sky-100 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                  {initials(customer.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-slate-900 truncate">{customer.name}</p>
                    <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${tierClass(customer.tier)}`}>
                      {customer.tier || 'Silver'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 truncate mt-0.5">{customer.email}</p>
                  {customer.phone ? <p className="text-xs text-slate-400 mt-0.5">{customer.phone}</p> : null}
                  <div className="flex flex-wrap gap-3 mt-2 text-[11px] font-semibold text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">confirmation_number</span>
                      {customer.tripCount} εκδρομές
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">car_rental</span>
                      {customer.rentalCount} ενοικ.
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <span className="material-symbols-outlined text-[14px]">stars</span>
                      {customer.points ?? 0}
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-slate-300 mt-1">chevron_right</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-[32px] shadow-[0_8px_30px_rgba(15,23,42,0.05)] border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Πελάτης
                </th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Επικοινωνία
                </th>
                <th className="px-5 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Tier
                </th>
                <th className="px-5 py-3.5 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Κρατήσεις
                </th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  AeroMiles
                </th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Εγγραφή
                </th>
                <th className="px-3 py-3.5 w-10" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {enriched.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4">
                    <EmptyState onAdd={onAddCustomer} />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4">
                    <NoResults onClear={() => { setQuery(''); setTierFilter('all'); }} />
                  </td>
                </tr>
              ) : (
                filtered.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className="border-b border-slate-50 last:border-0 hover:bg-sky-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/15 to-sky-100 text-primary flex items-center justify-center text-xs font-bold group-hover:scale-105 transition-transform shrink-0">
                          {initials(customer.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate flex items-center gap-2">
                            {customer.name}
                            {customer.tier === 'VIP' ? (
                              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">
                                VIP
                              </span>
                            ) : null}
                          </p>
                          {customer.company ? (
                            <p className="text-xs text-slate-400 truncate max-w-[240px]">{customer.company}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-slate-700 truncate max-w-[220px]">{customer.email || '—'}</p>
                      {customer.phone ? (
                        <p className="text-xs text-slate-400 mt-0.5 tabular-nums">{customer.phone}</p>
                      ) : (
                        <p className="text-xs text-slate-300 mt-0.5">Χωρίς τηλέφωνο</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${tierClass(customer.tier || 'Silver')}`}
                      >
                        {customer.tier || 'Silver'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-3 text-xs font-semibold text-slate-600">
                        <span
                          className="inline-flex items-center gap-1"
                          title="Εκδρομές"
                        >
                          <span className="material-symbols-outlined text-[16px] text-sky-500">confirmation_number</span>
                          {customer.tripCount}
                        </span>
                        <span
                          className="inline-flex items-center gap-1"
                          title="Ενοικιάσεις"
                        >
                          <span className="material-symbols-outlined text-[16px] text-teal-500">car_rental</span>
                          {customer.rentalCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="inline-flex items-center justify-end gap-1.5 font-bold text-amber-600 tabular-nums">
                        {(customer.points || 0) >= 1500 ? (
                          <span className="material-symbols-outlined text-[16px] text-amber-500">redeem</span>
                        ) : null}
                        {customer.points ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-slate-500 tabular-nums whitespace-nowrap">
                      {customer.joinDate || '—'}
                    </td>
                    <td className="px-3 py-4 text-slate-300 group-hover:text-sky-500 transition-colors">
                      <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 px-4 text-center">
      <span className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl">group_off</span>
      </span>
      <p className="font-bold text-slate-800">Δεν υπάρχουν πελάτες ακόμα</p>
      <p className="text-sm text-slate-500 max-w-sm">
        Προσθέστε πελάτη χειροκίνητα ή θα εμφανιστούν αυτόματα από κρατήσεις.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-1 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">person_add</span>
        Νέος πελάτης
      </button>
    </div>
  );
}

function NoResults({ onClear }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 px-4 text-center">
      <span className="material-symbols-outlined text-3xl text-slate-300">filter_alt_off</span>
      <p className="font-bold text-slate-700">Κανένα αποτέλεσμα</p>
      <p className="text-sm text-slate-500">Δοκιμάστε άλλη αναζήτηση ή φίλτρο tier.</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-1 text-sm font-bold text-sky-700 hover:underline"
      >
        Καθαρισμός φίλτρων
      </button>
    </div>
  );
}
