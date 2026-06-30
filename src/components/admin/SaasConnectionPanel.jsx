import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  checkSaasHealth,
  createSaasApiKey,
  getSaasTenantId,
  getSaasToken,
  saasFetch,
} from '../../services/saasApi.js';
import { syncAllLocalTrips } from '../../services/tripsSyncApi.js';

export default function SaasConnectionPanel() {
  const [online, setOnline] = useState(null);
  const [bookingsCount, setBookingsCount] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tripSync, setTripSync] = useState(null);

  const token = getSaasToken();
  const tenantId = getSaasTenantId();

  useEffect(() => {
    checkSaasHealth().then(setOnline).catch(() => setOnline(false));
  }, []);

  useEffect(() => {
    if (!token) return;
    saasFetch('/api/v1/bookings')
      .then((rows) => setBookingsCount(Array.isArray(rows) ? rows.length : 0))
      .catch(() => setBookingsCount(null));
  }, [token]);

  const handleCreateTelemetryKey = async () => {
    setLoading(true);
    setNewKey(null);
    try {
      const res = await createSaasApiKey('GPS Frontend', 'telemetry');
      setNewKey(res.key);
      toast.success('Νέο telemetry API key');
    } catch (e) {
      toast.error(e.message || 'Αποτυχία δημιουργίας κλειδιού');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTrips = async () => {
    setLoading(true);
    setTripSync(null);
    try {
      const result = await syncAllLocalTrips();
      setTripSync(result);
      if (result.postgres_available) {
        toast.success(`Συγχρονίστηκαν ${result.synced} εκδρομές στη βάση`);
      } else {
        toast('Postgres μη διαθέσιμο — sync απέτυχε', { icon: '⚠️' });
      }
    } catch (e) {
      toast.error(e.message || 'Αποτυχία sync');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-[24px] border border-black/[0.06] p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-headline-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">cloud</span>
            SaaS API (PostgreSQL)
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">
            JWT multi-tenant backend — κρατήσεις, AADE, telemetry API keys.
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold ${
            online === true
              ? 'bg-emerald-100 text-emerald-800'
              : online === false
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-600'
          }`}
        >
          {online === true ? 'Online' : online === false ? 'Offline' : '…'}
        </span>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="bg-surface-container-low rounded-xl p-3">
          <dt className="text-on-surface-variant text-xs uppercase tracking-wide">JWT</dt>
          <dd className="font-mono text-xs mt-1 truncate">{token ? 'Ενεργό' : '— (κάντε Admin Login)'}</dd>
        </div>
        <div className="bg-surface-container-low rounded-xl p-3">
          <dt className="text-on-surface-variant text-xs uppercase tracking-wide">Tenant ID</dt>
          <dd className="font-mono text-xs mt-1 break-all">{tenantId || '—'}</dd>
        </div>
        <div className="bg-surface-container-low rounded-xl p-3">
          <dt className="text-on-surface-variant text-xs uppercase tracking-wide">Κρατήσεις (API)</dt>
          <dd className="font-bold mt-1">{bookingsCount ?? '—'}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={handleSyncTrips}
          className="px-5 py-2.5 border border-primary/30 text-primary rounded-full text-sm font-bold hover:bg-primary/5 disabled:opacity-50"
        >
          Συγχρονισμός εκδρομών → Postgres
        </button>
        {token && (
          <button
            type="button"
            disabled={loading}
            onClick={handleCreateTelemetryKey}
            className="px-5 py-2.5 bg-primary text-white rounded-full text-sm font-bold hover:opacity-90 disabled:opacity-50"
          >
            + Telemetry API Key
          </button>
        )}
      </div>

      {tripSync?.postgres_available && (
        <p className="text-xs text-emerald-700">
          Τελευταίο sync: {tripSync.synced} εκδρομές (tenant {tripSync.tenant_id?.slice(0, 8)}…)
        </p>
      )}

      {newKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-bold text-amber-900 mb-2">Αποθηκεύστε το κλειδί (εμφανίζεται μία φορά)</p>
          <code className="text-xs break-all select-all">{newKey}</code>
          <p className="text-xs text-amber-800 mt-2">Header: X-API-Key</p>
        </div>
      )}

      {!token && (
        <p className="text-xs text-on-surface-variant">
          Σύνδεση με <strong>admin@achillio.gr</strong> / <strong>Admin123!</strong> μετά από{' '}
          <code className="bg-gray-100 px-1 rounded">make seed</code>. Ορίστε{' '}
          <code className="bg-gray-100 px-1 rounded">VITE_SAAS_TENANT_ID</code> στο .env.
        </p>
      )}
    </div>
  );
}
