import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createPlatformUser,
  deletePlatformUser,
  fetchPlatformUsers,
  updatePlatformUser,
} from '../../services/platformApi.js';

const ROLE_LABELS = {
  admin: 'Διαχειριστής',
  driver: 'Οδηγός',
  agent: 'Πράκτορας',
  viewer: 'Μόνο ανάγνωση',
};

const ROLE_STYLES = {
  admin: 'bg-primary/10 text-primary',
  driver: 'bg-emerald-50 text-emerald-700',
  agent: 'bg-sky-50 text-sky-700',
  viewer: 'bg-gray-100 text-gray-600',
};

export default function UsersManagementPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ email: '', name: '', role: 'agent', password: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setUsers(await fetchPlatformUsers());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm({ email: '', name: '', role: 'agent', password: '' });
    setModal('create');
  };

  const openEdit = (u) => {
    setForm({ email: u.email, name: u.name, role: u.role, password: '', is_active: u.is_active });
    setModal({ type: 'edit', id: u.id });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modal === 'create') {
        await createPlatformUser(form);
        toast.success('Ο χρήστης δημιουργήθηκε');
      } else if (modal?.type === 'edit') {
        const patch = { name: form.name, role: form.role, is_active: form.is_active };
        if (form.password) patch.password = form.password;
        await updatePlatformUser(modal.id, patch);
        toast.success('Ο χρήστης ενημερώθηκε');
      }
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const onDelete = async (u) => {
    if (!window.confirm(`Διαγραφή ${u.email};`)) return;
    try {
      await deletePlatformUser(u.id);
      toast.success('Διαγράφηκε');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <p className="text-sm text-gray-500">
          Διαχείριση λογαριασμών admin, οδηγών και πρακτόρων.
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 rounded-full bg-primary text-white text-sm font-bold flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Νέος χρήστης
        </button>
      </div>

      <div className="bg-white rounded-[24px] border overflow-hidden shadow-sm">
        {loading ? (
          <p className="p-8 text-center text-gray-400">Φόρτωση…</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Χρήστης</th>
                <th className="px-4 py-3 text-left">Ρόλος</th>
                <th className="px-4 py-3 text-left">Κατάσταση</th>
                <th className="px-4 py-3 text-right">Ενέργειες</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-900">{u.name}</div>
                    <div className="text-gray-500 text-xs">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${ROLE_STYLES[u.role] || ROLE_STYLES.viewer}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <span className="text-emerald-600 font-bold text-xs">Ενεργός</span>
                    ) : (
                      <span className="text-gray-400 text-xs">Ανενεργός</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button type="button" onClick={() => openEdit(u)} className="text-primary font-bold text-xs hover:underline">
                      Επεξεργασία
                    </button>
                    <button type="button" onClick={() => onDelete(u)} className="text-rose-600 font-bold text-xs hover:underline">
                      Διαγραφή
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={onSubmit}
            className="bg-white rounded-[28px] p-8 w-full max-w-md shadow-2xl space-y-4"
          >
            <h3 className="font-bold text-xl">
              {modal === 'create' ? 'Νέος χρήστης' : 'Επεξεργασία χρήστη'}
            </h3>
            {modal === 'create' && (
              <label className="block text-sm">
                <span className="font-bold">Email</span>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                />
              </label>
            )}
            <label className="block text-sm">
              <span className="font-bold">Όνομα</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-bold">Ρόλος</span>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-bold">{modal === 'create' ? 'Κωδικός' : 'Νέος κωδικός (προαιρετικό)'}</span>
              <input
                type="password"
                minLength={6}
                required={modal === 'create'}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                className="mt-1 w-full rounded-xl border px-3 py-2"
              />
            </label>
            {modal?.type === 'edit' && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                <span className="font-bold">Ενεργός λογαριασμός</span>
              </label>
            )}
            <div className="flex gap-3 pt-2">
              <button type="submit" className="flex-1 py-2.5 rounded-full bg-primary text-white font-bold">
                Αποθήκευση
              </button>
              <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-full border font-bold">
                Άκυρο
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
