import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { deleteCustomer } from '../../lib/customers/customerStore.js';
import { isPaid, isConfirmed } from '../../lib/bookingDisplay.js';
import CustomerBookingCard from './CustomerBookingCard.jsx';
import AddCustomerModal from './AddCustomerModal.jsx';
import OfficeExcursionBookingModal from './OfficeExcursionBookingModal.jsx';

const TIERS = ['all', 'VIP', 'Platinum', 'Gold', 'Silver'];
const ACTIVITY_BUSES = [
  { id: 'all', label: 'Όλοι' },
  { id: 'trips', label: 'Με εκδρομές' },
  { id: 'active', label: 'Με δραστηριότητα' },
  { id: 'idle', label: 'Χωρίς κρατήσεις' },
];
const ACTIVITY_RENT = [
  { id: 'all', label: 'Όλοι' },
  { id: 'rentals', label: 'Με ενοικιάσεις' },
  { id: 'active', label: 'Με δραστηριότητα' },
  { id: 'idle', label: 'Χωρίς κρατήσεις' },
];

const TIER_STYLES = {
  VIP: 'bg-violet-100 text-violet-800 border-violet-200/80',
  Platinum: 'bg-zinc-800 text-zinc-50 border-zinc-700',
  Gold: 'bg-amber-100 text-amber-900 border-amber-200',
  Silver: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

function tierClass(tier) {
  return TIER_STYLES[tier] || TIER_STYLES.Silver;
}

function initials(name) {
  return String(name || '?').trim().substring(0, 2).toUpperCase() || '?';
}

function matchesQuery(customer, q) {
  if (!q) return true;
  const hay = [customer.name, customer.email, customer.phone, customer.company, customer.city, customer.afm, ...(customer.tags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

function formatJoin(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMoney(n) {
  return `€${Number(n || 0).toFixed(0)}`;
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
    case 'spend':
      next.sort((a, b) => (b.totalSpend || 0) - (a.totalSpend || 0));
      break;
    case 'activity':
      next.sort(
        (a, b) =>
          b.tripCount + b.rentalCount - (a.tripCount + a.rentalCount) ||
          (b.totalSpend || 0) - (a.totalSpend || 0),
      );
      break;
    case 'tier': {
      const rank = { VIP: 0, Platinum: 1, Gold: 2, Silver: 3 };
      next.sort(
        (a, b) =>
          (rank[a.tier] ?? 9) - (rank[b.tier] ?? 9) ||
          String(a.name || '').localeCompare(String(b.name || ''), 'el'),
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

function copyText(value, label) {
  if (!value) return;
  navigator.clipboard
    ?.writeText(String(value))
    .then(() => toast.success(`${label} αντιγράφηκε`))
    .catch(() => toast.error('Αποτυχία αντιγραφής'));
}

function exportCsv(rows) {
  const header = [
    'Όνομα',
    'Email',
    'Τηλέφωνο',
    'Εταιρεία',
    'Tier',
    'AeroMiles',
    'Εκδρομές',
    'Ενοικιάσεις',
    'Τζίρος',
    'Εγγραφή',
    'Tags',
  ];
  const lines = rows.map((c) =>
    [
      c.name,
      c.email,
      c.phone,
      c.company,
      c.tier,
      c.points ?? 0,
      c.tripCount,
      c.rentalCount,
      Number(c.totalSpend || 0).toFixed(2),
      c.joinDate,
      (c.tags || []).join('; '),
    ]
      .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pelatologio-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Εξαγωγή ${rows.length} πελατών`);
}

function IconBtn({ icon, label, onClick, href, className = '' }) {
  const cls = `w-8 h-8 rounded-xl border border-zinc-200/80 bg-white text-zinc-600 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 flex items-center justify-center transition-colors ${className}`;
  if (href) {
    return (
      <a
        href={href}
        title={label}
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className={cls}
      >
        <span className="material-symbols-outlined text-[16px]">{icon}</span>
      </a>
    );
  }
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={cls}
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
    </button>
  );
}

function CustomerDetail({
  customer: selectedCustomer,
  customers,
  bookings,
  rentalBookings,
  serviceScope = 'buses',
  onBack,
  openBookingTicket,
  onEdit,
  onDelete,
  onAddExcursion,
}) {
  const isRent = serviceScope === 'rent';
  const customer =
    customers.find((c) => c.id === selectedCustomer.id) ||
    selectedCustomer;
  const customerName = customer.name || 'Άγνωστος πελάτης';
  const customerBookings = isRent
    ? []
    : bookings.filter(
        (b) =>
          b.customerId === customer.id ||
          b.customerName === customer.name ||
          b.email === customer.email,
      );
  const customerRentals = isRent
    ? rentalBookings.filter(
        (b) =>
          b.client_id === customer.id ||
          (customer.email &&
            String(b.client_email || '')
              .trim()
              .toLowerCase() === String(customer.email).trim().toLowerCase()),
      )
    : [];
  const totalSpent = customerBookings.reduce((sum, b) => sum + (b.price || 0), 0);
  const rentalSpent = customerRentals
    .filter((b) => b.rental_status !== 'CANCELLED')
    .reduce((sum, b) => sum + Number(b.total_cost || 0), 0);
  const paidTotal = customerBookings.filter(isPaid).reduce((sum, b) => sum + (b.price || 0), 0);
  const confirmedCount = customerBookings.filter(isConfirmed).length;
  const pendingCount = customerBookings.length - confirmedCount;

  return (
    <div className="space-y-6 pb-10 relative animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-bold bg-white border border-zinc-200 text-zinc-800 shadow-sm hover:bg-zinc-50 transition-colors"
        >
          <span className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </span>
          Πίσω
        </button>
        <div className="flex items-center gap-2">
          {customer.phone ? (
            <a
              href={`tel:${customer.phone}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-100 hover:bg-emerald-100"
            >
              <span className="material-symbols-outlined text-[16px]">call</span>
              Κλήση
            </a>
          ) : null}
          {customer.email ? (
            <a
              href={`mailto:${customer.email}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-100 hover:bg-sky-100"
            >
              <span className="material-symbols-outlined text-[16px]">mail</span>
              Email
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => onEdit?.(customer)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-zinc-900 text-white hover:bg-zinc-800"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            Επεξεργασία
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(customer)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
            Διαγραφή
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[28px] border border-zinc-200/80 bg-gradient-to-br from-zinc-50 via-white to-sky-50/40 p-5 sm:p-6 shadow-sm">
        <div className="relative flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[20px] bg-zinc-900 text-white shadow-lg flex items-center justify-center text-xl font-bold tracking-tight">
              {initials(customerName)}
            </div>
            <div>
              <h2 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-zinc-900 leading-tight">
                {customerName}
              </h2>
              <p className="text-zinc-600 mt-0.5">{customer.email}</p>
              {customer.phone ? <p className="text-sm text-zinc-500 mt-0.5 tabular-nums">{customer.phone}</p> : null}
              {customer.company ? (
                <p className="text-sm text-zinc-500 mt-0.5">
                  {customer.company}
                  {customer.afm ? ` · ΑΦΜ ${customer.afm}` : ''}
                </p>
              ) : null}
              {Array.isArray(customer.tags) && customer.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {customer.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-white border border-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-600"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
              {customer.notes ? (
                <p className="text-xs text-zinc-500 mt-2 max-w-md leading-relaxed">{customer.notes}</p>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'AeroMiles', value: customer.points ?? 0, tone: 'text-amber-700 bg-amber-50 border-amber-100', icon: 'stars' },
          {
            label: isRent ? 'Ενοικιάσεις' : 'Επιβεβαιωμένες',
            value: isRent
              ? String(customerRentals.length)
              : `${confirmedCount}/${customerBookings.length}`,
            tone: 'text-emerald-700 bg-emerald-50 border-emerald-100',
            icon: isRent ? 'car_rental' : 'verified',
          },
          {
            label: isRent ? 'Τζίρος rent' : 'Εισπράχθηκαν',
            value: isRent ? `€${rentalSpent.toFixed(2)}` : `€${paidTotal.toFixed(2)}`,
            tone: 'text-sky-800 bg-sky-50 border-sky-100',
            icon: 'payments',
          },
          {
            label: 'Σύνολο',
            value: `€${(isRent ? rentalSpent : totalSpent).toFixed(2)}`,
            tone: 'text-zinc-900 bg-zinc-50 border-zinc-200',
            icon: 'receipt_long',
            hint: !isRent && pendingCount > 0 ? `${pendingCount} εκκρεμείς` : null,
          },
        ].map((card) => (
          <div key={card.label} className={`rounded-2xl border p-4 ${card.tone}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[18px]">{card.icon}</span>
              <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">{card.label}</span>
            </div>
            <p className="text-2xl font-bold tracking-tight tabular-nums">{card.value}</p>
            {card.hint ? <p className="text-xs font-bold text-amber-600 mt-1">{card.hint}</p> : null}
          </div>
        ))}
      </div>

      {!isRent ? (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <h3 className="font-semibold text-lg flex items-center gap-2.5 tracking-tight">
            <span className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">confirmation_number</span>
            </span>
            Εκδρομές
          </h3>
          <button
            type="button"
            onClick={() => onAddExcursion?.(customer)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Προσθήκη εκδρομής
          </button>
        </div>
        {customerBookings.length === 0 ? (
          <div className="p-8 text-center bg-zinc-50 rounded-3xl border border-zinc-100 space-y-3">
            <p className="text-zinc-500">Δεν υπάρχουν καταγεγραμμένες κρατήσεις εκδρομών.</p>
            <button
              type="button"
              onClick={() => onAddExcursion?.(customer)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold bg-sky-600 text-white hover:bg-sky-700"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Προσθήκη εκδρομής από το γραφείο
            </button>
          </div>
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
      ) : null}

      {isRent ? (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2.5 px-1 tracking-tight">
          <span className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">car_rental</span>
          </span>
          Ενοικιάσεις
          {customerRentals.length ? (
            <span className="text-sm font-semibold text-zinc-400">
              · {customerRentals.length} · €{rentalSpent.toFixed(2)}
            </span>
          ) : null}
        </h3>
        {customerRentals.length === 0 ? (
          <p className="p-6 text-center text-zinc-500 bg-teal-50/40 rounded-3xl border border-teal-100">
            Καμία ενοικίαση για αυτό το πρόσωπο.
          </p>
        ) : (
          customerRentals.map((r) => (
            <article
              key={r.id}
              className="rounded-2xl border border-teal-100 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="font-bold text-sm text-zinc-900">
                  {r.vehicle_model || 'Όχημα'} · {r.vehicle_plate || '—'}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
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
                <p className="text-[11px] font-bold text-zinc-500">{r.rental_status}</p>
              </div>
            </article>
          ))
        )}
      </div>
      ) : null}

      <p className="text-xs text-zinc-400 text-center">Εγγραφή: {formatJoin(customer.joinDate)}</p>
    </div>
  );
}

export default function CustomersCrmPanel({
  customers = [],
  selectedCustomer,
  setSelectedCustomer,
  bookings = [],
  rentalBookings = [],
  serviceScope = 'buses',
  onAddCustomer,
  onCustomersChange,
  onBookingsChange,
  openBookingTicket,
}) {
  const isRent = serviceScope === 'rent';
  const activityOptions = isRent ? ACTIVITY_RENT : ACTIVITY_BUSES;
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('activity');
  const [editCustomer, setEditCustomer] = useState(null);
  const [addExcursionOpen, setAddExcursionOpen] = useState(false);

  const scopedBookings = isRent ? [] : bookings;
  const scopedRentals = isRent ? rentalBookings : [];

  const enriched = useMemo(() => {
    return customers.map((c) => {
      const email = String(c.email || '')
        .trim()
        .toLowerCase();
      const tripBookings = scopedBookings.filter(
        (b) =>
          b.customerId === c.id ||
          b.customerName === c.name ||
          (email && String(b.email || '').trim().toLowerCase() === email),
      );
      const rentals = scopedRentals.filter(
        (b) =>
          b.client_id === c.id ||
          (email &&
            String(b.client_email || '')
              .trim()
              .toLowerCase() === email),
      );
      const tripSpend = tripBookings.reduce((s, b) => s + (Number(b.price) || 0), 0);
      const rentalSpend = rentals
        .filter((b) => b.rental_status !== 'CANCELLED')
        .reduce((s, b) => s + Number(b.total_cost || 0), 0);
      return {
        ...c,
        tripCount: tripBookings.length,
        rentalCount: rentals.length,
        totalSpend: tripSpend + rentalSpend,
      };
    });
  }, [customers, scopedBookings, scopedRentals]);

  const stats = useMemo(() => {
    const vipGold = enriched.filter((c) => ['VIP', 'Gold', 'Platinum'].includes(c.tier)).length;
    const active = enriched.filter((c) => (isRent ? c.rentalCount > 0 : c.tripCount > 0)).length;
    const spend = enriched.reduce((s, c) => s + (c.totalSpend || 0), 0);
    return { total: enriched.length, vipGold, active, spend };
  }, [enriched, isRent]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = enriched.filter((c) => matchesQuery(c, q));
    if (tierFilter !== 'all') {
      list = list.filter((c) => (c.tier || 'Silver') === tierFilter);
    }
    if (activityFilter === 'trips') list = list.filter((c) => c.tripCount > 0);
    if (activityFilter === 'rentals') list = list.filter((c) => c.rentalCount > 0);
    if (activityFilter === 'active') {
      list = list.filter((c) => (isRent ? c.rentalCount > 0 : c.tripCount > 0));
    }
    if (activityFilter === 'idle') {
      list = list.filter((c) => (isRent ? c.rentalCount === 0 : c.tripCount === 0));
    }
    return sortCustomers(list, sortBy);
  }, [enriched, query, tierFilter, activityFilter, sortBy, isRent]);

  const clearFilters = () => {
    setQuery('');
    setTierFilter('all');
    setActivityFilter('all');
  };

  const handleSaved = (row) => {
    onCustomersChange?.(row);
    if (selectedCustomer && (selectedCustomer.id === row.id || selectedCustomer.email === row.email)) {
      setSelectedCustomer(row);
    }
    setEditCustomer(null);
  };

  const handleDelete = (customer) => {
    if (!customer?.id && !customer?.email) return;
    const label = customer.name || customer.email || 'πελάτη';
    if (!window.confirm(`Διαγραφή πελάτη «${label}»;`)) return;
    const ok = deleteCustomer(customer.id || customer.email, serviceScope);
    if (!ok) {
      toast.error('Δεν βρέθηκε ο πελάτης');
      return;
    }
    if (
      selectedCustomer &&
      (selectedCustomer.id === customer.id ||
        String(selectedCustomer.email || '').toLowerCase() ===
          String(customer.email || '').toLowerCase())
    ) {
      setSelectedCustomer(null);
    }
    onCustomersChange?.(null);
    toast.success('Ο πελάτης διαγράφηκε');
  };

  if (selectedCustomer) {
    return (
      <>
        <CustomerDetail
          customer={selectedCustomer}
          customers={customers}
          bookings={scopedBookings}
          rentalBookings={scopedRentals}
          serviceScope={serviceScope}
          onBack={() => setSelectedCustomer(null)}
          openBookingTicket={openBookingTicket}
          onEdit={setEditCustomer}
          onDelete={handleDelete}
          onAddExcursion={isRent ? undefined : () => setAddExcursionOpen(true)}
        />
        <AddCustomerModal
          open={Boolean(editCustomer)}
          customer={editCustomer}
          serviceScope={serviceScope}
          onClose={() => setEditCustomer(null)}
          onCreated={handleSaved}
        />
        <OfficeExcursionBookingModal
          open={!isRent && addExcursionOpen}
          customer={selectedCustomer}
          bookings={scopedBookings}
          onClose={() => setAddExcursionOpen(false)}
          onCreated={() => {
            onBookingsChange?.();
            onCustomersChange?.(null);
          }}
        />
      </>
    );
  }

  return (
    <div className="relative space-y-5 pb-10 animate-in fade-in duration-500">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-8 h-48 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(24,24,27,0.06),_transparent_70%)]"
      />

      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div className="space-y-1.5">
          <h2 className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-zinc-900 leading-none">
            {isRent ? 'Πελάτες ενοικιάσεων' : 'Πελάτες λεωφορείων'}
          </h2>
          <p className="text-[15px] text-zinc-500 tracking-tight max-w-lg leading-relaxed">
            {isRent
              ? 'Ξεχωριστό CRM ενοικιάσεων — δεν αναμειγνύεται με επιβάτες λεωφορείων.'
              : 'Ξεχωριστό CRM εκδρομών — δεν αναμειγνύεται με πελάτες ενοικιάσεων.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            disabled={!filtered.length}
            className="px-4 py-2.5 rounded-full text-sm font-semibold border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            CSV
          </button>
          <button
            type="button"
            onClick={onAddCustomer}
            className="px-5 py-2.5 bg-zinc-900 text-white font-semibold text-sm rounded-full hover:bg-zinc-800 active:scale-[0.98] transition flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Νέος πελάτης
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          { label: 'Πελάτες', value: stats.total, icon: 'group' },
          { label: 'Premium tiers', value: stats.vipGold, icon: 'workspace_premium' },
          { label: 'Με κρατήσεις', value: stats.active, icon: 'local_activity' },
          { label: 'Τζίρος', value: formatMoney(stats.spend), icon: 'payments' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-zinc-200/80 bg-white px-4 py-3.5 flex items-center gap-3 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
          >
            <span className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">{kpi.icon}</span>
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{kpi.label}</p>
              <p className="text-xl font-bold tracking-tight text-zinc-900 tabular-nums leading-tight">
                {kpi.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[24px] border border-zinc-200/80 bg-white p-3 sm:p-4 space-y-3 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <label className="relative flex-1 min-w-0">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-[20px]">
              search
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Όνομα, email, τηλέφωνο, εταιρεία, tag…"
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 pl-11 pr-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900/5 transition"
            />
          </label>
          <label className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Ταξινόμηση</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/5"
            >
              <option value="activity">Δραστηριότητα</option>
              <option value="spend">Τζίρος</option>
              <option value="joined">Νεότεροι</option>
              <option value="name">Όνομα</option>
              <option value="tier">Tier</option>
              <option value="points">AeroMiles</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {activityOptions.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setActivityFilter(a.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                activityFilter === a.id
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-300'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          {TIERS.map((t) => {
            const active = tierFilter === t;
            const label = t === 'all' ? 'Όλα τα tiers' : t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTierFilter(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  active
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                }`}
              >
                {label}
              </button>
            );
          })}
          <span className="ml-auto self-center text-xs font-semibold text-zinc-400 tabular-nums">
            {filtered.length} από {enriched.length}
          </span>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-2.5">
        {enriched.length === 0 ? (
          <EmptyState onAdd={onAddCustomer} />
        ) : filtered.length === 0 ? (
          <NoResults onClear={clearFilters} />
        ) : (
          filtered.map((customer) => (
            <div
              key={customer.id}
              className="rounded-[22px] border border-zinc-200/80 bg-white p-3.5 shadow-sm"
            >
              <button
                type="button"
                onClick={() => setSelectedCustomer(customer)}
                className="w-full text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-zinc-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {initials(customer.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-zinc-900 truncate">{customer.name}</p>
                      <span
                        className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${tierClass(customer.tier)}`}
                      >
                        {customer.tier || 'Silver'}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500 truncate mt-0.5">{customer.email}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] font-semibold text-zinc-500">
                      {isRent ? (
                        <span>{customer.rentalCount} ενοικ.</span>
                      ) : (
                        <span>{customer.tripCount} εκδ.</span>
                      )}
                      <span className="text-amber-600">{customer.points ?? 0} mi</span>
                      <span className="text-zinc-800">{formatMoney(customer.totalSpend)}</span>
                    </div>
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-zinc-100">
                {customer.phone ? (
                  <IconBtn icon="call" label="Κλήση" href={`tel:${customer.phone}`} />
                ) : null}
                {customer.email ? (
                  <IconBtn icon="mail" label="Email" href={`mailto:${customer.email}`} />
                ) : null}
                <IconBtn
                  icon="content_copy"
                  label="Αντιγραφή email"
                  onClick={() => copyText(customer.email, 'Email')}
                />
                <IconBtn icon="edit" label="Επεξεργασία" onClick={() => setEditCustomer(customer)} />
                <IconBtn
                  icon="delete"
                  label="Διαγραφή"
                  onClick={() => handleDelete(customer)}
                  className="hover:!bg-rose-600 hover:!border-rose-600"
                />
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(customer)}
                  className="ml-auto text-xs font-bold text-zinc-700 inline-flex items-center gap-0.5"
                >
                  Προφίλ
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop */}
      <div className="hidden md:block bg-white rounded-[28px] shadow-sm border border-zinc-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/80">
                {['Πελάτης', 'Επικοινωνία', 'Tier', 'Κρατήσεις', 'Τζίρος', 'Miles', 'Εγγραφή', ''].map(
                  (h) => (
                    <th
                      key={h || 'actions'}
                      className={`px-4 py-3 text-[11px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap ${
                        h === 'Tier' || h === 'Κρατήσεις' ? 'text-center' : h === '' ? '' : h === 'Πελάτης' || h === 'Επικοινωνία' ? 'text-left' : 'text-right'
                      }`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {enriched.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState onAdd={onAddCustomer} />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <NoResults onClear={clearFilters} />
                  </td>
                </tr>
              ) : (
                filtered.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center text-xs font-bold group-hover:scale-105 transition-transform shrink-0">
                          {initials(customer.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-zinc-900 truncate">{customer.name}</p>
                          {customer.company ? (
                            <p className="text-xs text-zinc-400 truncate max-w-[200px]">{customer.company}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-zinc-700 truncate max-w-[200px]">{customer.email || '—'}</p>
                      <p className={`text-xs mt-0.5 tabular-nums ${customer.phone ? 'text-zinc-400' : 'text-zinc-300'}`}>
                        {customer.phone || 'Χωρίς τηλέφωνο'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border ${tierClass(customer.tier || 'Silver')}`}
                      >
                        {customer.tier || 'Silver'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-3 text-xs font-semibold text-zinc-600">
                        {isRent ? (
                          <span className="inline-flex items-center gap-1" title="Ενοικιάσεις">
                            <span className="material-symbols-outlined text-[15px] text-teal-600">car_rental</span>
                            {customer.rentalCount}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1" title="Εκδρομές">
                            <span className="material-symbols-outlined text-[15px] text-sky-500">confirmation_number</span>
                            {customer.tripCount}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-zinc-900 tabular-nums text-sm">
                      {formatMoney(customer.totalSpend)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-amber-600 tabular-nums text-sm">
                      {customer.points ?? 0}
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm text-zinc-500 whitespace-nowrap">
                      {formatJoin(customer.joinDate)}
                    </td>
                    <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        {customer.phone ? (
                          <IconBtn icon="call" label="Κλήση" href={`tel:${customer.phone}`} />
                        ) : null}
                        {customer.email ? (
                          <IconBtn icon="mail" label="Email" href={`mailto:${customer.email}`} />
                        ) : null}
                        <IconBtn
                          icon="content_copy"
                          label="Αντιγραφή email"
                          onClick={() => copyText(customer.email, 'Email')}
                        />
                        <IconBtn icon="edit" label="Επεξεργασία" onClick={() => setEditCustomer(customer)} />
                        <IconBtn
                          icon="person"
                          label="Προφίλ"
                          onClick={() => setSelectedCustomer(customer)}
                        />
                        <IconBtn
                          icon="delete"
                          label="Διαγραφή"
                          onClick={() => handleDelete(customer)}
                          className="hover:!bg-rose-600 hover:!border-rose-600"
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddCustomerModal
        open={Boolean(editCustomer)}
        customer={editCustomer}
        onClose={() => setEditCustomer(null)}
        onCreated={handleSaved}
      />
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 px-4 text-center">
      <span className="w-14 h-14 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl">group_off</span>
      </span>
      <p className="font-bold text-zinc-800">Δεν υπάρχουν πελάτες ακόμα</p>
      <p className="text-sm text-zinc-500 max-w-sm">
        Προσθέστε πελάτη χειροκίνητα ή θα εμφανιστούν αυτόματα από κρατήσεις.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-1 px-5 py-2.5 rounded-full bg-zinc-900 text-white text-sm font-bold inline-flex items-center gap-2"
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
      <span className="material-symbols-outlined text-3xl text-zinc-300">filter_alt_off</span>
      <p className="font-bold text-zinc-700">Κανένα αποτέλεσμα</p>
      <p className="text-sm text-zinc-500">Δοκιμάστε άλλη αναζήτηση ή φίλτρο.</p>
      <button type="button" onClick={onClear} className="mt-1 text-sm font-bold text-zinc-800 hover:underline">
        Καθαρισμός φίλτρων
      </button>
    </div>
  );
}
