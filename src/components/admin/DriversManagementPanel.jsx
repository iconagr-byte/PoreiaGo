import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  createFleetDriver,
  deleteFleetDriver,
  fetchFleetDrivers,
  updateFleetDriver,
} from '../../services/platformApi.js';

const STATUS_LABELS = {
  active: 'Ενεργός',
  inactive: 'Ανενεργός',
  on_leave: 'Άδεια',
  suspended: 'Αναστολή',
};

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  inactive: 'bg-gray-100 text-gray-600 ring-gray-200',
  on_leave: 'bg-amber-50 text-amber-800 ring-amber-100',
  suspended: 'bg-rose-50 text-rose-700 ring-rose-100',
};

const FIELD_LABELS = {
  name: 'Ονοματεπώνυμο',
  license_no: 'Αρ. άδειας',
  email: 'Email (όνομα χρήστη εφαρμογής)',
  phone: 'Τηλέφωνο',
  vehicle_code: 'Κωδικός οχήματος',
  license_plate: 'Πινακίδα',
};

function safetyMeta(score) {
  if (score >= 90) return { text: 'text-emerald-600', bar: 'bg-emerald-500', bg: 'bg-emerald-50' };
  if (score >= 75) return { text: 'text-amber-600', bar: 'bg-amber-500', bg: 'bg-amber-50' };
  return { text: 'text-rose-600', bar: 'bg-rose-500', bg: 'bg-rose-50' };
}

function driverInitials(name) {
  return (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const emptyForm = {
  name: '',
  license_no: '',
  phone: '',
  email: '',
  status: 'active',
  vehicle_code: '',
  license_plate: '',
  salary_per_km: 0.45,
  salary_per_trip: 25,
  hiring_date: new Date().toISOString().slice(0, 10),
  license_expires_at: '',
  photo_url: '',
  password: '',
  password_confirm: '',
};

const inputClass =
  'mt-1 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2.5 transition-colors focus:bg-white focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15';

export default function DriversManagementPanel() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState(null); // create | edit | account
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => {
    const active = drivers.filter((d) => d.status === 'active').length;
    const withApp = drivers.filter((d) => d.has_password).length;
    const avgSafety =
      drivers.length > 0
        ? Math.round(drivers.reduce((s, d) => s + (d.safety_score || 0), 0) / drivers.length)
        : null;
    return { total: drivers.length, active, withApp, avgSafety };
  }, [drivers]);

  const openDriverProfile = (d) => {
    navigate(`/admin/drivers/${d.id}`);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await fetchFleetDrivers(filter || undefined);
    setDrivers(rows);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm({ ...emptyForm, password: '', password_confirm: '' });
    setModal('create');
    setSelected(null);
  };

  const openEdit = (d) => {
    setSelected(d);
    setForm({
      name: d.name,
      license_no: d.license_no,
      phone: d.phone || '',
      email: d.email,
      status: d.status,
      vehicle_code: d.vehicle_code || '',
      license_plate: d.license_plate || '',
      salary_per_km: d.salary_per_km,
      salary_per_trip: d.salary_per_trip,
      hiring_date: d.hiring_date?.slice?.(0, 10) || d.hiring_date,
      license_expires_at: d.license_expires_at?.slice?.(0, 10) || d.license_expires_at || '',
      photo_url: d.photo_url || '',
      password: '',
      password_confirm: '',
    });
    setModal('edit');
  };

  const openAccount = (d) => {
    setSelected(d);
    setForm({
      ...emptyForm,
      email: d.email,
      photo_url: d.photo_url || '',
      password: '',
      password_confirm: '',
    });
    setModal('account');
  };

  const buildBody = () => {
    const body = {
      name: form.name,
      license_no: form.license_no,
      phone: form.phone,
      email: form.email,
      status: form.status,
      vehicle_code: form.vehicle_code || null,
      license_plate: form.license_plate || null,
      license_expires_at: form.license_expires_at || null,
      photo_url: form.photo_url?.trim() || null,
      salary_per_km: Number(form.salary_per_km),
      salary_per_trip: Number(form.salary_per_trip),
      hiring_date: form.hiring_date || null,
    };
    if (form.password) {
      body.password = form.password;
    }
    return body;
  };

  const validatePasswords = () => {
    if (modal === 'create' && !form.password) {
      toast.error('Ορίστε κωδικό για την εφαρμογή λεωφορείου');
      return false;
    }
    if (modal === 'account' && !form.password) {
      toast.error('Ορίστε νέο κωδικό');
      return false;
    }
    if (form.password || form.password_confirm) {
      if (form.password.length < 4) {
        toast.error('Ο κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες');
        return false;
      }
      if (form.password !== form.password_confirm) {
        toast.error('Οι κωδικοί δεν ταιριάζουν');
        return false;
      }
    }
    return true;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validatePasswords()) return;
    setSaving(true);
    try {
      if (modal === 'account' && selected) {
        const patch = {
          photo_url: form.photo_url?.trim() || null,
          password: form.password,
        };
        await updateFleetDriver(selected.id, patch);
        toast.success('Ο λογαριασμός εφαρμογής ενημερώθηκε');
      } else if (modal === 'create') {
        await createFleetDriver(buildBody());
        toast.success('Ο οδηγός και ο λογαριασμός εφαρμογής δημιουργήθηκαν');
      } else if (selected) {
        await updateFleetDriver(selected.id, buildBody());
        toast.success('Ο οδηγός ενημερώθηκε');
      }
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (d) => {
    if (!window.confirm(`Διαγραφή οδηγού ${d.name}; Θα χαθεί και ο λογαριασμός εφαρμογής.`)) return;
    try {
      await deleteFleetDriver(d.id);
      toast.success('Διαγράφηκε');
      if (selected?.id === d.id) setSelected(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const renderVehicle = (d) => {
    const plate = d.license_plate?.trim();
    const code = d.vehicle_code?.trim();
    if (!plate && !code) return <span className="text-gray-300">—</span>;
    const showCode = code && code !== plate;
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-500">
          <span className="material-symbols-outlined text-[18px]">directions_bus</span>
        </span>
        <div>
          <div className="font-mono font-bold text-gray-800 text-sm tracking-wide">
            {plate || code}
          </div>
          {showCode && <div className="text-xs text-gray-400">{code}</div>}
        </div>
      </div>
    );
  };

  const renderAppAccount = (d) => {
    if (d.has_password) {
      return (
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
            <span className="material-symbols-outlined text-[14px]">smartphone</span>
            Έτοιμος
          </span>
          <div className="text-[11px] text-gray-400 mt-1 truncate font-mono" title={d.email}>
            {d.email}
          </div>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openAccount(d);
        }}
        className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-100 hover:bg-amber-100 transition-colors"
        title="Ορισμός κωδικού εφαρμογής"
      >
        <span className="material-symbols-outlined text-[14px]">key</span>
        Χωρίς κωδικό
      </button>
    );
  };

  const modalTitle =
    modal === 'create'
      ? 'Νέος οδηγός + λογαριασμός εφαρμογής'
      : modal === 'account'
        ? 'Λογαριασμός εφαρμογής λεωφορείου'
        : 'Επεξεργασία οδηγού';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h3 className="font-bold text-gray-900 text-lg tracking-tight">Οδηγοί & λογαριασμοί εφαρμογής</h3>
          <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
            Καταχωρήστε οδηγούς και ορίστε όνομα χρήστη / κωδικό για είσοδο στην εφαρμογή λεωφορείου
            (<span className="font-mono text-gray-700"> /driver</span>). Το email ή ο αριθμός άδειας
            χρησιμοποιείται ως όνομα χρήστη.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/driver"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            Άνοιγμα εφαρμογής
          </a>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/15"
          >
            <option value="">Όλοι</option>
            <option value="active">Ενεργοί</option>
            <option value="on_leave">Άδεια</option>
            <option value="inactive">Ανενεργοί</option>
          </select>
          <button
            type="button"
            onClick={openCreate}
            className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-primary/20 hover:bg-primary/90 hover:shadow-lg transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Νέος λογαριασμός
          </button>
        </div>
      </div>

      {!loading && drivers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Σύνολο', value: stats.total, icon: 'groups', color: 'text-primary bg-primary/10' },
            { label: 'Ενεργοί', value: stats.active, icon: 'check_circle', color: 'text-emerald-600 bg-emerald-50' },
            {
              label: 'Με λογαριασμό app',
              value: stats.withApp,
              icon: 'smartphone',
              color: 'text-sky-600 bg-sky-50',
            },
            {
              label: 'Μέσο Safety',
              value: stats.avgSafety != null ? `${stats.avgSafety}/100` : '—',
              icon: 'shield',
              color: 'text-indigo-600 bg-indigo-50',
            },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-2xl border border-black/[0.05] bg-white px-4 py-3 shadow-sm"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                <span className="material-symbols-outlined text-[20px]">{s.icon}</span>
              </div>
              <div>
                <div className="text-xs text-gray-400 font-medium">{s.label}</div>
                <div className="font-bold text-gray-900 text-lg leading-tight">{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-[24px] border border-black/[0.06] overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded-lg w-40" />
                  <div className="h-3 bg-gray-50 rounded-lg w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : drivers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-gray-300 text-[32px]">badge</span>
            </div>
            <p className="font-bold text-gray-700">Δεν βρέθηκαν οδηγοί</p>
            <p className="text-sm text-gray-400 mt-1">
              Δημιουργήστε τον πρώτο λογαριασμό για την εφαρμογή λεωφορείου.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-5 px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Νέος λογαριασμός
            </button>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                {['Οδηγός', 'Όχημα', 'Εφαρμογή', 'Safety', 'Κατάσταση', ''].map((h, i) => (
                  <th
                    key={h || 'actions'}
                    className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-gray-400 ${
                      i === 5 ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {drivers.map((d) => {
                const safety = safetyMeta(d.safety_score);
                return (
                  <tr
                    key={d.id}
                    onClick={() => openDriverProfile(d)}
                    className="cursor-pointer hover:bg-primary/[0.03] transition-colors group"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {d.photo_url ? (
                          <img
                            src={d.photo_url}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-1 ring-black/5"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/15 to-indigo-100 text-primary font-bold text-sm flex items-center justify-center flex-shrink-0 group-hover:from-primary/25 transition-colors">
                            {driverInitials(d.name)}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDriverProfile(d);
                          }}
                          className="text-left min-w-0"
                        >
                          <div className="font-bold text-gray-900 group-hover:text-primary transition-colors truncate">
                            {d.name}
                          </div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">{d.license_no}</div>
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4">{renderVehicle(d)}</td>
                    <td className="px-5 py-4">{renderAppAccount(d)}</td>
                    <td className="px-5 py-4">
                      <div className={`inline-flex flex-col gap-1.5 min-w-[88px] rounded-xl px-3 py-2 ${safety.bg}`}>
                        <span className={`font-bold text-sm ${safety.text}`}>{d.safety_score}/100</span>
                        <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${safety.bar} transition-all`}
                            style={{ width: `${Math.min(100, d.safety_score)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full ring-1 ${
                          STATUS_STYLES[d.status] || STATUS_STYLES.inactive
                        }`}
                      >
                        {STATUS_LABELS[d.status] || d.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAccount(d);
                          }}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-sky-600 hover:bg-sky-50 transition-colors"
                          title="Λογαριασμός εφαρμογής"
                        >
                          <span className="material-symbols-outlined text-[18px]">key</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(d);
                          }}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
                          title="Επεξεργασία"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(d);
                          }}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Διαγραφή"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && drivers.length > 0 && (
          <p className="text-xs text-gray-400 px-5 py-3.5 border-t border-gray-50 bg-gray-50/50 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">info</span>
            Κλειδί = κωδικός εφαρμογής λεωφορείου · Μολύβι = πλήρη στοιχεία οδηγού.
          </p>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={onSubmit}
            className="bg-white rounded-[28px] p-8 w-full max-w-lg shadow-2xl space-y-3 my-8"
          >
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">
                  {modal === 'account' ? 'smartphone' : 'badge'}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-xl">{modalTitle}</h3>
                {modal === 'account' && selected && (
                  <p className="text-sm text-gray-500">{selected.name}</p>
                )}
              </div>
            </div>

            {modal !== 'account' && (
              <>
                {['name', 'license_no', 'email', 'phone', 'vehicle_code', 'license_plate'].map((key) => (
                  <label key={key} className="block text-sm">
                    <span className="font-bold text-gray-600">{FIELD_LABELS[key]}</span>
                    <input
                      required={['name', 'license_no', 'email'].includes(key)}
                      type={key === 'email' ? 'email' : 'text'}
                      value={form[key]}
                      onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                      className={inputClass}
                      autoComplete={key === 'email' ? 'username' : 'off'}
                    />
                  </label>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="font-bold text-gray-600">Κατάσταση</span>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                      className={inputClass}
                    >
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="font-bold text-gray-600">Έναρξη</span>
                    <input
                      type="date"
                      value={form.hiring_date}
                      onChange={(e) => setForm((p) => ({ ...p, hiring_date: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="font-bold text-gray-600">€/km</span>
                    <input
                      type="number"
                      step="0.01"
                      value={form.salary_per_km}
                      onChange={(e) => setForm((p) => ({ ...p, salary_per_km: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-bold text-gray-600">€/εκδρομή</span>
                    <input
                      type="number"
                      step="0.01"
                      value={form.salary_per_trip}
                      onChange={(e) => setForm((p) => ({ ...p, salary_per_trip: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="font-bold text-gray-600">Λήξη άδειας</span>
                  <input
                    type="date"
                    value={form.license_expires_at}
                    onChange={(e) => setForm((p) => ({ ...p, license_expires_at: e.target.value }))}
                    className={inputClass}
                  />
                </label>
              </>
            )}

            <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 space-y-3 mt-2">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-sky-600 text-[22px]">smartphone</span>
                <div>
                  <p className="font-bold text-sky-900 text-sm">Λογαριασμός εφαρμογής λεωφορείου</p>
                  <p className="text-xs text-sky-800/80 mt-0.5 leading-relaxed">
                    {modal === 'account'
                      ? 'Ορίστε ή αλλάξτε τον κωδικό εισόδου στο /driver.'
                      : 'Με αυτά τα στοιχεία μπαίνει ο οδηγός στην εφαρμογή στο λεωφορείο.'}
                  </p>
                </div>
              </div>

              {(modal === 'account' || modal === 'edit') && (
                <div className="rounded-xl bg-white/80 border border-sky-100 px-3 py-2 text-xs text-sky-900">
                  <span className="font-bold">Όνομα χρήστη:</span>{' '}
                  <span className="font-mono">{form.email || selected?.email}</span>
                  <span className="text-sky-700/70"> · ή αρ. άδειας / πινακίδα</span>
                </div>
              )}

              <label className="block text-sm">
                <span className="font-bold text-gray-700">
                  Κωδικός εφαρμογής
                  {modal === 'edit' ? ' (κενό = χωρίς αλλαγή)' : ''}
                  {modal === 'create' || modal === 'account' ? ' *' : ''}
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required={modal === 'create' || modal === 'account'}
                  minLength={4}
                  placeholder={modal === 'edit' ? 'Αφήστε κενό για να μείνει ίδιος' : 'τουλάχιστον 4 χαρακτήρες'}
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm">
                <span className="font-bold text-gray-700">Επιβεβαίωση κωδικού</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required={Boolean(form.password) || modal === 'create' || modal === 'account'}
                  minLength={4}
                  placeholder="Επαναλάβετε τον κωδικό"
                  value={form.password_confirm}
                  onChange={(e) => setForm((p) => ({ ...p, password_confirm: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="block text-sm">
                <span className="font-bold text-gray-700">Φωτογραφία οδηγού (URL)</span>
                <input
                  type="url"
                  placeholder="https://… (εμφανίζεται στο header της εφαρμογής)"
                  value={form.photo_url}
                  onChange={(e) => setForm((p) => ({ ...p, photo_url: e.target.value }))}
                  className={inputClass}
                />
              </label>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-full bg-primary text-white font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saving ? 'Αποθήκευση…' : modal === 'account' ? 'Αποθήκευση κωδικού' : 'Αποθήκευση'}
              </button>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-full border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Άκυρο
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
