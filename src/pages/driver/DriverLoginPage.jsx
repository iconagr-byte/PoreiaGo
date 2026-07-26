import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import MasterQrGate from '../../components/driver/MasterQrGate.jsx';
import { isSessionValid } from '../../lib/driver/driverSession.js';
import { resetDriverEntryAlerts } from '../../lib/driver/clearDriverNotifications.js';
import '../../styles/driver-app.css';

/**
 * Dedicated driver entrance — /driver/login
 * Share / PWA links land here (not admin, not My Wallet).
 */
export default function DriverLoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (isSessionValid()) {
      navigate('/driver', { replace: true });
    }
  }, [navigate]);

  return (
    <>
      <MasterQrGate
        onAuthenticated={() => {
          resetDriverEntryAlerts().catch(() => {});
          window.setTimeout(() => {
            toast.success('Σύνδεση για τη σημερινή βάρδια', {
              id: 'driver-shift-login',
              duration: 2800,
            });
          }, 80);
          navigate('/driver', { replace: true });
        }}
      />
      <Toaster position="bottom-center" />
    </>
  );
}
