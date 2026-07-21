import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/AdminLayout.jsx';
import {
  createFleetDriver,
  fetchFleetDriver,
  updateFleetDriver,
  uploadDriverPhoto,
} from '../../services/platformApi.js';
import ImageDropField from '../../components/admin/ImageDropField.jsx';

const STATUS_LABELS = {
  active: 'Ενεργός',
  inactive: 'Ανενεργός',
  on_leave: 'Άδεια',
  suspended: 'Αναστολή',
};

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
  'mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 transition-colors focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15';

/**
 * Full-page create / edit driver + bus-app account.
 * Routes: /admin/drivers/new  |  /admin/drivers/:driverId/edit
 */
export default function DriverFormPage() {
  const { driverId } = useParams();
  const isEdit = Boolean(driverId);
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (role !== 'admin') {
      navigate('/admin/login');
      return;
    }
    if (!isEdit) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const d = await fetchFleetDriver(driverId);
      if (cancelled) return;
      if (!d) {
        toast.error('Δεν βρέθηκε ο οδηγός');
        navigate('/admin', { state: { activeTab: 'drivers' } });
        return;
      }
      setHasPassword(Boolean(d.has_password));
      setForm({
        name: d.name || '',
        license_no: d.license_no || '',
        phone: d.phone || '',
        email: d.email || '',
        status: d.status || 'active',
        vehicle_code: d.vehicle_code || '',
        license_plate: d.license_plate || '',
        salary_per_km: d.salary_per_km ?? 0.45,
        salary_per_trip: d.salary_per_trip ?? 25,
        hiring_date: d.hiring_date?.slice?.(0, 10) || d.hiring_date || '',
        license_expires_at: d.license_expires_at?.slice?.(0, 10) || d.license_expires_at || '',
        photo_url: d.photo_url || '',
        password: '',
        password_confirm: '',
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [driverId, isEdit, navigate]);

  const setField = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !form.password) {
      toast.error('Ορίστε κωδικό για την εφαρμογή λεωφορείου');
      return;
    }
    if (form.password || form.password_confirm) {
      if (form.password.length < 4) {
        toast.error('Ο κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες');
        return;
      }
      if (form.password !== form.password_confirm) {
        toast.error('Οι κωδικοί δεν ταιριάζουν');
        return;
      }
    }

    const body = {
      name: form.name.trim(),
      license_no: form.license_no.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      status: form.status,
      vehicle_code: form.vehicle_code.trim() || null,
      license_plate: form.license_plate.trim() || null,
      license_expires_at: form.license_expires_at || null,
      photo_url: form.photo_url.trim() || null,
      salary_per_km: Number(form.salary_per_km),
      salary_per_trip: Number(form.salary_per_trip),
      hiring_date: form.hiring_date || null,
    };
    if (form.password) body.password = form.password;

    setSaving(true);
    try {
      if (isEdit) {
        await updateFleetDriver(driverId, body);
        toast.success('Ο οδηγός ενημερώθηκε');
        navigate(`/admin/drivers/${driverId}`);
      } else {
        const created = await createFleetDriver(body);
        toast.success('Ο λογαριασμός δημιουργήθηκε');
        navigate(created?.id ? `/admin/drivers/${created.id}` : '/admin', {
          state: { activeTab: 'drivers' },
        });
      }
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <div className="flex items-center gap-3 w-full min-w-0">
      <button
        type="button"
        onClick={() =>
          isEdit
            ? navigate(`/admin/drivers/${driverId}`)
            : navigate('/admin', { state: { activeTab: 'drivers' } })
        }
        className="w-10 h-10 shrink-0 rounded-full bg-surface-container-low flex items-center justify-center hover:bg-surface-container-high transition-colors"
        aria-label="Επιστροφή"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </button>
      <h1 className="font-headline-md font-bold flex items-center gap-2 min-w-0 truncate">
        <span className="material-symbols-outlined text-primary shrink-0">
          {isEdit ? 'edit' : 'person_add'}
        </span>
        <span className="truncate">{isEdit ? 'Επεξεργασία οδηγού' : 'Νέος λογαριασμός οδηγού'}</span>
      </h1>
    </div>
  );

  if (loading) {
    return (
      <AdminLayout activeTab="drivers" title={header}>
        <p className="text-on-surface-variant">Φόρτωση…</p>
      </AdminLayout>
    );
  }

  const actions = (
    <div className="flex gap-3">
      <button
        type="submit"
        form="driver-account-form"
        disabled={saving}
        className="flex-1 sm:flex-none px-6 py-3.5 rounded-2xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-60"
      >
        {saving ? 'Αποθήκευση…' : isEdit ? 'Αποθήκευση' : 'Δημιουργία λογαριασμού'}
      </button>
      <Link
        to={isEdit ? `/admin/drivers/${driverId}` : '/admin'}
        state={isEdit ? undefined : { activeTab: 'drivers' }}
        className="px-5 py-3.5 rounded-2xl border border-gray-200 bg-white font-bold text-gray-700 hover:bg-gray-50 text-center"
      >
        Άκυρο
      </Link>
    </div>
  );

  return (
    <AdminLayout activeTab="drivers" title={header} footer={actions}>
      <form id="driver-account-form" onSubmit={onSubmit} className="max-w-3xl mx-auto space-y-5">
        {/* Credentials first — must be above the fold on mobile */}
        <section className="bg-sky-50 rounded-[24px] border border-sky-100 p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">smartphone</span>
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-base sm:text-lg text-sky-950">
                Λογαριασμός εφαρμογής λεωφορείου
              </h2>
              <p className="text-sm text-sky-900/75 mt-0.5 leading-snug">
                Με αυτά μπαίνει ο οδηγός στο{' '}
                <a href="/driver" target="_blank" rel="noreferrer" className="font-bold underline">
                  /driver
                </a>
                . Όνομα χρήστη = email. Κατάσταση: Ενεργός.
              </p>
              {isEdit && (
                <p className="text-xs font-bold mt-1.5 text-sky-800">
                  {hasPassword
                    ? '✓ Έχει ήδη κωδικό — συμπληρώστε μόνο αν θέλετε αλλαγή'
                    : '⚠ Χωρίς κωδικό — ορίστε έναν παρακάτω'}
                </p>
              )}
            </div>
          </div>

          <label className="block text-sm">
            <span className="font-bold text-gray-800">Email (όνομα χρήστη) *</span>
            <input
              required
              type="email"
              autoComplete="username"
              value={form.email}
              onChange={setField('email')}
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-1 gap-4">
            <label className="block text-sm">
              <span className="font-bold text-gray-800">
                Κωδικός εφαρμογής{!isEdit ? ' *' : ' (κενό = χωρίς αλλαγή)'}
              </span>
              <input
                type="password"
                autoComplete="new-password"
                required={!isEdit}
                minLength={4}
                placeholder="τουλάχιστον 4 χαρακτήρες"
                value={form.password}
                onChange={setField('password')}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-800">Επιβεβαίωση κωδικού</span>
              <input
                type="password"
                autoComplete="new-password"
                required={!isEdit || Boolean(form.password)}
                minLength={4}
                placeholder="Επαναλάβετε τον κωδικό"
                value={form.password_confirm}
                onChange={setField('password_confirm')}
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <section className="bg-white rounded-[24px] border border-black/[0.06] shadow-sm p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="font-bold text-base sm:text-lg text-gray-900">Στοιχεία οδηγού</h2>
            <p className="text-sm text-gray-500 mt-0.5">Προσωπικά στοιχεία και όχημα.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm sm:col-span-2">
              <span className="font-bold text-gray-700">Ονοματεπώνυμο *</span>
              <input required value={form.name} onChange={setField('name')} className={inputClass} />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Αρ. άδειας *</span>
              <input
                required
                value={form.license_no}
                onChange={setField('license_no')}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Τηλέφωνο</span>
              <input value={form.phone} onChange={setField('phone')} className={inputClass} />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Κωδικός οχήματος</span>
              <input
                value={form.vehicle_code}
                onChange={setField('vehicle_code')}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Πινακίδα</span>
              <input
                value={form.license_plate}
                onChange={setField('license_plate')}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Κατάσταση</span>
              <select value={form.status} onChange={setField('status')} className={inputClass}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-700">Έναρξη</span>
              <input
                type="date"
                value={form.hiring_date}
                onChange={setField('hiring_date')}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-700">€/km</span>
              <input
                type="number"
                step="0.01"
                value={form.salary_per_km}
                onChange={setField('salary_per_km')}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold text-gray-700">€/εκδρομή</span>
              <input
                type="number"
                step="0.01"
                value={form.salary_per_trip}
                onChange={setField('salary_per_trip')}
                className={inputClass}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-bold text-gray-700">Λήξη άδειας</span>
              <input
                type="date"
                value={form.license_expires_at}
                onChange={setField('license_expires_at')}
                className={inputClass}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <ImageDropField
                label="Φωτογραφία οδηγού"
                hint="Σύρετε φωτογραφία εδώ ή πατήστε για επιλογή"
                value={form.photo_url}
                onChange={(url) => setForm((p) => ({ ...p, photo_url: url }))}
                onUpload={uploadDriverPhoto}
                disabled={saving}
              />
            </label>
          </div>
        </section>
      </form>
    </AdminLayout>
  );
}
