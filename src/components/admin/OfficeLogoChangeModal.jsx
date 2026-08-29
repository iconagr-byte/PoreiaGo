import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  clearSiteAsset,
  fetchAdminSiteAppearance,
  resolveSiteAssetUrl,
  updateSiteAppearance,
  uploadSiteAsset,
} from '../../services/siteAppearanceApi.js';
import { resolveOfficeBrand } from '../../lib/branding/officeBrand.js';

export const OFFICE_BRAND_CHANGED_EVENT = 'poreiago-office-brand-changed';

export function notifyOfficeBrandChanged() {
  try {
    window.dispatchEvent(new CustomEvent(OFFICE_BRAND_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

function appearanceFromAdminPayload(data) {
  if (!data || typeof data !== 'object') return {};
  if (data.data && typeof data.data === 'object' && !data.footer_brand_name && !data.logo_url) {
    return data.data;
  }
  return data;
}

/**
 * Quick logo + office name change from the admin sidebar brand («Γραφείο»).
 */
export default function OfficeLogoChangeModal({ open, onClose, onSaved }) {
  const inputRef = useRef(null);
  const brandNameRef = useRef('');
  const savedNameRef = useRef('');
  const appearanceRef = useRef({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [appearance, setAppearance] = useState({});
  const [brandName, setBrandName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    brandNameRef.current = brandName;
  }, [brandName]);

  useEffect(() => {
    savedNameRef.current = savedName;
  }, [savedName]);

  useEffect(() => {
    appearanceRef.current = appearance;
  }, [appearance]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    fetchAdminSiteAppearance()
      .then((data) => {
        if (cancelled) return;
        const next = appearanceFromAdminPayload(data);
        setAppearance(next);
        const name = String(next.footer_brand_name || next.rent_office_name || next.display_name || '').trim();
        setBrandName(name);
        setSavedName(name);
      })
      .catch(() => {
        if (!cancelled) toast.error('Αποτυχία φόρτωσης εμφάνισης');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const persistName = async ({ silent = false, closeAfter = false } = {}) => {
    const name = brandNameRef.current.trim();
    if (name === savedNameRef.current.trim()) {
      if (closeAfter) onClose?.();
      return true;
    }
    setBusy(true);
    try {
      const current = appearanceRef.current || {};
      const patch = { footer_brand_name: name };
      const rentName = String(current.rent_office_name || '').trim();
      const prevFooter = String(current.footer_brand_name || '').trim();
      // Keep /rent brand in sync when unused or previously mirrored.
      if (!rentName || rentName === prevFooter || rentName === savedNameRef.current.trim()) {
        patch.rent_office_name = name;
      }
      const saved = await updateSiteAppearance(patch);
      const next = appearanceFromAdminPayload(saved?.data) || {
        ...current,
        ...patch,
      };
      setAppearance(next);
      appearanceRef.current = next;
      setSavedName(name);
      savedNameRef.current = name;
      notifyOfficeBrandChanged();
      onSaved?.();
      if (!silent) {
        if (saved?.offline) {
          toast.success('Αποθηκεύτηκε τοπικά — θα συγχρονιστεί όταν συνδεθεί ο server');
        } else {
          toast.success('Το όνομα γραφείου αποθηκεύτηκε');
        }
      }
      if (closeAfter) onClose?.();
      return true;
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
      return false;
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = async (e) => {
      if (e.key === 'Escape') {
        await persistName({ silent: true, closeAfter: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // persistName reads refs — stable enough for this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);

  if (!open) return null;

  const brand = resolveOfficeBrand(appearance);
  const logoSrc = brand.hasLogo ? resolveSiteAssetUrl(brand.logoUrl) : '';
  const label = brandName.trim() || brand.displayName || brand.name || 'Γραφείο';
  const nameDirty = brandName.trim() !== savedName.trim();

  const requestClose = async () => {
    await persistName({ silent: !nameDirty, closeAfter: true });
  };

  const onFile = async (file) => {
    if (!file) return;
    // Persist pending name first so a logo-only click does not drop the rename.
    await persistName({ silent: true });
    setBusy(true);
    try {
      const result = await uploadSiteAsset('logo', file);
      const url = result?.url;
      if (!url) throw new Error('Δεν επιστράφηκε URL από τον server');
      let next = {
        ...(appearanceRef.current || {}),
        ...(result?.appearance || {}),
        logo_url: url,
      };
      // If server saved the file but failed to write settings_json, attach URL lightly.
      if (result?.persist_warning) {
        try {
          const saved = await updateSiteAppearance({ logo_url: url });
          next = {
            ...next,
            ...(appearanceFromAdminPayload(saved?.data) || {}),
            logo_url: url,
          };
        } catch {
          /* still show the uploaded file URL */
        }
      }
      setAppearance(next);
      appearanceRef.current = next;
      notifyOfficeBrandChanged();
      onSaved?.();
      toast.success('Το λογότυπο ενημερώθηκε');
    } catch (err) {
      const msg = String(err.message || '');
      if (/internal server error|σφάλμα server/i.test(msg)) {
        toast.error('Σφάλμα server στο ανέβασμα — δοκιμάστε JPG/PNG έως 2MB');
      } else {
        toast.error(msg || 'Αποτυχία ανεβάσματος');
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onClear = async () => {
    setBusy(true);
    try {
      const result = await clearSiteAsset('logo');
      const next = result?.appearance || { ...appearanceRef.current, logo_url: '' };
      setAppearance(next);
      appearanceRef.current = next;
      notifyOfficeBrandChanged();
      onSaved?.();
      toast.success('Το λογότυπο αφαιρέθηκε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία διαγραφής');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-900/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Αλλαγή λογοτύπου"
      onClick={async (e) => {
        if (e.target === e.currentTarget) await requestClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-t-[24px] sm:rounded-[24px] bg-white shadow-2xl border border-black/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3 bg-gradient-to-br from-slate-50 to-white">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Εμφάνιση γραφείου
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Λογότυπο & όνομα</h2>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">
              Εμφανίζεται στο admin sidebar, storefront και Rent app.
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Κλείσιμο"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Φόρτωση…</p>
          ) : (
            <>
              <div
                className={`rounded-2xl border border-dashed p-6 flex flex-col items-center justify-center gap-3 min-h-[140px] transition ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50/70'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer?.files?.[0];
                  if (file) onFile(file);
                }}
              >
                {logoSrc ? (
                  <img
                    src={logoSrc}
                    alt={label}
                    className="max-h-16 max-w-[220px] object-contain"
                  />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white text-lg font-bold">
                    {(label || 'Γ').charAt(0).toUpperCase()}
                  </span>
                )}
                <p className="text-sm font-bold text-slate-800">{label}</p>
                <p className="text-xs text-slate-400 text-center">
                  Σύρε εικόνα εδώ ή επίλεξε αρχείο (PNG / JPG / WebP)
                </p>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Όνομα εταιρείας / γραφείου</span>
                <input
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  onBlur={() => {
                    if (brandName.trim() !== savedName.trim()) {
                      persistName({ silent: false });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      persistName({ silent: false });
                    }
                  }}
                  placeholder="π.χ. Achillio Travel"
                  disabled={busy}
                />
                <span className="mt-1 block text-[11px] text-slate-400">
                  Αποθηκεύεται αυτόματα όταν φύγεις από το πεδίο ή πατήσεις Enter.
                </span>
              </label>

              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">upload</span>
                  {busy ? 'Αποθήκευση…' : logoSrc ? 'Αλλαγή λογοτύπου' : 'Ανέβασμα λογοτύπου'}
                </button>
                {logoSrc ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onClear}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-rose-200 bg-white text-rose-700 text-sm font-bold disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                    Αφαίρεση
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy || !nameDirty}
                  onClick={() => persistName({ silent: false })}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold disabled:opacity-50 ${
                    nameDirty
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  {nameDirty ? 'Αποθήκευση ονόματος' : 'Αποθηκευμένο'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
