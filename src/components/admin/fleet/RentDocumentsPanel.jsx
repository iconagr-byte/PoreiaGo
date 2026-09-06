/**
 * Rent-scoped vehicle documents (registration / insurance / ΚΤΕΟ).
 */
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE } from '../../../config/api.js';
import { getSaasToken } from '../../../services/saasApi.js';
import {
  deleteRentalDocument,
  fetchRentalDocuments,
  fetchRentalVehicles,
  uploadRentalDocument,
} from '../../../services/fleetRentalApi.js';

const DOC_KINDS = [
  { id: 'registration', label: 'Άδεια κυκλοφορίας' },
  { id: 'insurance', label: 'Ασφάλεια' },
  { id: 'kteo', label: 'ΚΤΕΟ' },
  { id: 'other', label: 'Άλλο' },
];

function kindLabel(id) {
  return DOC_KINDS.find((k) => k.id === id)?.label || id;
}

function openDoc(url) {
  if (!url) return;
  const abs = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const token = getSaasToken();
  // Admin file endpoint needs auth — open via fetch blob when same-origin API.
  if (!token) {
    window.open(abs, '_blank', 'noopener,noreferrer');
    return;
  }
  fetch(abs, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => {
      if (!res.ok) throw new Error('Αποτυχία ανοίγματος');
      return res.blob();
    })
    .then((blob) => {
      const href = URL.createObjectURL(blob);
      window.open(href, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
    })
    .catch((err) => toast.error(err.message || 'Αποτυχία ανοίγματος'));
}

export default function RentDocumentsPanel() {
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
      const [d, v] = await Promise.all([fetchRentalDocuments(), fetchRentalVehicles()]);
      setDocs(d);
      setVehicles(v);
      setVehicleId((cur) => cur || v[0]?.id || '');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία εγγράφων');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const onUpload = async (e) => {
    e.preventDefault();
    if (!vehicleId || !file) {
      toast.error('Επίλεξε όχημα και αρχείο');
      return;
    }
    setSaving(true);
    try {
      await uploadRentalDocument(vehicleId, file, {
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
      await deleteRentalDocument(doc.vehicle_id, doc.id);
      toast.success('Διαγράφηκε');
      await reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <div className="rounded-[28px] border border-teal-200/70 bg-gradient-to-br from-teal-50/80 via-white to-sky-50/40 px-5 py-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-sm">
            <span className="material-symbols-outlined text-[22px]">folder_managed</span>
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Έγγραφα οχημάτων /rent</h2>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Άδειες, ασφάλειες και ΚΤΕΟ για τον στόλο ενοικίασης — ξεχωριστά από τα λεωφορεία.
              Η λήξη ΚΤΕΟ/ασφάλειας ενημερώνει αυτόματα τις ημερομηνίες του οχήματος.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={onUpload}
        className="bg-white rounded-[28px] border border-slate-200/90 shadow-[0_8px_24px_rgba(15,23,42,0.04)] p-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
      >
        <label className="text-sm font-bold text-slate-700">
          Όχημα
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate_number} · {v.model}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">
          Τύπος
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
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
        <label className="text-sm font-bold text-slate-700">
          Λήξη
          <input
            type="date"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </label>
        <label className="text-sm font-bold text-slate-700">
          Αρχείο
          <input
            type="file"
            accept=".pdf,image/*"
            className="mt-1 w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <button
          type="submit"
          disabled={saving || !vehicles.length}
          className="rounded-full bg-teal-700 text-white px-4 py-2.5 text-sm font-bold hover:bg-teal-800 disabled:opacity-50"
        >
          {saving ? 'Ανέβασμα…' : 'Αποθήκευση'}
        </button>
      </form>

      {loading ? (
        <div className="h-32 animate-pulse rounded-[24px] bg-slate-100" />
      ) : docs.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center text-sm text-slate-500">
          Δεν υπάρχουν ακόμα έγγραφα — ανέβασε άδεια, ασφάλεια ή ΚΤΕΟ.
        </div>
      ) : (
        <ul className="grid gap-3">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm"
            >
              <div className="min-w-0 flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <span className="material-symbols-outlined text-[20px]">description</span>
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{doc.file_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {doc.plate_number} · {doc.model} · {kindLabel(doc.kind)}
                    {doc.expires_at ? ` · λήξη ${doc.expires_at}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openDoc(doc.url)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Άνοιγμα
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(doc)}
                  className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                >
                  Διαγραφή
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
