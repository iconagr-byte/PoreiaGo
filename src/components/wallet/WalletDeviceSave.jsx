/**
 * Save booking to the phone: calendar, share, PDF.
 * Apple Wallet / Google Wallet when server certificates are configured.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_BASE } from '../../config/api.js';
import { customerAuthHeaders } from '../../services/customerAuthApi.js';
import { startWalletTicketPrint } from '../../lib/ticketing/printTicket.js';
import {
  downloadBookingIcs,
  googleCalendarUrl,
  shareBooking,
} from '../../lib/wallet/deviceSave.js';

async function fetchPassStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/customer/wallet-pass/status`, {
      headers: customerAuthHeaders(),
    });
    if (!res.ok) return { apple: false, google: false };
    return res.json();
  } catch {
    return { apple: false, google: false };
  }
}

export default function WalletDeviceSave({
  booking,
  compact = false,
  brandLabel = 'My Wallet',
  coverImage = '',
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [passStatus, setPassStatus] = useState({ apple: false, google: false });
  const [printBusy, setPrintBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    fetchPassStatus().then((s) => {
      if (!cancelled) setPassStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!booking?.id) return null;

  const gcal = googleCalendarUrl(booking);

  const onCalendar = () => {
    try {
      downloadBookingIcs(booking);
      toast.success('Άνοιξε / αποθηκεύτηκε στο ημερολόγιο');
      setOpen(false);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ημερολογίου');
    }
  };

  const onShare = async () => {
    try {
      const mode = await shareBooking(booking);
      toast.success(mode === 'copied' ? 'Αντιγράφηκε' : 'Κοινοποιήθηκε');
      setOpen(false);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία κοινοποίησης');
    }
  };

  const onApple = async () => {
    if (!passStatus.apple) {
      toast('Το Apple Wallet ενεργοποιείται με certificates στο server — προς το παρόν χρησιμοποιήστε PDF ή ημερολόγιο', {
        icon: 'ℹ️',
        duration: 4500,
      });
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/customer/wallet-pass/apple/${encodeURIComponent(booking.id)}`,
        { headers: customerAuthHeaders() },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Αποτυχία Apple Wallet');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${booking.pnr || booking.id}.pkpass`;
      a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία Apple Wallet');
    }
  };

  return (
    <div className={`wallet-device-save${compact ? ' is-compact' : ''}`}>
      <button
        type="button"
        className="wallet-pass-cta wallet-device-save-trigger"
        onClick={() => setOpen(true)}
      >
        <span className="material-symbols-outlined" aria-hidden>
          add_to_home_screen
        </span>
        Αποθήκευση στο κινητό
      </button>

      {open ? (
        <div
          className="wallet-device-sheet-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="wallet-device-sheet"
            role="dialog"
            aria-label="Αποθήκευση στο κινητό"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wallet-device-sheet-handle" aria-hidden />
            <h3 className="wallet-device-sheet-title">Αποθήκευση στο κινητό</h3>
            <p className="wallet-device-sheet-copy">
              Ημερολόγιο, PDF ή κοινοποίηση — το εισιτήριο μένει και στο My Wallet.
            </p>

            <div className="wallet-device-sheet-actions">
              <button type="button" className="wallet-device-row" onClick={onCalendar}>
                <span className="material-symbols-outlined" aria-hidden>
                  calendar_add_on
                </span>
                <span>
                  <strong>Ημερολόγιο τηλεφώνου</strong>
                  <small>Αρχείο .ics</small>
                </span>
              </button>

              {gcal ? (
                <a
                  className="wallet-device-row"
                  href={gcal}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                >
                  <span className="material-symbols-outlined" aria-hidden>
                    event
                  </span>
                  <span>
                    <strong>Google Calendar</strong>
                    <small>Άνοιγμα στο πρόγραμμα</small>
                  </span>
                </a>
              ) : null}

              <button
                type="button"
                className="wallet-device-row"
                disabled={printBusy}
                onClick={async () => {
                  if (printBusy) return;
                  setPrintBusy(true);
                  try {
                    const mode = await startWalletTicketPrint({
                      booking,
                      tripTitle: booking.tripTitle,
                      coverImage,
                      brandLabel,
                      navigate,
                    });
                    setOpen(false);
                    if (mode === 'download') {
                      toast.success('Κατέβηκε το εισιτήριο — άνοιξέ το για PDF');
                    }
                  } catch (err) {
                    toast.error(err?.message || 'Αποτυχία εκτύπωσης');
                  } finally {
                    setPrintBusy(false);
                  }
                }}
              >
                <span className="material-symbols-outlined" aria-hidden>
                  picture_as_pdf
                </span>
                <span>
                  <strong>PDF / Εκτύπωση</strong>
                  <small>{printBusy ? 'Προετοιμασία…' : 'Boarding pass'}</small>
                </span>
              </button>

              <button type="button" className="wallet-device-row" onClick={onShare}>
                <span className="material-symbols-outlined" aria-hidden>
                  ios_share
                </span>
                <span>
                  <strong>Κοινοποίηση</strong>
                  <small>Μήνυμα / αντιγραφή</small>
                </span>
              </button>

              <button
                type="button"
                className="wallet-device-row"
                onClick={onApple}
                disabled
                aria-disabled="true"
                title="Το Apple Wallet .pkpass θα ενεργοποιηθεί με PassKit certificates"
              >
                <span className="material-symbols-outlined" aria-hidden>
                  wallet
                </span>
                <span>
                  <strong>Apple Wallet</strong>
                  <small>Σύντομα — προς το παρόν PDF / ημερολόγιο</small>
                </span>
              </button>
            </div>

            <button
              type="button"
              className="wallet-pass-secondary wallet-ticket-email"
              onClick={() => setOpen(false)}
            >
              Κλείσιμο
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
