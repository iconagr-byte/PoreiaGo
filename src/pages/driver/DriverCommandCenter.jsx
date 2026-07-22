import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import '../../styles/driver-app.css';
import { clearDriverSession, getDriverSession, isSessionValid } from '../../lib/driver/driverSession.js';
import { flushOfflineScanQueue } from '../../services/ticketingApi.js';
import { fetchDriverMe } from '../../services/driverPortalApi.js';
import MasterQrGate from '../../components/driver/MasterQrGate.jsx';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import DailyManifest from '../../components/driver/DailyManifest.jsx';
import Scanner from '../../components/driver/enterprise/Scanner.jsx';
import ExpenseUpload from '../../components/driver/enterprise/ExpenseUpload.jsx';
import PreTripForm from '../../components/driver/enterprise/PreTripForm.jsx';
import SOSButton from '../../components/driver/enterprise/SOSButton.jsx';
import TachographStrip from '../../components/driver/enterprise/TachographStrip.jsx';
import DaySummary from '../../components/driver/DaySummary.jsx';
import DriverShiftTelemetry from '../../components/driver/DriverShiftTelemetry.jsx';
import DriverPushPanel from '../../components/driver/DriverPushPanel.jsx';
import useTachograph from '../../hooks/useTachograph.js';
import { useDriverShiftSession } from '../../lib/driver/useDriverShiftSession.js';

const TABS = [
  { id: 'home', icon: 'home', label: 'Αρχική', short: 'Αρχ.' },
  { id: 'gps', icon: 'share_location', label: 'Θέση', short: 'GPS' },
  { id: 'scan', icon: 'qr_code_scanner', label: 'Scan', short: 'Scan' },
  { id: 'logs', icon: 'receipt_long', label: 'Έξοδα', short: 'Έξ.' },
  { id: 'sos', icon: 'emergency', label: 'SOS', short: 'SOS' },
  { id: 'summary', icon: 'summarize', label: 'Σύνοψη', short: 'Σύν.' },
];

function safetyComplete(tripId) {
  if (!tripId) return false;
  return !!localStorage.getItem(`safety_done_${tripId}`);
}

function driverInitials(name) {
  return (name || 'Ο')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function DriverHeader({ session, telemetryOnline, onLogout, kicker, title }) {
  const name = session?.driverName || 'Οδηγός';
  const plate = session?.vehiclePlate || session?.vehicleCode;
  const photoUrl = session?.photoUrl ? resolveSiteAssetUrl(session.photoUrl) : '';
  const busUrl = session?.vehicleImageUrl ? resolveSiteAssetUrl(session.vehicleImageUrl) : '';

  return (
    <header className="driver-header driver-shell flex justify-between items-center gap-3">
      <div className="driver-brand min-w-0">
        <div
          className="driver-header-avatars"
          aria-label={`${name}${plate ? ` · ${plate}` : ''}`}
        >
          {photoUrl ? (
            <img src={photoUrl} alt="" className="driver-avatar" />
          ) : (
            <div className="driver-avatar driver-avatar--initials" aria-hidden>
              {driverInitials(name)}
            </div>
          )}
          {busUrl ? (
            <img src={busUrl} alt="" className="driver-bus-thumb" />
          ) : (
            <div className="driver-bus-thumb" aria-hidden>
              <span className="material-symbols-outlined">directions_bus</span>
            </div>
          )}
        </div>
        <div className="driver-header-copy min-w-0">
          <p className="driver-header-kicker truncate">{kicker || name}</p>
          <p className="driver-header-title truncate">
            {title || plate || (session?.tripId ? `Βάρδια #${session.tripId}` : 'Βάρδια')}
          </p>
        </div>
      </div>
      <div className="driver-header-actions">
        <span
          className={`driver-live-badge ${telemetryOnline ? 'is-live' : 'is-offline'}`}
          title={telemetryOnline ? 'Ζωντανή μετάδοση GPS' : 'Εκτός σύνδεσης'}
          aria-live="polite"
        >
          {telemetryOnline ? 'LIVE' : 'Offline'}
        </span>
        <button type="button" onClick={onLogout} className="driver-header-btn shrink-0">
          {kicker === 'Pre-trip' ? 'Έξοδος' : 'Τέλος'}
        </button>
      </div>
    </header>
  );
}

const toastOptions = {
  duration: 3500,
  style: {
    background: '#ffffff',
    color: '#0f172a',
    fontSize: '0.9375rem',
    fontWeight: 600,
    border: '1px solid rgba(15,23,42,0.08)',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
  },
  success: {
    iconTheme: { primary: '#1d4ed8', secondary: '#ffffff' },
  },
};

export default function DriverCommandCenter() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [authenticated, setAuthenticated] = useState(isSessionValid());
  const [profileTick, setProfileTick] = useState(0);
  const tab = params.get('tab') || 'home';
  const session = useMemo(() => getDriverSession(), [authenticated, profileTick]);
  const tripId = session?.tripId;
  const [safetyOk, setSafetyOk] = useState(() => {
    const s = getDriverSession();
    return s?.tripId ? safetyComplete(s.tripId) : false;
  });

  const [onBreak, setOnBreak] = useState(false);
  const shift = useDriverShiftSession({
    driverName: session?.driverName || 'Οδηγός',
    enabled: authenticated && safetyOk,
  });
  const telemetryOnline = shift.online;
  // Duty clock starts only on GPS «Έναρξη βάρδιας», not on login / pre-trip.
  const tachograph = useTachograph({
    active: telemetryOnline,
    onBreak,
  });

  useEffect(() => {
    document.documentElement.classList.add('driver-route');
    let viewport = document.querySelector('meta[name="viewport"]');
    const prevContent = viewport?.getAttribute('content') || '';
    if (viewport) {
      viewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1',
      );
    }
    return () => {
      document.documentElement.classList.remove('driver-route');
      if (viewport && prevContent) {
        viewport.setAttribute('content', prevContent);
      }
    };
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/driver-sw.js').catch(() => {});
    }
    const manifest = document.querySelector('link[rel="manifest"][href*="driver-telemetry"]');
    if (!manifest) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/driver-telemetry-manifest.webmanifest';
      document.head.appendChild(link);
    }
    let theme = document.querySelector('meta[name="theme-color"]');
    if (!theme) {
      theme = document.createElement('meta');
      theme.name = 'theme-color';
      document.head.appendChild(theme);
    }
    theme.content = '#ffffff';
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      apple.href = '/icons/driver-pwa-192.png';
      document.head.appendChild(apple);
    }
    const iosMeta = [
      ['apple-mobile-web-app-capable', 'yes'],
      ['apple-mobile-web-app-status-bar-style', 'default'],
      ['apple-mobile-web-app-title', 'GPS Οδηγού'],
      ['format-detection', 'telephone=no'],
    ];
    iosMeta.forEach(([name, content]) => {
      if (!document.querySelector(`meta[name="${name}"]`)) {
        const meta = document.createElement('meta');
        meta.name = name;
        meta.content = content;
        document.head.appendChild(meta);
      }
    });
    document.documentElement.lang = 'el';
    flushOfflineScanQueue().catch(() => {});
  }, []);

  useEffect(() => {
    if (!authenticated) return undefined;
    let cancelled = false;
    fetchDriverMe().then(() => {
      if (!cancelled) setProfileTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  useEffect(() => {
    if (authenticated && tripId) {
      setSafetyOk(safetyComplete(tripId));
    }
  }, [authenticated, tripId]);

  useEffect(() => {
    if (tachograph.limitReached && telemetryOnline) {
      toast('Required Rest Stop in 15 minutes', { icon: '⏱️', duration: 8000 });
    }
  }, [tachograph.limitReached, telemetryOnline]);

  const setTab = (id) => {
    setParams({ tab: id });
  };

  const handlePreTripComplete = () => {
    setSafetyOk(true);
    setParams({ tab: 'gps' });
    toast('Ενεργοποιήστε το GPS για ζωντανή θέση στο χάρτη', { icon: '📍', duration: 5000 });
  };

  const logout = () => {
    toast.dismiss();
    shift.goOffline({ silent: true });
    clearDriverSession();
    setAuthenticated(false);
    setSafetyOk(false);
    navigate('/driver');
  };

  let body = null;
  if (!authenticated) {
    body = (
      <MasterQrGate
        onAuthenticated={() => {
          toast.dismiss();
          setAuthenticated(true);
          setProfileTick((n) => n + 1);
          window.setTimeout(() => {
            toast.success('Σύνδεση για τη σημερινή βάρδια', {
              id: 'driver-shift-login',
              duration: 2800,
            });
          }, 80);
        }}
      />
    );
  } else if (!safetyOk) {
    body = (
      <div className="driver-app">
        <DriverHeader
          session={session}
          telemetryOnline={telemetryOnline}
          onLogout={logout}
          kicker="Pre-trip"
          title="Έλεγχος ασφαλείας"
        />
        <div className="driver-shell driver-main">
          <PreTripForm onComplete={handlePreTripComplete} />
        </div>
      </div>
    );
  } else {
    body = (
      <div className="driver-app">
        <DriverHeader session={session} telemetryOnline={telemetryOnline} onLogout={logout} />

        <div className="driver-shell">
          <TachographStrip
            drivingLabel={tachograph.drivingLabel}
            limitReached={tachograph.limitReached}
            progressPct={tachograph.progressPct}
            isCounting={tachograph.isCounting}
            onBreak={onBreak}
          />

          <div className="driver-break-bar">
            <button
              type="button"
              onClick={() => {
                if (onBreak) {
                  setOnBreak(false);
                  tachograph.resetBreak();
                } else {
                  setOnBreak(true);
                }
              }}
              className={`driver-touch w-full rounded-xl font-bold border transition-colors ${
                onBreak
                  ? 'border-[var(--driver-success)] text-[var(--driver-success)] bg-green-50'
                  : 'border-[var(--driver-accent)]/40 text-[var(--driver-accent)] bg-[var(--driver-accent-soft)]'
              }`}
            >
              {onBreak ? 'Τέλος διαλείμματος' : 'Έναρξη διαλείμματος'}
            </button>
          </div>
        </div>

        <main className="driver-shell driver-main">
          {tab === 'home' && (
            <>
              <DriverPushPanel />
              <DailyManifest />
            </>
          )}
          {/* Keep GPS panel mounted so tab switches never remount shift UI. */}
          <div hidden={tab !== 'gps'} aria-hidden={tab !== 'gps'}>
            <DriverShiftTelemetry shift={shift} />
          </div>
          {tab === 'scan' && <Scanner />}
          {tab === 'logs' && <ExpenseUpload />}
          {tab === 'sos' && <SOSButton />}
          {tab === 'summary' && <DaySummary />}
        </main>

        <nav className="driver-nav" aria-label="Driver navigation">
          <div className="driver-nav-inner">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={tab === t.id ? 'active' : ''}
                onClick={() => setTab(t.id)}
                aria-label={t.label}
                aria-current={tab === t.id ? 'page' : undefined}
              >
                <span className="material-symbols-outlined">{t.icon}</span>
                <span className="driver-nav-label">
                  <span className="hidden min-[360px]:inline">{t.label}</span>
                  <span className="min-[360px]:hidden">{t.short}</span>
                </span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    );
  }

  return (
    <>
      {body}
      <Toaster
        position="bottom-center"
        containerClassName="driver-toast"
        toastOptions={toastOptions}
      />
    </>
  );
}
