import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createBackup,
  deleteBackup,
  downloadBackupFile,
  fetchBackups,
  restoreBackup,
} from '../../services/platformApi.js';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('el-GR');
  } catch {
    return iso;
  }
}

export default function BackupPanel() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setBackups(await fetchBackups());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onCreate = async () => {
    setWorking(true);
    try {
      const res = await createBackup();
      toast.success(res.message || 'Backup OK');
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  const onRestore = async (id) => {
    if (!window.confirm('Επαναφορά από αυτό το backup; Θα αντικατασταθούν ρυθμίσεις και χρήστες.')) return;
    setWorking(true);
    try {
      const res = await restoreBackup(id);
      toast.success(res.message);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Διαγραφή backup;')) return;
    try {
      await deleteBackup(id);
      toast.success('Διαγράφηκε');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[24px] border p-6 shadow-sm">
        <h4 className="font-bold text-lg flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-primary">backup</span>
          Δημιουργία Backup
        </h4>
        <p className="text-sm text-gray-500 mb-4">
          Εξαγωγή JSON: ρυθμίσεις πλατφόρμας, telematics, χρήστες, οδηγοί. Αποθηκεύεται στον server (
          <code className="text-xs bg-gray-100 px-1 rounded">data/backups/</code>).
        </p>
        <button
          type="button"
          disabled={working}
          onClick={onCreate}
          className="px-5 py-2.5 rounded-full bg-primary text-white font-bold text-sm disabled:opacity-50 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
          {working ? 'Δημιουργία…' : 'Νέο backup τώρα'}
        </button>
      </div>

      <div className="bg-white rounded-[24px] border overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b font-bold">Ιστορικό backups</div>
        {loading ? (
          <p className="p-8 text-center text-gray-400">Φόρτωση…</p>
        ) : backups.length === 0 ? (
          <p className="p-8 text-center text-gray-500 text-sm">Δεν υπάρχουν backups ακόμα.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {backups.map((b) => (
              <li key={b.id} className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-sm font-bold text-gray-900">{b.filename}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDate(b.created_at)} · {formatSize(b.size_bytes)} ·{' '}
                    {(b.includes || []).join(', ')}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => downloadBackupFile(b.id, b.filename)}
                    className="px-3 py-1.5 rounded-full border text-xs font-bold hover:bg-gray-50"
                  >
                    Λήψη
                  </button>
                  <button
                    type="button"
                    onClick={() => onRestore(b.id)}
                    className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold"
                  >
                    Επαναφορά
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(b.id)}
                    className="px-3 py-1.5 rounded-full text-rose-600 text-xs font-bold hover:underline"
                  >
                    Διαγραφή
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
