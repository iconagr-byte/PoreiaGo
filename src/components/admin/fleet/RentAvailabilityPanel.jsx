/**
 * Rent vehicle readiness board — status + ΚΤΕΟ/ασφάλεια + bookable flag.
 */
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchRentalAvailabilityBoard } from '../../../services/fleetRentalApi.js';
import { rentCategoryLabel } from '../../../lib/rental/rentVehicleCategories.js';
import { resolveSiteAssetUrl } from '../../../services/siteAppearanceApi.js';

const STATUS_LABEL = {
  AVAILABLE: 'Διαθέσιμο',
  RENTED: 'Σε ενοικίαση',
  MAINTENANCE: 'Συντήρηση',
  CLEANING: 'Καθαρισμός',
  IN_TRANSIT: 'Μετακίνηση',
};

function flagChip(flag) {
  const map = {
    MAINTENANCE: { label: 'Συντήρηση', className: 'bg-amber-50 text-amber-800 border-amber-200' },
    CLEANING: { label: 'Καθαρισμός', className: 'bg-sky-50 text-sky-800 border-sky-200' },
    IN_TRANSIT: { label: 'Μετακίνηση', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    KTEO_EXPIRED: { label: 'ΚΤΕΟ ληγμένο', className: 'bg-rose-50 text-rose-800 border-rose-200' },
    KTEO_SOON: { label: 'ΚΤΕΟ σύντομα', className: 'bg-orange-50 text-orange-800 border-orange-200' },
    INSURANCE_EXPIRED: {
      label: 'Ασφάλεια ληγμένη',
      className: 'bg-rose-50 text-rose-800 border-rose-200',
    },
    INSURANCE_SOON: {
      label: 'Ασφάλεια σύντομα',
      className: 'bg-orange-50 text-orange-800 border-orange-200',
    },
  };
  return map[flag] || { label: flag, className: 'bg-slate-100 text-slate-600 border-slate-200' };
}

export default function RentAvailabilityPanel({ onOpenVehicles, onOpenWizard } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const reload = async () => {
    setLoading(true);
    try {
      setRows(await fetchRentalAvailabilityBoard());
    } catch (err) {
      toast.error(err.message || 'Αποτυχία διαθεσιμότητας');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const stats = useMemo(() => {
    const bookable = rows.filter((r) => r.bookable).length;
    const blocked = rows.filter((r) => !r.bookable).length;
    const alerts = rows.filter((r) =>
      (r.flags || []).some((f) => String(f).includes('EXPIRED') || String(f).includes('SOON')),
    ).length;
    return { bookable, blocked, alerts, total: rows.length };
  }, [rows]);

  const visible = useMemo(() => {
    if (filter === 'bookable') return rows.filter((r) => r.bookable);
    if (filter === 'blocked') return rows.filter((r) => !r.bookable);
    if (filter === 'alerts') {
      return rows.filter((r) =>
        (r.flags || []).some((f) => String(f).includes('EXPIRED') || String(f).includes('SOON')),
      );
    }
    return rows;
  }, [rows, filter]);

  return (
    <div className="space-y-5 pb-4">
      <div className="rounded-[28px] border border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm">
              <span className="material-symbols-outlined text-[22px]">event_available</span>
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Διαθεσιμότητα /rent</h2>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Ποια οχήματα είναι έτοιμα για κράτηση — με βάση κατάσταση, ΚΤΕΟ και ασφάλεια.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reload}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Ανανέωση
            </button>
            {onOpenWizard ? (
              <button
                type="button"
                onClick={onOpenWizard}
                className="rounded-full bg-teal-700 text-white px-3 py-2 text-xs font-bold hover:bg-teal-800"
              >
                Νέα κράτηση
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        {[
          { id: 'all', label: 'Σύνολο', value: stats.total, tone: 'text-slate-900' },
          { id: 'bookable', label: 'Έτοιμα', value: stats.bookable, tone: 'text-emerald-700' },
          { id: 'blocked', label: 'Μπλοκαρισμένα', value: stats.blocked, tone: 'text-rose-700' },
          { id: 'alerts', label: 'Ειδοποιήσεις', value: stats.alerts, tone: 'text-amber-700' },
        ].map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setFilter(card.id)}
            className={`rounded-[22px] border px-4 py-3 text-left transition ${
              filter === card.id
                ? 'border-teal-300 bg-white ring-2 ring-teal-100 shadow-sm'
                : 'border-slate-200/90 bg-white hover:border-teal-200'
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${card.tone}`}>{card.value}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-[24px] bg-slate-100" />
      ) : visible.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center text-sm text-slate-500">
          Δεν βρέθηκαν οχήματα σε αυτό το φίλτρο.
          {onOpenVehicles ? (
            <button
              type="button"
              onClick={onOpenVehicles}
              className="mt-3 block mx-auto text-teal-700 font-bold hover:underline"
            >
              Πρόσθεσε όχημα
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
          {visible.map((row) => {
            const photo = resolveSiteAssetUrl(row.photo_url);
            return (
              <li
                key={row.vehicle_id}
                className={`h-full flex flex-col rounded-[24px] border bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] ${
                  row.bookable ? 'border-emerald-200/80' : 'border-slate-200'
                }`}
              >
                <div className="flex gap-3">
                  <div className="h-16 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                    {photo ? (
                      <img src={photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined">directions_car</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{row.plate_number}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {row.model} · {rentCategoryLabel(row.category)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${
                          row.bookable
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {row.bookable ? 'Έτοιμο' : 'Όχι'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-600 mt-2">
                      {STATUS_LABEL[row.current_status] || row.current_status}
                      {row.active_bookings
                        ? ` · ${row.active_bookings} ενεργές κρατήσεις`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400">ΚΤΕΟ</p>
                    <p className="font-semibold text-slate-800 tabular-nums mt-0.5">
                      {row.legal_deadline || '—'}
                      {row.days_to_kteo != null ? (
                        <span
                          className={
                            row.days_to_kteo < 0
                              ? ' text-rose-600'
                              : row.days_to_kteo <= 30
                                ? ' text-amber-700'
                                : ' text-slate-500'
                          }
                        >
                          {' '}
                          ({row.days_to_kteo}η)
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Ασφάλεια</p>
                    <p className="font-semibold text-slate-800 tabular-nums mt-0.5">
                      {row.insurance_due_date || '—'}
                      {row.days_to_insurance != null ? (
                        <span
                          className={
                            row.days_to_insurance < 0
                              ? ' text-rose-600'
                              : row.days_to_insurance <= 30
                                ? ' text-amber-700'
                                : ' text-slate-500'
                          }
                        >
                          {' '}
                          ({row.days_to_insurance}η)
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>

                {(row.flags || []).length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {row.flags.map((f) => {
                      const chip = flagChip(f);
                      return (
                        <span
                          key={f}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${chip.className}`}
                        >
                          {chip.label}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-emerald-700 font-semibold">Χωρίς εκκρεμότητες</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
