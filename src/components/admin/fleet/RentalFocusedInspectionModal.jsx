/**
 * Focused check-in / check-out for one rental booking — not the bulk inspections desk.
 */
import { useEffect, useId, useRef, useState } from 'react';
import {
  createRentalInspection,
  uploadRentalInspectionPhoto,
} from '../../../services/fleetRentalApi.js';
import { resolveSiteAssetUrl } from '../../../services/siteAppearanceApi.js';
import RentalSignaturePad from './RentalSignaturePad.jsx';

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

export default function RentalFocusedInspectionModal({
  booking,
  inspectionType = 'RETURN_CHECK',
  officeName = 'Γραφείο',
  onClose,
  onSaved,
  onToast,
}) {
  const titleId = useId();
  const closeRef = useRef(null);
  const isReturn = inspectionType === 'RETURN_CHECK';
  const label = isReturn ? 'Check-out' : 'Check-in';
  const verb = isReturn ? 'Επιστροφή' : 'Παραλαβή';

  const [fuelLevel, setFuelLevel] = useState(100);
  const [mileage, setMileage] = useState(0);
  const [damageNotes, setDamageNotes] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [photoUrls, setPhotoUrls] = useState([]);
  const [signatureUrl, setSignatureUrl] = useState('');
  const [signaturePadKey, setSignaturePadKey] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    closeRef.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  if (!booking?.id) return null;

  const onDamagePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const uploaded = await uploadRentalInspectionPhoto(file);
      setPhotoUrls((prev) => [...prev, uploaded.url]);
      onToast?.('success', 'Η φωτογραφία ανέβηκε');
    } catch (err) {
      onToast?.('error', err?.message || 'Αποτυχία ανεβάσματος');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const onSignatureCommit = async (file) => {
    setUploadingSignature(true);
    try {
      const uploaded = await uploadRentalInspectionPhoto(file);
      setSignatureUrl(uploaded.url);
      onToast?.('success', 'Η υπογραφή αποθηκεύτηκε');
    } catch (err) {
      onToast?.('error', err?.message || 'Αποτυχία υπογραφής');
    } finally {
      setUploadingSignature(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const saved = await createRentalInspection({
        rental_booking_id: booking.id,
        inspection_type: inspectionType,
        fuel_level: Number(fuelLevel),
        mileage: Number(mileage),
        damage_notes: damageNotes,
        inspector_name: inspectorName,
        photo_urls: photoUrls,
        signature_url: signatureUrl || null,
      });
      onToast?.(
        'success',
        isReturn ? 'Check-out καταχωρήθηκε · κράτηση ολοκληρωμένη' : 'Check-in καταχωρήθηκε',
      );
      onSaved?.(saved);
      onClose?.();
    } catch (err) {
      onToast?.('error', err?.message || 'Αποτυχία καταχώρησης');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[6px] sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(92vh,840px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-black/[0.08] bg-[#f5f5f7] shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:rounded-[28px]"
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', sans-serif",
        }}
      >
        <header className="shrink-0 border-b border-black/[0.06] bg-white/90 px-4 pb-3 pt-3.5 backdrop-blur-xl sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-white ${
                  isReturn ? 'bg-[#0071e3]' : 'bg-[#0a7a6c]'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">
                  {isReturn ? 'logout' : 'login'}
                </span>
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">
                  {verb} · {officeName}
                </p>
                <h2
                  id={titleId}
                  className="mt-0.5 truncate text-[1.2rem] font-bold tracking-tight text-[#1d1d1f]"
                >
                  {label} · {booking.client_name || 'Πελάτης'}
                </h2>
                <p className="mt-1 truncate text-[13px] tracking-tight text-[#6e6e73]">
                  {booking.vehicle_model || 'Όχημα'}
                  {booking.vehicle_plate ? (
                    <span className="font-mono text-[12px]"> · {booking.vehicle_plate}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[12px] tracking-tight text-[#86868b]">
                  {formatWhen(booking.start_time)} → {formatWhen(booking.end_time)}
                </p>
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-[#1d1d1f] transition hover:bg-black/[0.08] disabled:opacity-40"
              aria-label="Κλείσιμο"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </header>

        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block rounded-[18px] border border-black/[0.06] bg-white px-3 py-2.5">
                <span className="text-[11px] font-semibold tracking-tight text-[#86868b]">
                  Καύσιμο %
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={fuelLevel}
                  onChange={(e) => setFuelLevel(e.target.value)}
                  className="mt-1 w-full bg-transparent text-lg font-bold tracking-tight text-[#1d1d1f] outline-none"
                />
              </label>
              <label className="block rounded-[18px] border border-black/[0.06] bg-white px-3 py-2.5">
                <span className="text-[11px] font-semibold tracking-tight text-[#86868b]">
                  Χιλιόμετρα
                </span>
                <input
                  type="number"
                  min={0}
                  required
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  className="mt-1 w-full bg-transparent text-lg font-bold tracking-tight text-[#1d1d1f] outline-none"
                />
              </label>
            </div>

            <label className="block rounded-[18px] border border-black/[0.06] bg-white px-3 py-2.5">
              <span className="text-[11px] font-semibold tracking-tight text-[#86868b]">
                Σημειώσεις ζημιών
              </span>
              <textarea
                rows={3}
                value={damageNotes}
                onChange={(e) => setDamageNotes(e.target.value)}
                placeholder="Χωρίς ζημιές / περιγραφή…"
                className="mt-1 w-full resize-none bg-transparent text-sm tracking-tight text-[#1d1d1f] outline-none placeholder:text-[#c7c7cc]"
              />
            </label>

            <div className="rounded-[18px] border border-black/[0.06] bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold tracking-tight text-[#86868b]">
                  Φωτογραφίες
                </p>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[11px] font-semibold tracking-tight text-[#1d1d1f] transition hover:bg-[#ebebed]">
                  <span className="material-symbols-outlined text-[15px]">
                    {uploadingPhoto ? 'progress_activity' : 'add_a_photo'}
                  </span>
                  {uploadingPhoto ? 'Ανέβασμα…' : 'Προσθήκη'}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploadingPhoto || busy}
                    onChange={onDamagePhoto}
                  />
                </label>
              </div>
              {photoUrls.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {photoUrls.map((url) => (
                    <a
                      key={url}
                      href={resolveSiteAssetUrl(url)}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-14 w-14 overflow-hidden rounded-xl border border-black/[0.06] bg-[#f5f5f7]"
                    >
                      <img
                        src={resolveSiteAssetUrl(url)}
                        alt="Ζημιά"
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] tracking-tight text-[#aeaeb2]">
                  Προαιρετικά — selfie ζημιάς / κατάσταση οχήματος
                </p>
              )}
            </div>

            <div className="rounded-[18px] border border-black/[0.06] bg-white p-3">
              <p className="mb-2 text-[11px] font-semibold tracking-tight text-[#86868b]">
                Υπογραφή πελάτη
              </p>
              <RentalSignaturePad
                key={signaturePadKey}
                previewUrl={signatureUrl ? resolveSiteAssetUrl(signatureUrl) : null}
                onCommit={onSignatureCommit}
                onClear={() => {
                  setSignatureUrl('');
                  setSignaturePadKey((k) => k + 1);
                }}
                disabled={busy}
                busy={uploadingSignature}
              />
            </div>

            <label className="block rounded-[18px] border border-black/[0.06] bg-white px-3 py-2.5">
              <span className="text-[11px] font-semibold tracking-tight text-[#86868b]">
                Υπεύθυνος γραφείου
              </span>
              <input
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                placeholder="Όνομα υπαλλήλου"
                className="mt-1 w-full bg-transparent text-sm font-semibold tracking-tight text-[#1d1d1f] outline-none placeholder:font-normal placeholder:text-[#c7c7cc]"
              />
            </label>
          </div>

          <footer className="shrink-0 border-t border-black/[0.06] bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-5">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 rounded-full bg-[#f5f5f7] py-3 text-sm font-semibold tracking-tight text-[#1d1d1f] transition hover:bg-[#ebebed] disabled:opacity-45"
              >
                Άκυρο
              </button>
              <button
                type="submit"
                disabled={busy || uploadingPhoto || uploadingSignature}
                className={`flex-[1.4] inline-flex items-center justify-center gap-1.5 rounded-full py-3 text-sm font-semibold tracking-tight text-white transition disabled:opacity-45 ${
                  isReturn
                    ? 'bg-[#0071e3] hover:bg-[#0062c4]'
                    : 'bg-[#0a7a6c] hover:bg-[#08665b]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {busy ? 'progress_activity' : isReturn ? 'logout' : 'login'}
                </span>
                {busy ? 'Αποθήκευση…' : `Ολοκλήρωση ${label}`}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
