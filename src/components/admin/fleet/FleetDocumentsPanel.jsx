import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  deleteFleetDocument,
  fetchFleetDocuments,
  fetchFleetVehicles,
  uploadFleetDocument,
} from '../../../services/platformApi.js';

const DOC_KINDS = [
  { id: 'registration', label: 'Άδεια κυκλοφορίας' },
  { id: 'insurance', label: 'Ασφάλεια' },
  { id: 'kteo', label: 'ΚΤΕΟ' },
  { id: 'other', label: 'Άλλο' },
];

export default function FleetDocumentsPanel() {
  const [docs, setDocs] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vehicleId, setVehicleId] = useState('');
  const [kind, setKind] = useState('registration');
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [d, v] = await Promise.all([fetchFleetDocuments(), fetchFleetVehicles()]);
      setDocs(d);
      setVehicles(v);
      if (!vehicleId && v[0]) setVehicleId(v[0].id);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία εγγράφων');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUpload = async (e) => {
    e.preventDefault();
    if (!vehicleId || !file) {
      toast.error('Επίλεξε όχημα και αρχείο');
      return;
    }
    setSaving(true);
    try {
      await uploadFleetDocument(vehicleId, file, {
        kind,
        expiresAt: expiresAt || undefined,
      });
      toast.success('Το έγγραφο αποθηκεύτηκε');
      setFile(null);
      setExpiresAt('');
      await reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (doc) => {
    if (!window.confirm(`Διαγραφή «${doc.file_name}»;`)) return;
    try {
      await deleteFleetDocument(doc.vehicle_id, doc.id);
      toast.success('Διαγράφηκε');
      await reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Έγγραφα οχημάτων</h2>
        <p className="text-sm text-gray-500 mt-1">Άδειες, ασφάλειες, ΚΤΕΟ και άλλα PDF/εικόνες.</p>
      </div>

      <form
        onSubmit={onUpload}
        className="bg-white rounded-[28px] border p-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
      >
        <label className="text-sm font-bold text-gray-700">
          Όχημα
          <select
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate_number} · {v.make} {v.model}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-gray-700">
          Τύπος
          <select
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {DOC_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-gray-700">
          Λήξη
          <input
            type="date"
            className="mt-1 w-full rounded-xl border px-3 py-2"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </label>
        <label className="text-sm font-bold text-gray-700">
          Αρχείο
          <input
            type="file"
            className="mt-1 w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <button
          type="submit"
          disabled={saving || !vehicles.length}
          className="px-4 py-2.5 rounded-full bg-gray-900 text-white text-sm font-bold disabled:opacity-50"
        >
          {saving ? 'Ανέβασμα…' : 'Ανέβασμα'}
        </button>
      </form>

      {loading && <p className="text-sm text-gray-500">Φόρτωση…</p>}

      <div className="bg-white rounded-[28px] border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Όχημα</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Έγγραφο</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Λήξη</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {docs.map((d) => (
              <tr key={d.id}>
                <td className="px-5 py-3">
                  <div className="font-bold text-sm">{d.vehicle_name}</div>
                  <div className="text-xs font-mono text-gray-500">{d.plate_number}</div>
                </td>
                <td className="px-5 py-3">
                  <div className="text-sm font-bold capitalize">{d.kind}</div>
                  <div className="text-xs text-gray-500">{d.file_name}</div>
                </td>
                <td className="px-5 py-3 text-sm">{d.expires_at || '—'}</td>
                <td className="px-5 py-3 text-right space-x-2">
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Άνοιγμα
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(d)}
                    className="text-xs font-bold text-rose-600 hover:underline"
                  >
                    Διαγραφή
                  </button>
                </td>
              </tr>
            ))}
            {!loading && docs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-gray-500">
                  Δεν υπάρχουν ανεβασμένα έγγραφα ακόμα.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
