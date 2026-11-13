import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import {
  customerRentalCheckIn,
  customerRentalInspection,
  customerStampPickupLegalPack,
  demoOfficeRentalCheckIn,
  guestRentalCheckIn,
} from '../../services/customerRentalApi.js';
import {
  DEMO_RENT_BOOKING_ID,
  DEMO_RENT_OFFICE_REF,
  DEMO_RENT_OFFICE_SURNAME,
  writeDemoRentCheckinReady,
  writeDemoRentLegalReady,
} from '../../lib/rental/demoRentBooking.js';
import { isSoftNativeRentDemoToken } from '../../lib/rental/nativeRentDemo.js';
import { RENTAL_LEGAL_DOCS } from '../../lib/rental/rentalLegalDocs.js';
import RentalSignaturePad from '../admin/fleet/RentalSignaturePad.jsx';

/** Pickup legal docs for Wallet check-in (exclude return protocol). */
const PICKUP_LEGAL_DOCS = RENTAL_LEGAL_DOCS.filter((d) => d.phase === 'pickup');
const BOOKING_LEGAL_DOCS = PICKUP_LEGAL_DOCS.filter((d) => d.source === 'booking');

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

function needsPickupLegalPack(booking) {
  const sigs = booking?.legal_doc_signatures;
  if (!sigs || typeof sigs !== 'object') return true;
  return BOOKING_LEGAL_DOCS.some((d) => !sigs[d.id]?.signature_url);
}

function canCheckIn(booking) {
  if (!booking) return false;
  const status = String(booking.rental_status || '').toUpperCase();
  if (!['CONFIRMED', 'RESERVED', 'ACTIVE'].includes(status)) return false;
  // Allow reopen when online check-in landed but legal pack 1–6 is still empty.
  if (booking.online_checkin_ready && !needsPickupLegalPack(booking)) return false;
  return true;
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
  const [done, setDone] = useState(
    Boolean(booking?.online_checkin_ready) && !needsPickupLegalPack(booking),
  );
  const [fuelLevel, setFuelLevel] = useState(100);
  const [mileage, setMileage] = useState(0);
  const [damageNotes, setDamageNotes] = useState('');
  const [photoUrls, setPhotoUrls] = useState([]);
  const [signatureUrl, setSignatureUrl] = useState('');
  const [signaturePadKey, setSignaturePadKey] = useState(0);
  const [checkedVehicle, setCheckedVehicle] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [openLegalId, setOpenLegalId] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const legalOnly =
    Boolean(booking?.online_checkin_ready) && needsPickupLegalPack(booking);

  useEffect(() => {
    setDone(
      Boolean(booking?.online_checkin_ready) && !needsPickupLegalPack(booking),
    );
    setFuelLevel(100);
    setMileage(0);
    setDamageNotes('');
    setPhotoUrls([]);
    setSignatureUrl('');
    setSignaturePadKey((k) => k + 1);
    setCheckedVehicle(Boolean(booking?.online_checkin_ready));
    setAcceptedLegal(false);
    setOpenLegalId(null);
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
    if (!acceptedLegal) {
      toast.error('Αποδέξου το νομικό πακέτο παραλαβής');
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
        stamp_legal_pack: true,
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
        if (booking.id === DEMO_RENT_BOOKING_ID) {
          writeDemoRentCheckinReady(true);
          writeDemoRentLegalReady(true);
        }
        let officeRow = null;
        let officeSynced = false;
        try {
          // Full protocol when API has /public/demo-check-in (ACTIVE + inspection + legal).
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
              signatureUrl,
              signerName: booking.client_name || DEMO_RENT_OFFICE_SURNAME,
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
          legal_doc_signatures:
            officeRow?.legal_doc_signatures ||
            Object.fromEntries(
              BOOKING_LEGAL_DOCS.map((d) => [
                d.id,
                {
                  signature_url: signatureUrl,
                  signed_at: new Date().toISOString(),
                  via: 'wallet_online_checkin',
                },
              ]),
            ),
        };
        setDone(true);
        onCheckedIn?.(soft);
        toast.success(
          officeSynced
            ? 'Check-in + νομικά επιβεβαιώθηκαν — το γραφείο ενημερώθηκε'
            : 'Check-in επιβεβαιώθηκε',
        );
        return;
      }

      await customerRentalInspection(booking.id, {
        ...payload,
        stamp_legal_pack: true,
      });
      try {
        await customerStampPickupLegalPack(booking.id, {
          signatureUrl,
          signerName: booking.client_name,
        });
      } catch {
        /* inspection may already have stamped when stamp_legal_pack=true */
      }
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
      toast.success('Check-in + νομικό πακέτο ολοκληρώθηκαν');
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
                {done
                  ? 'Check-in έτοιμο'
                  : legalOnly
                    ? 'Νομικό πακέτο'
                    : 'Online Check-in'}
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
                Το {brandLabel} βλέπει ήδη το online check-in και το νομικό πακέτο παραλαβής. Φέρε
                άδεια οδήγησης και ταυτότητα ή διαβατήριο.
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
                <h3>Νομικά + κατάσταση οχήματος.</h3>
                <p>
                  Υπόγραψε το πακέτο παραλαβής και κατέγραψε καύσιμο, χιλιόμετρα και φωτό — ίδια
                  διαδικασία με το desk.
                </p>
              </div>

              <div className="rent-checkin-ref-chip">
                <span>Κράτηση</span>
                <strong>{ref}</strong>
              </div>

              <section className="rent-checkin-legal" aria-label="Νομικό πακέτο παραλαβής">
                <div className="rent-checkin-legal-head">
                  <h3>Νομικό πακέτο</h3>
                  <span>{BOOKING_LEGAL_DOCS.length + 1}/8 παραλαβή</span>
                </div>
                <p className="rent-checkin-legal-lead">
                  Άνοιξε κάθε έντυπο, διάβασε και αποδέξου όλα με μία υπογραφή. Το πρωτόκολλο
                  επιστροφής υπογράφεται στο check-out.
                </p>
                <ul className="rent-checkin-legal-list">
                  {PICKUP_LEGAL_DOCS.map((doc) => {
                    const open = openLegalId === doc.id;
                    const viaInspection = doc.source === 'inspection';
                    return (
                      <li key={doc.id} className={open ? 'is-open' : ''}>
                        <button
                          type="button"
                          className="rent-checkin-legal-row"
                          aria-expanded={open}
                          onClick={() => setOpenLegalId(open ? null : doc.id)}
                        >
                          <span className="rent-checkin-legal-title">{doc.shortTitle}</span>
                          <span className="rent-checkin-legal-meta">
                            {viaInspection ? 'Με την υπογραφή check-in' : 'Έτοιμο για υπογραφή'}
                          </span>
                          <span className="material-symbols-outlined" aria-hidden>
                            {open ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                        {open ? (
                          <div className="rent-checkin-legal-body">
                            <p>{doc.summary}</p>
                            <ul>
                              {(doc.clauses || []).slice(0, 4).map((c) => (
                                <li key={c.slice(0, 48)}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>

              {!legalOnly ? (
                <>
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
                            onClick={() =>
                              setPhotoUrls((prev) => prev.filter((u) => u !== url))
                            }
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
                </>
              ) : null}

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
                  checked={acceptedLegal}
                  onChange={(e) => setAcceptedLegal(e.target.checked)}
                />
                <span>
                  Αποδέχομαι σύμβαση, άδεια, ασφάλιση, εγγύηση, GDPR, γενικούς όρους και πρωτόκολλο
                  παραλαβής.
                </span>
              </label>
              {!legalOnly ? (
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
              ) : null}
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
                  disabled={
                    busy ||
                    uploadingPhoto ||
                    !acceptedLegal ||
                    !checkedVehicle ||
                    !signatureUrl
                  }
                >
                  {busy ? 'Check in…' : 'Check in'}
                </button>
              </div>
              <p>Μία υπογραφή · νομικά + πρωτόκολλο παραλαβής</p>
            </footer>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}

export { canCheckIn };
