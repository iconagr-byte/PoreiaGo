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
import '../../styles/office-logo-modal.css';

export const OFFICE_BRAND_CHANGED_EVENT = 'poreiago-office-brand-changed';

export function notifyOfficeBrandChanged(patch = null) {
  try {
    window.dispatchEvent(
      new CustomEvent(OFFICE_BRAND_CHANGED_EVENT, {
        detail: patch && typeof patch === 'object' ? patch : null,
      }),
    );
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
 * Apple-minimal sheet: soft blur, SF-style type, auto-save name, drag/click upload.
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
      notifyOfficeBrandChanged({
        logo_url: url,
        footer_brand_name: next.footer_brand_name || brandNameRef.current,
        rent_office_name: next.rent_office_name,
        tenant_slug: next.tenant_slug,
        logo_height_px: next.logo_height_px,
        logo_max_width_px: next.logo_max_width_px,
        logo_show_name: next.logo_show_name,
      });
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
      notifyOfficeBrandChanged({
        logo_url: '',
        footer_brand_name: next.footer_brand_name,
        tenant_slug: next.tenant_slug,
      });
      onSaved?.();
      toast.success('Το λογότυπο αφαιρέθηκε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία διαγραφής');
    } finally {
      setBusy(false);
    }
  };

  const openPicker = () => {
    if (busy) return;
    inputRef.current?.click();
  };

  return (
    <div className="olm-root" role="dialog" aria-modal="true" aria-label="Αλλαγή λογοτύπου">
      <button type="button" className="olm-backdrop" aria-label="Κλείσιμο" onClick={requestClose} />
      <div className="olm-panel">
        <header className="olm-header">
          <div>
            <p className="olm-kicker">Εμφάνιση γραφείου</p>
            <h2 className="olm-title">Λογότυπο & όνομα</h2>
            <p className="olm-subtitle">Sidebar, storefront και Rent app.</p>
          </div>
          <button type="button" className="olm-close" onClick={requestClose} aria-label="Κλείσιμο">
            <span className="material-symbols-outlined" aria-hidden>
              close
            </span>
          </button>
        </header>

        <div className="olm-body">
          {loading ? (
            <p className="olm-loading">Φόρτωση…</p>
          ) : (
            <>
              <div
                role="button"
                tabIndex={0}
                className={`olm-drop${dragOver ? ' is-over' : ''}${busy ? ' is-busy' : ''}`}
                onClick={openPicker}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openPicker();
                  }
                }}
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
                  <img src={logoSrc} alt={label} className="olm-logo-img" />
                ) : (
                  <span className="olm-avatar" aria-hidden>
                    {(label || 'Γ').charAt(0).toUpperCase()}
                  </span>
                )}
                <p className="olm-brand-label">{label}</p>
                <p className="olm-hint">
                  {dragOver
                    ? 'Άφησε την εικόνα εδώ'
                    : 'Σύρε ή πάτα για ανέβασμα · PNG / JPG / WebP'}
                </p>
              </div>

              <label className="olm-field">
                <span className="olm-label">Όνομα εταιρείας / γραφείου</span>
                <input
                  className="olm-input"
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
                  autoComplete="organization"
                />
                <span className="olm-field-hint">Αυτόματη αποθήκευση στο blur ή Enter.</span>
              </label>

              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />

              <div className="olm-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={openPicker}
                  className="olm-btn olm-btn--primary"
                >
                  <span className="material-symbols-outlined" aria-hidden>
                    upload
                  </span>
                  {busy ? 'Αποθήκευση…' : logoSrc ? 'Αλλαγή' : 'Ανέβασμα'}
                </button>
                {logoSrc ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onClear}
                    className="olm-btn olm-btn--danger"
                  >
                    <span className="material-symbols-outlined" aria-hidden>
                      delete
                    </span>
                    Αφαίρεση
                  </button>
                ) : null}
                {nameDirty ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => persistName({ silent: false })}
                    className="olm-btn olm-btn--ghost"
                  >
                    Αποθήκευση
                  </button>
                ) : (
                  <span className="olm-status is-ok" aria-live="polite">
                    <span className="material-symbols-outlined" aria-hidden>
                      check_circle
                    </span>
                    Αποθηκευμένο
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
