/**
 * Rent Wallet — featured rental pass + stack of other vehicle bookings.
 * Separate from bus My Wallet (/wallet).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  cancelCustomerRentalBooking,
  createCustomerRentalInspection,
  createRentalShareLink,
  customerRentalContractUrl,
  fetchMyRentalBookings,
  fetchRentalSafetyContacts,
  modifyCustomerRentalBooking,
  remindCustomerRentalBooking,
  sendRentalSos,
  submitCustomerRentalReview,
  uploadCustomerRentalPhoto,
  uploadCustomerRentalSignature,
} from '../../services/customerRentalApi.js';
import { customerAuthHeaders } from '../../services/customerAuthApi.js';
import RentalWalletPass from './RentalWalletPass.jsx';
import RentalSignaturePad from '../admin/fleet/RentalSignaturePad.jsx';
import {
  cancelBlockedMessage,
  FREE_CANCEL_HOURS,
  isFreeCancelEligible,
} from '../../lib/rental/rentalCancel.js';
import { getRentLang, t } from '../../lib/rental/rentI18n.js';

const STATUS_LABEL = {
  CONFIRMED: 'Επιβεβαιωμένη',
  ACTIVE: 'Σε εξέλιξη',
  COMPLETED: 'Ολοκληρωμένη',
  CANCELLED: 'Ακυρωμένη',
};

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('el-GR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function rankBooking(b) {
  const status = b.rental_status || '';
  if (status === 'ACTIVE') return 0;
  if (status === 'CONFIRMED') return 1;
  if (status === 'COMPLETED') return 2;
  return 3;
}

function sortBookings(rows) {
  return [...rows].sort((a, b) => {
    const rank = rankBooking(a) - rankBooking(b);
    if (rank !== 0) return rank;
    return String(b.start_time || '').localeCompare(String(a.start_time || ''));
  });
}

function hoursUntil(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return (t - Date.now()) / (1000 * 60 * 60);
}

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function RentalWalletPanel({
  brandLabel = 'Rent Wallet',
  passengerName = '',
  refreshKey = 0,
  onBookVehicle,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reminderShown, setReminderShown] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyForm, setModifyForm] = useState({ start_time: '', end_time: '', pickup_location: '' });
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectType, setInspectType] = useState('PICKUP_CHECK');
  const [inspectForm, setInspectForm] = useState({
    fuel_level: 100,
    mileage: 0,
    damage_notes: '',
    photo_urls: [],
    signature_url: '',
    checklist: {
      tires_ok: false,
      lights_ok: false,
      fluids_ok: false,
      documents_ok: false,
      spare_wheel_ok: false,
      damages_noted: false,
    },
  });
  const [safetyContacts, setSafetyContacts] = useState(null);
  const [sosBusy, setSosBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchMyRentalBookings();
      const sorted = sortBookings(list || []);
      setRows(sorted);
      setSelectedId((prev) => {
        if (prev && sorted.some((b) => b.id === prev)) return prev;
        return sorted[0]?.id || '';
      });
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης κρατήσεων');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    fetchRentalSafetyContacts()
      .then(setSafetyContacts)
      .catch(() => setSafetyContacts(null));
  }, []);

  const featured = useMemo(
    () => rows.find((b) => b.id === selectedId) || rows[0] || null,
    [rows, selectedId],
  );
  const others = useMemo(
    () => rows.filter((b) => b.id !== featured?.id),
    [rows, featured],
  );

  useEffect(() => {
    if (reminderShown) return;
    try {
      const enabled = localStorage.getItem('rent_reminders_enabled_v1') === '1';
      if (!enabled) return;
      const upcoming = rows.find((b) => {
        if (b.rental_status !== 'CONFIRMED') return false;
        const diffH = hoursUntil(b.start_time);
        return diffH != null && diffH >= 0 && diffH <= 48;
      });
      if (!upcoming) return;
      remindCustomerRentalBooking(upcoming.id).catch(() => {});
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Υπενθύμιση παραλαβής οχήματος', {
          body: `${upcoming.vehicle_model || 'Όχημα'} · ${formatWhen(upcoming.start_time)}`,
        });
      }
      setReminderShown(true);
    } catch {
      /* ignore */
    }
  }, [rows, reminderShown]);

  const cancelBooking = async (booking) => {
    if (!booking?.id) return;
    if (!isFreeCancelEligible(booking)) {
      toast.error(cancelBlockedMessage(booking));
      return;
    }
    if (
      !window.confirm(
        `Δωρεάν ακύρωση (έως ${FREE_CANCEL_HOURS} ώρες πριν). Να ακυρωθεί αυτή η κράτηση;`,
      )
    ) {
      return;
    }
    setBusyId(booking.id);
    try {
      const cancelled = await cancelCustomerRentalBooking(booking.id);
      const lang = getRentLang();
      if (cancelled?.payment_status === 'refunded') {
        toast.success(t('cancel_refunded', lang));
      } else if (cancelled?.payment_status === 'refund_pending') {
        toast.success(t('cancel_refund_pending', lang));
      } else {
        toast.success(t('cancel_ok', lang));
      }
      await load();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ακύρωσης');
    } finally {
      setBusyId('');
    }
  };

  const submitReview = async (booking) => {
    if (!booking?.id) return;
    const ratingRaw = window.prompt('Βαθμολογία 1–5', '5');
    if (ratingRaw == null) return;
    const rating = Number(ratingRaw);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      toast.error('Η βαθμολογία πρέπει να είναι 1–5');
      return;
    }
    const comment = window.prompt('Σχόλιο (προαιρετικό)', '') || '';
    setBusyId(booking.id);
    try {
      await submitCustomerRentalReview(booking.id, { rating, comment: comment || null });
      toast.success(t('review_thanks', getRentLang()));
      await load();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αξιολόγησης');
    } finally {
      setBusyId('');
    }
  };

  const openModify = (booking) => {
    if (!booking) return;
    setModifyForm({
      start_time: toLocalInput(booking.start_time),
      end_time: toLocalInput(booking.end_time),
      pickup_location: booking.pickup_location || '',
    });
    setModifyOpen(true);
  };

  const submitModify = async () => {
    if (!featured?.id) return;
    setBusyId(featured.id);
    try {
      await modifyCustomerRentalBooking(featured.id, {
        start_time: new Date(modifyForm.start_time).toISOString(),
        end_time: new Date(modifyForm.end_time).toISOString(),
        pickup_location: modifyForm.pickup_location || undefined,
      });
      toast.success('Οι ημερομηνίες ενημερώθηκαν');
      setModifyOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία τροποποίησης');
    } finally {
      setBusyId('');
    }
  };

  const openContract = (booking) => {
    if (!booking?.id) return;
    const url = customerRentalContractUrl(booking.id);
    const headers = customerAuthHeaders();
    fetch(url, { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error('Αποτυχία σύμβασης');
        const html = await res.text();
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
        } else {
          toast.error('Επιτρέψτε τα pop-ups για τη σύμβαση');
        }
      })
      .catch((err) => toast.error(err.message || 'Αποτυχία σύμβασης'));
  };

  const openInspect = (booking, type) => {
    setInspectType(type);
    setInspectForm({
      fuel_level: 100,
      mileage: 0,
      damage_notes: '',
      photo_urls: [],
      signature_url: '',
      checklist: {
        tires_ok: false,
        lights_ok: false,
        fluids_ok: false,
        documents_ok: false,
        spare_wheel_ok: false,
        damages_noted: false,
      },
    });
    setInspectOpen(true);
  };

  const submitInspect = async () => {
    if (!featured?.id) return;
    if (inspectType === 'PICKUP_CHECK') {
      const c = inspectForm.checklist || {};
      const required = ['tires_ok', 'lights_ok', 'fluids_ok', 'documents_ok', 'spare_wheel_ok'];
      if (required.some((k) => !c[k])) {
        toast.error('Ολοκληρώστε τον προ-αναχώρησης έλεγχο');
        return;
      }
    }
    setBusyId(featured.id);
    try {
      await createCustomerRentalInspection(featured.id, {
        inspection_type: inspectType,
        fuel_level: Number(inspectForm.fuel_level) || 100,
        mileage: Number(inspectForm.mileage) || 0,
        damage_notes: inspectForm.damage_notes || null,
        photo_urls: inspectForm.photo_urls || [],
        signature_url: inspectForm.signature_url || null,
        checklist: inspectType === 'PICKUP_CHECK' ? inspectForm.checklist : undefined,
      });
      toast.success(inspectType === 'PICKUP_CHECK' ? 'Check-in ολοκληρώθηκε' : 'Check-out ολοκληρώθηκε');
      setInspectOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || 'Αποτυχία επιθεώρησης');
    } finally {
      setBusyId('');
    }
  };

  const handleSos = async (booking) => {
    if (!booking?.id || sosBusy) return;
    const lang = getRentLang();
    const officePhone = String(safetyContacts?.office_phone || '').replace(/[^\d+]/g, '');
    const choice = window.confirm(
      `${t('sos_confirm', lang)}\nOK = ${t('sos_send_location', lang)}\nCancel = ${
        officePhone ? t('sos_call_office', lang) : 'Άκυρο'
      }`,
    );
    if (!choice) {
      if (officePhone) window.location.href = `tel:${officePhone}`;
      return;
    }
    setSosBusy(true);
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation μη διαθέσιμο'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
        });
      });
      await sendRentalSos(booking.id, {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
      toast.success(t('sos_sent', lang));
      if (officePhone) {
        window.location.href = `tel:${officePhone}`;
      }
    } catch (err) {
      toast.error(err.message || 'Αποτυχία SOS');
      if (officePhone) window.location.href = `tel:${officePhone}`;
    } finally {
      setSosBusy(false);
    }
  };

  const handleShareTrip = async (booking) => {
    if (!booking?.id || shareBusy) return;
    const lang = getRentLang();
    setShareBusy(true);
    try {
      const data = await createRentalShareLink(booking.id);
      const url = data.url;
      if (navigator.share) {
        try {
          await navigator.share({ title: t('share_trip', lang), url });
          toast.success(t('share_copied', lang));
          return;
        } catch {
          /* fall through to clipboard */
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success(t('share_copied', lang));
      } else {
        window.prompt(t('share_trip', lang), url);
      }
    } catch (err) {
      toast.error(err.message || t('share_failed', lang));
    } finally {
      setShareBusy(false);
    }
  };

  const canCheckIn =
    featured?.rental_status === 'CONFIRMED' &&
    (() => {
      const h = hoursUntil(featured?.start_time);
      return h != null && h <= 6 && h >= -2;
    })();
  const canCheckOut = featured?.rental_status === 'ACTIVE';

  if (loading && !rows.length) {
    return <p className="rent-panel-lead">Φόρτωση Rent Wallet…</p>;
  }

  return (
    <div className="rent-wallet">
      <RentalWalletPass
        booking={featured}
        brandLabel={brandLabel}
        passengerName={passengerName}
        safetyContacts={safetyContacts}
        onBookVehicle={onBookVehicle}
        onCancel={isFreeCancelEligible(featured) ? cancelBooking : null}
        cancelling={busyId === featured?.id}
        onModify={isFreeCancelEligible(featured) ? () => openModify(featured) : null}
        onContract={featured ? () => openContract(featured) : null}
        onCheckIn={canCheckIn ? () => openInspect(featured, 'PICKUP_CHECK') : null}
        onCheckOut={canCheckOut ? () => openInspect(featured, 'RETURN_CHECK') : null}
        onReview={
          featured?.rental_status === 'COMPLETED' ? () => submitReview(featured) : null
        }
        reviewBusy={busyId === featured?.id}
        onSos={featured ? handleSos : null}
        sosBusy={sosBusy}
        onShareTrip={featured ? handleShareTrip : null}
        shareBusy={shareBusy}
      />

      {modifyOpen ? (
        <div className="rent-wallet-sheet" role="dialog" aria-label="Αλλαγή ημερομηνιών">
          <h3>Αλλαγή ημερομηνιών</h3>
          <label>
            Έναρξη
            <input
              type="datetime-local"
              className="wallet-input"
              value={modifyForm.start_time}
              onChange={(e) => setModifyForm((f) => ({ ...f, start_time: e.target.value }))}
            />
          </label>
          <label>
            Λήξη
            <input
              type="datetime-local"
              className="wallet-input"
              value={modifyForm.end_time}
              onChange={(e) => setModifyForm((f) => ({ ...f, end_time: e.target.value }))}
            />
          </label>
          <label>
            Παραλαβή
            <input
              className="wallet-input"
              value={modifyForm.pickup_location}
              onChange={(e) => setModifyForm((f) => ({ ...f, pickup_location: e.target.value }))}
            />
          </label>
          <div className="rent-wallet-sheet-actions">
            <button type="button" className="wallet-btn" onClick={() => setModifyOpen(false)}>
              Άκυρο
            </button>
            <button
              type="button"
              className="wallet-pass-cta"
              disabled={busyId === featured?.id}
              onClick={submitModify}
            >
              Αποθήκευση
            </button>
          </div>
        </div>
      ) : null}

      {inspectOpen ? (
        <div className="rent-wallet-sheet" role="dialog" aria-label="Επιθεώρηση">
          <h3>{inspectType === 'PICKUP_CHECK' ? 'Check-in' : 'Check-out'}</h3>
          <label>
            Καύσιμο %
            <input
              type="number"
              min={0}
              max={100}
              className="wallet-input"
              value={inspectForm.fuel_level}
              onChange={(e) => setInspectForm((f) => ({ ...f, fuel_level: e.target.value }))}
            />
          </label>
          <label>
            Χιλιόμετρα
            <input
              type="number"
              min={0}
              className="wallet-input"
              value={inspectForm.mileage}
              onChange={(e) => setInspectForm((f) => ({ ...f, mileage: e.target.value }))}
            />
          </label>
          <label>
            Σημειώσεις
            <textarea
              className="wallet-input"
              rows={2}
              value={inspectForm.damage_notes}
              onChange={(e) => setInspectForm((f) => ({ ...f, damage_notes: e.target.value }))}
            />
          </label>
          {inspectType === 'PICKUP_CHECK' ? (
            <div className="rent-checklist">
              <p className="rent-checklist-title">{t('checklist_title', getRentLang())}</p>
              {[
                ['tires_ok', 'checklist_tires'],
                ['lights_ok', 'checklist_lights'],
                ['fluids_ok', 'checklist_fluids'],
                ['documents_ok', 'checklist_documents'],
                ['spare_wheel_ok', 'checklist_spare'],
                ['damages_noted', 'checklist_damages'],
              ].map(([key, labelKey]) => (
                <label key={key} className="rent-checklist-item">
                  <input
                    type="checkbox"
                    checked={Boolean(inspectForm.checklist?.[key])}
                    onChange={(e) =>
                      setInspectForm((f) => ({
                        ...f,
                        checklist: { ...f.checklist, [key]: e.target.checked },
                      }))
                    }
                  />
                  {t(labelKey, getRentLang())}
                </label>
              ))}
            </div>
          ) : null}
          <label className="rent-wallet-photo">
            Φωτογραφία (προαιρετικά)
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const up = await uploadCustomerRentalPhoto(file);
                  setInspectForm((f) => ({
                    ...f,
                    photo_urls: [...(f.photo_urls || []), up.url].slice(0, 4),
                  }));
                  toast.success('Φωτογραφία ανέβηκε');
                } catch (err) {
                  toast.error(err.message);
                }
              }}
            />
          </label>
          <div className="rent-wallet-sig">
            <p className="wallet-field-hint">Υπογραφή</p>
            <RentalSignaturePad
              previewUrl={inspectForm.signature_url || null}
              onCommit={async (blob) => {
                try {
                  const file = new File([blob], 'checkin-sign.png', { type: 'image/png' });
                  const up = await uploadCustomerRentalSignature(file);
                  setInspectForm((f) => ({ ...f, signature_url: up.url }));
                } catch (err) {
                  toast.error(err.message);
                }
              }}
              onClear={() => setInspectForm((f) => ({ ...f, signature_url: '' }))}
            />
          </div>
          <div className="rent-wallet-sheet-actions">
            <button type="button" className="wallet-btn" onClick={() => setInspectOpen(false)}>
              Άκυρο
            </button>
            <button
              type="button"
              className="wallet-pass-cta"
              disabled={busyId === featured?.id}
              onClick={submitInspect}
            >
              Υποβολή
            </button>
          </div>
        </div>
      ) : null}

      {others.length ? (
        <section className="wallet-home-more rent-wallet-more" aria-label="Άλλες ενοικιάσεις">
          <h3 className="rent-wallet-more-title">Άλλες κρατήσεις</h3>
          <div className="wallet-list">
            {others.map((b) => (
              <button
                key={b.id}
                type="button"
                className="wallet-booking-card rent-wallet-card-btn"
                onClick={() => setSelectedId(b.id)}
              >
                <div className="wallet-booking-body">
                  <h3>
                    {b.vehicle_model || 'Όχημα'} · {b.vehicle_plate || '—'}
                  </h3>
                  <p>
                    {formatWhen(b.start_time)} → {formatWhen(b.end_time)}
                  </p>
                  <p className="wallet-booking-mono">
                    {b.pickup_location || 'Γραφείο'}
                    {` · €${Number(b.total_cost || 0).toFixed(2)} · ${
                      STATUS_LABEL[b.rental_status] || b.rental_status
                    }`}
                    {b.fiscal_mark ? ` · Απόδειξη` : ''}
                  </p>
                </div>
                <span className="material-symbols-outlined" aria-hidden>
                  chevron_right
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
