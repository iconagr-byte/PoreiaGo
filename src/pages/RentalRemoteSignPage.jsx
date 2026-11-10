/**
 * Public contactless signing portal — /sign/:token (client's phone).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  RENTAL_CHECKOUT_TERMS,
  allCheckoutTermsAccepted,
  emptyCheckoutAcceptances,
} from '../lib/rental/rentalCheckoutTerms.js';
import { fetchRentSignSession, submitRentSign } from '../services/rentSignPublicApi.js';
import { resolveSiteAssetUrl } from '../services/siteAppearanceApi.js';
import RentalSignaturePad from '../components/admin/fleet/RentalSignaturePad.jsx';
import RentalTermsModal from '../components/admin/fleet/RentalTermsModal.jsx';

function euro(n) {
  if (n == null || n === '') return '—';
  return `€${Number(n).toLocaleString('el-GR', { maximumFractionDigits: 2 })}`;
}

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

export default function RentalRemoteSignPage() {
  const { token } = useParams();
  const padRef = useRef(null);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [accept, setAccept] = useState(() => emptyCheckoutAcceptances());
  const [hasInk, setHasInk] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchRentSignSession(token)
      .then((data) => {
        if (cancelled) return;
        setSession(data);
        if (data.status === 'already_signed') setDone(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Μη έγκυρος σύνδεσμος');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const canSubmit = useMemo(
    () => allCheckoutTermsAccepted(accept) && hasInk && !busy && !done,
    [accept, hasInk, busy, done],
  );

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      const file = await padRef.current?.getFile?.();
      if (!file) throw new Error('Απαιτείται υπογραφή');
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Αποτυχία ανάγνωσης υπογραφής'));
        reader.readAsDataURL(file);
      });
      await submitRentSign(token, {
        signature_base64: dataUrl,
        signer_name: session?.client_name,
        accepted_terms: RENTAL_CHECKOUT_TERMS.filter((t) => accept[t.id]).map((t) => t.id),
        fuel_level: 75,
        summary: {
          vehicle: `${session?.vehicle_model || ''} (${session?.vehicle_plate || ''})`,
          office_name: session?.office_hint || 'PoreiaGo Rent',
        },
      });
      setDone(true);
    } catch (err) {
      setError(err.message || 'Αποτυχία υπογραφής');
    } finally {
      setBusy(false);
    }
  };

  const photo = resolveSiteAssetUrl(session?.vehicle_photo_url);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-teal-50/40 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-white">
            <span className="material-symbols-outlined">draw</span>
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700/80">
              PoreiaGo Rent
            </p>
            <h1 className="font-bold text-base">Υπογραφή σύμβασης</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-28">
        {loading ? (
          <div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">
            Φόρτωση…
          </div>
        ) : error && !session ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
            <p className="font-bold text-rose-900">Δεν είναι διαθέσιμο</p>
            <p className="text-sm text-rose-800 mt-2">{error}</p>
          </div>
        ) : done ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center space-y-2">
            <span className="material-symbols-outlined text-emerald-700 text-[40px]">
              check_circle
            </span>
            <p className="font-bold text-lg text-emerald-950">Η σύμβαση υπογράφηκε</p>
            <p className="text-sm text-emerald-900/80">
              Μπορείτε να κλείσετε αυτή τη σελίδα. Το γραφείο ενημερώθηκε αυτόματα.
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex gap-3">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                  {photo ? (
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined">directions_car</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">
                    {session.vehicle_model} ({session.vehicle_plate})
                  </p>
                  <p className="text-sm text-slate-600 mt-0.5">{session.client_name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatWhen(session.start_time)} → {formatWhen(session.end_time)}
                  </p>
                  <p className="text-sm font-bold mt-1">{euro(session.total_cost)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5">
              <h2 className="font-bold text-slate-900">Υποχρεωτικοί όροι</h2>
              {RENTAL_CHECKOUT_TERMS.map((term) => (
                <label
                  key={term.id}
                  className={`flex items-start gap-3 rounded-2xl border px-3 py-2.5 ${
                    accept[term.id] ? 'border-teal-300 bg-teal-50/50' : 'border-slate-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 rounded text-teal-700"
                    checked={Boolean(accept[term.id])}
                    onChange={() => setAccept((p) => ({ ...p, [term.id]: !p[term.id] }))}
                  />
                  <span className="text-sm text-slate-800 leading-relaxed">
                    {term.label}{' '}
                    {term.hasTermsModal ? (
                      <button
                        type="button"
                        className="text-teal-700 font-bold underline"
                        onClick={(e) => {
                          e.preventDefault();
                          setTermsOpen(true);
                        }}
                      >
                        Δες κείμενο
                      </button>
                    ) : null}
                  </span>
                </label>
              ))}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-bold text-slate-900 mb-2">Υπογραφή</h2>
              <RentalSignaturePad
                ref={padRef}
                embedded
                heightClass="h-44"
                watermark="Υπογράψτε εδώ..."
                onInkChange={setHasInk}
                disabled={busy}
              />
            </section>

            {error ? (
              <p className="text-sm font-semibold text-rose-700 text-center">{error}</p>
            ) : null}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto py-4 rounded-full bg-teal-700 text-white font-bold text-sm shadow-lg disabled:opacity-40"
            >
              {busy ? 'Αποστολή…' : 'ΟΛΟΚΛΗΡΩΣΗ ΥΠΟΓΡΑΦΗΣ'}
            </button>
          </>
        )}
      </main>

      <RentalTermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
    </div>
  );
}
