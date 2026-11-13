import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  customerRentalCheckIn,
  customerRentalInspection,
  demoOfficeRentalCheckIn,
  guestRentalCheckIn,
} from '../../services/customerRentalApi.js';
import {
  DEMO_RENT_BOOKING_ID,
  DEMO_RENT_OFFICE_REF,
  DEMO_RENT_OFFICE_SURNAME,
  writeDemoRentCheckinReady,
} from '../../lib/rental/demoRentBooking.js';
import { isSoftNativeRentDemoToken } from '../../lib/rental/nativeRentDemo.js';
import RentalSignaturePad from '../admin/fleet/RentalSignaturePad.jsx';

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

function canCheckIn(booking) {
  if (!booking) return false;
  if (booking.online_checkin_ready) return false;
  const status = String(booking.rental_status || '').toUpperCase();
  return status === 'CONFIRMED' || status === 'RESERVED' || status === 'ACTIVE';
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Αποτυχία ανάγνωσης αρχείου'));
    reader.readAsDataURL(file);
  });
}

/**
 * Full online check-in sheet — same fields as desktop desk check-in
 * (fuel, km, damage notes, photos, signature), Apple Wallet aesthetic.
 */
export default function RentMemberCheckinSheet({
  booking,
  brandLabel = 'Γραφείο',
  onClose,
  onCheckedIn,
}) {
  const titleId = useId();
  const sigRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(Boolean(booking?.online_checkin_ready));
  const [fuelLevel, setFuelLevel] = useState(100);
  const [mileage, setMileage] = useState(0);
  const [damageNotes, setDamageNotes] = useState('');
  const [photoUrls, setPhotoUrls] = useState([]);
  const [signatureUrl, setSignatureUrl] = useState('');
  const [signaturePadKey, setSignaturePadKey] = useState(0);
  const [checkedVehicle, setCheckedVehicle] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    setDone(Boolean(booking?.online_checkin_ready));
    setFuelLevel(100);
    setMileage(0);
    setDamageNotes('');
    setPhotoUrls([]);
    setSignatureUrl('');
    setSignaturePadKey((k) => k + 1);
    setCheckedVehicle(false);
  }, [booking?.id, booking?.online_checkin_ready]);

  useEffect(() => {
    if (!booking) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [booking, onClose, busy]);

  if (!booking || typeof document === 'undefined') return null;

  const ref =
    booking.reference_code ||
    (booking.id ? `RB-${String(booking.id).replace(/-/g, '').slice(0, 8).toUpperCase()}` : '—');
  const vehicleLine = [booking.vehicle_model, booking.vehicle_plate].filter(Boolean).join(' · ');
  const softDemo = isSoftNativeRentDemoToken() || booking.id === DEMO_RENT_BOOKING_ID;

  const onDamagePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (photoUrls.length >= 4) {
      toast.error('Μέχρι 4 φωτογραφίες');
      return;
    }
    setUploadingPhoto(true);
    try {
      const url = await fileToDataUrl(file);
      if (!url.startsWith('data:image/')) throw new Error('Μη έγκυρη εικόνα');
      setPhotoUrls((prev) => [...prev, url]);
      toast.success('Η φωτογραφία προστέθηκε');
    } catch (err) {
      toast.error(err?.message || 'Αποτυχία φωτογραφίας');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveSignature = async () => {
    const file = await sigRef.current?.getFile?.();
    if (!file) {
      toast.error('Υπογράψτε πρώτα στο πλαίσιο');
      return;
    }
    try {
      const url = await fileToDataUrl(file);
      setSignatureUrl(url);
      toast.success('Η υπογραφή αποθηκεύτηκε');
    } catch (err) {
      toast.error(err?.message || 'Αποτυχία υπογραφής');
    }
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (done || busy) return;
    if (!canCheckIn(booking)) {
      toast.error('Το check-in δεν είναι διαθέσιμο για αυτή την κράτηση.');
      return;
    }
    if (!checkedVehicle) {
      toast.error('Επιβεβαίωσε τον έλεγχο οχήματος');
      return;
    }
    if (!signatureUrl) {
      toast.error('Αποθήκευσε την υπογραφή σου');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        inspection_type: 'PICKUP_CHECK',
        fuel_level: Number(fuelLevel),
        mileage: Number(mileage) || 0,
        damage_notes: String(damageNotes || '').trim() || null,
        photo_urls: photoUrls,
        signature_url: signatureUrl,
        checklist: {
          tires_ok: true,
          lights_ok: true,
          fluids_ok: true,
          documents_ok: true,
          spare_wheel_ok: true,
          damages_noted: Boolean(String(damageNotes || '').trim()),
        },
      };

      if (softDemo) {
        if (booking.id === DEMO_RENT_BOOKING_ID) writeDemoRentCheckinReady(true);
        let officeRow = null;
        let officeSynced = false;
        try {
          // Full protocol when API has /public/demo-check-in (ACTIVE + inspection).
          officeRow = await demoOfficeRentalCheckIn(payload);
          officeSynced = Boolean(officeRow?.online_checkin_ready || officeRow?.id);
        } catch {
          /* older API — fall through to guest check-in */
        }
        if (!officeSynced) {
          try {
            // Production-safe: same RN-DEMO01 + επώνυμο as office Δοκιμαστικός Πελάτης.
            officeRow = await guestRentalCheckIn({
              surname: DEMO_RENT_OFFICE_SURNAME,
              referenceCode: DEMO_RENT_OFFICE_REF,
            });
            officeSynced = Boolean(officeRow?.online_checkin_ready || officeRow?.id);
          } catch {
            /* offline / CORS — local wallet still completes */
          }
        }
        const soft = {
          ...booking,
          ...(officeRow || {}),
          id: booking.id,
          reference_code:
            booking.reference_code ||
            officeRow?.reference_code ||
            DEMO_RENT_OFFICE_REF,
          online_checkin_ready: true,
          online_checkin_at:
            officeRow?.online_checkin_at || new Date().toISOString(),
          rental_status: 'ACTIVE',
          checkin_fuel_level: payload.fuel_level,
          checkin_mileage: payload.mileage,
        };
        setDone(true);
        onCheckedIn?.(soft);
        toast.success(
          officeSynced
            ? 'Check-in επιβεβαιώθηκε — το γραφείο ενημερώθηκε'
            : 'Check-in επιβεβαιώθηκε',
        );
        return;
      }

      await customerRentalInspection(booking.id, payload);
      let row = {
        ...booking,
        online_checkin_ready: true,
        online_checkin_at: new Date().toISOString(),
        rental_status: 'ACTIVE',
      };
      try {
        const data = await customerRentalCheckIn(booking.id);
        row = data?.booking || row;
      } catch {
        /* inspection already marked ready server-side */
      }
      setDone(true);
      onCheckedIn?.(row);
      toast.success('Check-in ολοκληρώθηκε');
    } catch (err) {
      toast.error(err?.message || 'Αποτυχία check-in');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="rent-member-checkin-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
    >
      <div className="rent-member-checkin-sheet rent-member-checkin-sheet--form">
        <div className="rent-member-checkin-handle" aria-hidden />
        <header className="rent-checkin-form-head">
          <div className="rent-checkin-form-head-row">
            <span className="rent-checkin-form-icon" aria-hidden>
              <span className="material-symbols-outlined">login</span>
            </span>
            <div className="rent-checkin-form-head-copy">
              <p className="rent-checkin-form-eyebrow">
                Παραλαβή · {brandLabel}
              </p>
              <h2 id={titleId}>
                {done ? 'Check-in έτοιμο' : 'Online Check-in'}
              </h2>
              <p className="rent-checkin-form-vehicle">{vehicleLine || 'Όχημα'}</p>
              <p className="rent-checkin-form-when">
                {formatWhen(booking.start_time)} → {formatWhen(booking.end_time)}
              </p>
            </div>
            <button
              type="button"
              className="rent-member-checkin-close"
              aria-label="Κλείσιμο"
              disabled={busy}
              onClick={onClose}
            >
              <span className="material-symbols-outlined" aria-hidden>
                close
              </span>
            </button>
          </div>
        </header>

        {done ? (
          <>
            <div className="rent-member-checkin-body">
              <p className="rent-member-checkin-brand">{brandLabel}</p>
              <h3 className="rent-checkin-done-title">Είσαι έτοιμος για παραλαβή.</h3>
              <p className="rent-member-checkin-lead">
                Το {brandLabel} βλέπει ήδη το online check-in σου. Φέρε άδεια οδήγησης και ταυτότητα
                ή διαβατήριο.
              </p>
              <div className="rent-member-checkin-card">
                <div className="rent-member-checkin-card-top">
                  <span>Κράτηση</span>
                  <strong>{ref}</strong>
                </div>
                {vehicleLine ? (
                  <p className="rent-member-checkin-vehicle">{vehicleLine}</p>
                ) : null}
              </div>
            </div>
            <footer className="rent-member-checkin-foot">
              <button type="button" className="rent-member-checkin-cta" onClick={onClose}>
                Εντάξει
              </button>
            </footer>
          </>
        ) : (
          <form className="rent-checkin-form" onSubmit={submit}>
            <div className="rent-checkin-form-scroll">
              <div className="rent-checkin-hook">
                <p className="rent-checkin-hook-kicker">Πριν φτάσεις στο γραφείο</p>
                <h3>Κατέγραψε την κατάσταση του οχήματος.</h3>
                <p>
                  Ίδια διαδικασία με το desk check-in — καύσιμο, χιλιόμετρα, φωτό και υπογραφή σε
                  λιγότερο από 2 λεπτά.
                </p>
              </div>

              <div className="rent-checkin-ref-chip">
                <span>Κράτηση</span>
                <strong>{ref}</strong>
              </div>

              <div className="rent-checkin-grid-2">
                <label className="rent-checkin-field">
                  <span>Καύσιμο %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    inputMode="numeric"
                    value={fuelLevel}
                    onChange={(e) => setFuelLevel(e.target.value)}
                  />
                </label>
                <label className="rent-checkin-field">
                  <span>Χιλιόμετρα</span>
                  <input
                    type="number"
                    min={0}
                    required
                    inputMode="numeric"
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                  />
                </label>
              </div>

              <label className="rent-checkin-field rent-checkin-field--block">
                <span>Σημειώσεις ζημιών</span>
                <textarea
                  rows={3}
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  placeholder="Χωρίς ζημιές / περιγραφή…"
                />
              </label>

              <div className="rent-checkin-field rent-checkin-field--block">
                <div className="rent-checkin-field-row">
                  <span>Φωτογραφίες</span>
                  <label className="rent-checkin-add-photo">
                    <span className="material-symbols-outlined" aria-hidden>
                      {uploadingPhoto ? 'progress_activity' : 'add_a_photo'}
                    </span>
                    {uploadingPhoto ? 'Ανέβασμα…' : 'Προσθήκη'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      disabled={uploadingPhoto || busy}
                      onChange={onDamagePhoto}
                    />
                  </label>
                </div>
                {photoUrls.length ? (
                  <div className="rent-checkin-photos">
                    {photoUrls.map((url) => (
                      <button
                        key={url.slice(0, 48)}
                        type="button"
                        className="rent-checkin-photo"
                        onClick={() => setPhotoUrls((prev) => prev.filter((u) => u !== url))}
                        aria-label="Αφαίρεση φωτογραφίας"
                      >
                        <img src={url} alt="" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rent-checkin-hint">
                    Προαιρετικά — selfie ζημιάς / κατάσταση οχήματος
                  </p>
                )}
              </div>

              <div className="rent-checkin-field rent-checkin-field--block">
                <RentalSignaturePad
                  key={signaturePadKey}
                  ref={sigRef}
                  embedded
                  previewUrl={signatureUrl || null}
                  heightClass="h-32"
                  disabled={busy}
                  onClear={() => {
                    setSignatureUrl('');
                    setSignaturePadKey((k) => k + 1);
                  }}
                />
                {!signatureUrl ? (
                  <button
                    type="button"
                    className="rent-checkin-sign-save"
                    disabled={busy}
                    onClick={saveSignature}
                  >
                    Αποθήκευση υπογραφής
                  </button>
                ) : (
                  <p className="rent-checkin-hint is-ok">Η υπογραφή αποθηκεύτηκε</p>
                )}
              </div>

            </div>

            <footer className="rent-member-checkin-foot rent-checkin-form-foot">
              <label className="rent-checkin-confirm">
                <input
                  type="checkbox"
                  checked={checkedVehicle}
                  onChange={(e) => setCheckedVehicle(e.target.checked)}
                />
                <span>
                  Επιβεβαιώνω έλεγχο ελαστικών, φώτων, υγρών, εγγράφων και ρεζέρβας.
                </span>
              </label>
              <div className="rent-checkin-foot-row">
                <button
                  type="button"
                  className="rent-checkin-cancel"
                  disabled={busy}
                  onClick={onClose}
                >
                  Άκυρο
                </button>
                <button
                  type="submit"
                  className="rent-member-checkin-cta rent-checkin-submit"
                  disabled={busy || uploadingPhoto || !checkedVehicle || !signatureUrl}
                >
                  {busy ? 'Check in…' : 'Check in'}
                </button>
              </div>
              <p>Χωρίς επιπλέον χρέωση · ίδια διαδικασία με το γραφείο</p>
            </footer>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

export { canCheckIn };
