/**
 * Legal document pack UI — list, expand, sign, print for a rental booking.
 */
import { useMemo, useState } from 'react';
import { resolveSiteAssetUrl } from '../../../services/siteAppearanceApi.js';
import {
  uploadRentalInspectionPhoto,
  saveRentalLegalDocSignature,
} from '../../../services/fleetRentalApi.js';
import {
  LEGAL_PACK_DISCLAIMER,
  RENTAL_LEGAL_DOCS,
  isLegalDocSigned,
  legalDocSignature,
  legalPackProgress,
} from '../../../lib/rental/rentalLegalDocs.js';
import RentalSignaturePad from './RentalSignaturePad.jsx';

function formatWhen(iso) {
  if (!iso) return '';
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

export default function RentalLegalDocPack({
  booking,
  inspections = [],
  officeName = 'Γραφείο ενοικιάσεων',
  onBookingUpdated,
  onOpenCheckIn,
  onToast,
}) {
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [padKey, setPadKey] = useState(0);

  const progress = useMemo(
    () => legalPackProgress(booking, inspections),
    [booking, inspections],
  );

  if (!booking) return null;

  const saveBookingDoc = async (doc, file) => {
    setBusyId(doc.id);
    try {
      const uploaded = await uploadRentalInspectionPhoto(file);
      const updated = await saveRentalLegalDocSignature(booking.id, {
        docId: doc.id,
        signatureUrl: uploaded.url,
        signerName: booking.client_name,
      });
      onToast?.('success', `Υπογράφηκε: ${doc.shortTitle}`);
      onBookingUpdated?.(updated);
      setPadKey((k) => k + 1);
    } catch (err) {
      onToast?.('error', err?.message || 'Αποτυχία υπογραφής');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-3 print:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h4 className="font-bold text-gray-900">Νομικό πακέτο εγγράφων</h4>
          <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
            Όλα τα έντυπα που χρειάζονται για υπογραφή πριν την παράδοση — έτοιμα στον φάκελο
            κράτησης.
          </p>
          <p className="text-xs text-teal-800 font-semibold mt-1.5">
            Υπογεγραμμένα {progress.signedCount}/{progress.total}
            {progress.pickupReady ? ' · Παραλαβή: πλήρες' : ` · Παραλαβή ${progress.pickupSignedCount}/${progress.pickupTotal}`}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-gray-500 leading-relaxed print:hidden">{LEGAL_PACK_DISCLAIMER}</p>

      <div className="space-y-2">
        {RENTAL_LEGAL_DOCS.map((doc) => {
          const signed = isLegalDocSigned(doc, booking, inspections);
          const sig = legalDocSignature(doc, booking, inspections);
          const isOpen = openId === doc.id;
          const viaInspection = doc.source === 'inspection';

          return (
            <article
              key={doc.id}
              className={`rounded-2xl border bg-white overflow-hidden ${
                signed ? 'border-emerald-200' : 'border-black/[0.08]'
              }`}
            >
              <button
                type="button"
                className="w-full text-left px-4 py-3 flex flex-wrap items-start justify-between gap-2 print:hidden"
                onClick={() => setOpenId(isOpen ? null : doc.id)}
              >
                <div className="min-w-0">
                  <p className="font-bold text-sm text-gray-900">{doc.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{doc.summary}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      signed
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {signed ? 'Υπογεγραμμένο' : 'Έτοιμο για υπογραφή'}
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-gray-400">
                    {isOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
              </button>

              {/* Always visible when printing */}
              <div
                className={`${isOpen ? 'block' : 'hidden'} print:block border-t border-black/[0.05] px-4 py-4 space-y-4`}
              >
                <header className="hidden print:block border-b border-black/[0.08] pb-3 mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                    {officeName}
                  </p>
                  <h5 className="font-bold text-base text-gray-900 mt-0.5">{doc.title}</h5>
                  <p className="text-xs text-gray-500 mt-1">
                    Κράτηση {booking.id} · {booking.client_name}
                  </p>
                </header>

                <ol className="list-decimal pl-5 space-y-1.5 text-sm text-gray-700 leading-relaxed">
                  {doc.clauses.map((c) => (
                    <li key={c.slice(0, 48)}>{c}</li>
                  ))}
                </ol>

                <div className="rounded-xl border border-black/[0.08] p-3 space-y-2">
                  {signed && sig ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        Υπογραφή πελάτη
                      </p>
                      <img
                        src={resolveSiteAssetUrl(sig.signature_url)}
                        alt={`Υπογραφή ${doc.shortTitle}`}
                        className="max-h-24 w-auto bg-white border border-black/[0.06] rounded-lg"
                      />
                      <p className="text-xs text-gray-500">
                        {sig.signer_name ? `${sig.signer_name} · ` : ''}
                        {formatWhen(sig.signed_at)}
                        {sig.via === 'inspection' ? ' · μέσω check-in/out' : ''}
                      </p>
                    </div>
                  ) : viaInspection ? (
                    <div className="space-y-2 print:hidden">
                      <p className="text-sm text-amber-900 font-semibold">
                        Η υπογραφή γίνεται στο{' '}
                        {doc.inspectionType === 'RETURN_CHECK' ? 'Check-out' : 'Check-in'}.
                      </p>
                      {onOpenCheckIn ? (
                        <button
                          type="button"
                          className="px-3 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold"
                          onClick={() =>
                            onOpenCheckIn(
                              booking.id,
                              doc.inspectionType || 'PICKUP_CHECK',
                            )
                          }
                        >
                          Μετάβαση σε{' '}
                          {doc.inspectionType === 'RETURN_CHECK' ? 'Check-out' : 'Check-in'}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="print:hidden">
                      <RentalSignaturePad
                        key={`${doc.id}-${padKey}`}
                        busy={busyId === doc.id}
                        onCommit={(file) => saveBookingDoc(doc, file)}
                      />
                    </div>
                  )}
                  {!signed ? (
                    <p className="hidden print:block text-sm text-gray-500 italic">
                      ………………………………………… (υπογραφή πελάτη)
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
