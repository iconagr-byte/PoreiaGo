import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  downloadJsonExport,
  fetchAuditLogs,
  gdprEraseSubject,
  gdprExportSubject,
} from '../../services/complianceApi.js';
import { getSaasToken } from '../../services/saasApi.js';

const ACTION_ICONS = {
  create: 'add_circle',
  update: 'edit',
  delete: 'delete',
  export: 'download',
  erase: 'person_off',
};

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR');
  } catch {
    return iso;
  }
}

export default function GdprCompliancePanel() {
  const [email, setEmail] = useState('');
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [actionFilter, setActionFilter] = useState('');

  const loadLogs = useCallback(async () => {
    if (!getSaasToken()) {
      setLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAuditLogs({
        limit: 50,
        action: actionFilter || undefined,
      });
      setLogs(data.items || []);
      setTotal(data.total ?? 0);
    } catch (e) {
      toast.error(e.message || 'Αποτυχία audit log');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const onExport = async () => {
    if (!email.trim()) {
      toast.error('Εισάγετε email υποκειμένου');
      return;
    }
    setWorking(true);
    try {
      const data = await gdprExportSubject(email);
      downloadJsonExport(data, `gdpr-export-${email.trim().replace(/@/g, '_')}.json`);
      toast.success('Εξαγωγή ολοκληρώθηκε — κατέβηκε JSON');
      loadLogs();
    } catch (e) {
      toast.error(e.message || 'Export απέτυχε');
    } finally {
      setWorking(false);
    }
  };

  const onErase = async () => {
    if (!email.trim()) {
      toast.error('Εισάγετε email υποκειμένου');
      return;
    }
    if (
      !window.confirm(
        `Οριστική διαγραφή/ανωνυμοποίηση δεδομένων για ${email};\n\nΑυτή η ενέργεια δεν αναιρείται.`,
      )
    ) {
      return;
    }
    setWorking(true);
    try {
      const result = await gdprEraseSubject(email);
      toast.success(
        `Erasure: ${result.bookings_anonymized} κρατήσεις` +
          (result.notification_sent ? ' · email εστάλη' : ''),
      );
      loadLogs();
    } catch (e) {
      toast.error(e.message || 'Erasure απέτυχε');
    } finally {
      setWorking(false);
    }
  };

  if (!getSaasToken()) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-[24px] p-6 text-sm text-amber-900">
        Απαιτείται JWT SaaS login για GDPR & audit.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-[24px] border border-black/[0.06] p-6 shadow-sm">
        <h3 className="font-headline-sm font-bold text-on-surface flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-primary">shield</span>
          GDPR — Export & Erasure
        </h3>
        <p className="text-sm text-on-surface-variant mb-6">
          Art. 15 εξαγωγή · Art. 17 ανωνυμοποίηση · email επιβεβαίωση στον πελάτη (αν SMTP ρυθμισμένο)
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email υποκειμένου (π.χ. john@example.com)"
            className="flex-1 px-4 py-3 rounded-2xl bg-surface-container-low border-0 text-sm"
          />
          <button
            type="button"
            disabled={working}
            onClick={onExport}
            className="px-5 py-3 bg-primary text-white rounded-full text-sm font-bold disabled:opacity-50"
          >
            Export JSON
          </button>
          <button
            type="button"
            disabled={working}
            onClick={onErase}
            className="px-5 py-3 bg-rose-600 text-white rounded-full text-sm font-bold disabled:opacity-50"
          >
            Erase PII
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[24px] border border-black/[0.06] p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">history</span>
              Audit Trail
            </h3>
            <p className="text-xs text-gray-500 mt-1">{total} συνολικά events</p>
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border text-sm bg-surface-container-low"
          >
            <option value="">Όλες οι ενέργειες</option>
            <option value="create">create</option>
            <option value="update">update</option>
            <option value="delete">delete</option>
            <option value="export">export</option>
            <option value="erase">erase</option>
          </select>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">Δεν υπάρχουν audit entries.</p>
        ) : (
          <ul className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
            {logs.map((row) => (
              <li key={row.id} className="py-3 flex gap-3 text-sm">
                <span className="material-symbols-outlined text-[20px] text-gray-400 shrink-0">
                  {ACTION_ICONS[row.action] || 'info'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-on-surface">{row.action}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-on-surface-variant">
                      {row.resource_type}/{String(row.resource_id).slice(0, 20)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatWhen(row.created_at)}
                    {row.actor_email ? ` · ${row.actor_email}` : ''}
                    {row.detail ? ` · ${row.detail}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
