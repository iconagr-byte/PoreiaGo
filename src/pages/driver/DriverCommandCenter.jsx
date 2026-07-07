import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import '../../styles/driver-app.css';
import { clearDriverSession, getDriverSession, isSessionValid } from '../../lib/driver/driverSession.js';
import { flushOfflineScanQueue } from '../../services/ticketingApi.js';
import MasterQrGate from '../../components/driver/MasterQrGate.jsx';
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

export default function DriverCommandCenter() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [authenticated, setAuthenticated] = useState(isSessionValid());
  const [safetyOk, setSafetyOk] = useState(false);
  const tab = params.get('tab') || 'home';

  const [onBreak, setOnBreak] = useState(false);
  const [telemetryOnline, setTelemetryOnline] = useState(
    () => localStorage.getItem('driver_shift_online') === '1',
  );
  const tachograph = useTachograph({ online: telemetryOnline, onBreak });

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
    if (!document.querySelector('meta[name="theme-color"]')) {
      const theme = document.createElement('meta');
      theme.name = 'theme-color';
      theme.content = '#facc15';
      document.head.appendChild(theme);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      apple.href = '/icons/driver-pwa-192.png';
      document.head.appendChild(apple);
    }
    const iosMeta = [
      ['apple-mobile-web-app-capable', 'yes'],
      ['apple-mobile-web-app-status-bar-style', 'black-translucent'],
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
    const onShift = (e) => setTelemetryOnline(!!e.detail?.online);
    window.addEventListener('driver-shift-online', onShift);
    return () => window.removeEventListener('driver-shift-online', onShift);
  }, []);

  const session = getDriverSession();
  const tripId = session?.tripId;

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
    clearDriverSession();
    setAuthenticated(false);
    setSafetyOk(false);
    navigate('/driver');
  };

  if (!authenticated) {
    return (
      <>
        <MasterQrGate
          onAuthenticated={() => {
            setAuthenticated(true);
            toast.success('Σύνδεση για τη σημερινή βάρδια');
          }}
        />
        <Toaster position="bottom-center" containerClassName="driver-toast" />
      </>
    );
  }

  if (!safetyOk) {
    return (
      <div className="driver-app">
        <header className="driver-header driver-shell flex justify-between items-center gap-3">
          <div className="driver-brand">
            <div className="driver-brand-icon">
              <span className="material-symbols-outlined text-[22px]">directions_bus</span>
            </div>
            <div className="min-w-0">
              <p className="driver-header-kicker">Pre-trip</p>
              <p className="driver-header-title">Έλεγχος ασφαλείας</p>
            </div>
          </div>
          <button type="button" onClick={logout} className="driver-header-btn">
            Έξοδος
          </button>
        </header>
        <div className="driver-shell driver-main">
          <PreTripForm onComplete={handlePreTripComplete} />
        </div>
        <Toaster position="bottom-center" containerClassName="driver-toast" />
      </div>
    );
  }

  return (
    <div className="driver-app">
      <header className="driver-header driver-shell flex justify-between items-center gap-3">
        <div className="driver-brand min-w-0">
          <div className="driver-brand-icon shrink-0">
            <span className="material-symbols-outlined text-[22px]">directions_bus</span>
          </div>
          <div className="min-w-0">
            <p className="driver-header-kicker">Command Center</p>
            <p className="driver-header-title truncate">Βάρδια #{tripId}</p>
          </div>
        </div>
        <button type="button" onClick={logout} className="driver-header-btn shrink-0">
          Τέλος
        </button>
      </header>

      <div className="driver-shell">
        <TachographStrip
          drivingLabel={tachograph.drivingLabel}
          limitReached={tachograph.limitReached}
        />

        {telemetryOnline && (
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
                  ? 'border-[var(--driver-success)] text-[var(--driver-success)] bg-green-950/30'
                  : 'border-[var(--driver-yellow)]/50 text-[var(--driver-yellow)] bg-[var(--driver-yellow-soft)]'
              }`}
            >
              {onBreak ? 'Τέλος διαλείμματος' : 'Έναρξη διαλείμματος'}
            </button>
          </div>
        )}
      </div>

      <main className="driver-shell driver-main">
        {tab === 'home' && (
          <>
            <DriverPushPanel />
            <DailyManifest />
          </>
        )}
        {tab === 'gps' && (
          <DriverShiftTelemetry driverName={session?.driverName || 'Οδηγός'} />
        )}
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

      <Toaster
        position="bottom-center"
        containerClassName="driver-toast"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#1a1a1a',
            color: '#fafafa',
            fontSize: '0.9375rem',
            fontWeight: 600,
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          },
          success: {
            iconTheme: { primary: '#facc15', secondary: '#0a0a0a' },
          },
        }}
      />
    </div>
  );
}
