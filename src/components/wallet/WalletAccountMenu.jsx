import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

function customerInitials(name, email) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0].length) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const local = String(email || '').split('@')[0] || '';
  return (local.slice(0, 2) || 'Π').toUpperCase();
}

/**
 * Prefer a real customer photo; skip Google’s generated letter tiles (crude
 * colored circle + single glyph) in favor of office logo / brand monogram.
 */
function isGeneratedLetterAvatar(url) {
  const u = String(url || '');
  if (!u) return false;
  // Google default / letter avatars are served from googleusercontent with
  // no path that looks like an uploaded photo filename — still hard to detect.
  // Heuristic: tiny default tiles often include `=s64-c` / `=s96-c` only; we
  // still allow them if no office logo — monogram is preferred via caller.
  return /googleusercontent\.com/i.test(u) && /[=/]s(32|48|64|96)-c\b/i.test(u);
}

function WalletAvatarFace({
  src,
  kind,
  initials,
  size = 'sm',
  className = '',
}) {
  const [broken, setBroken] = useState(false);
  const showImg = Boolean(src) && !broken;

  return (
    <span
      className={`wallet-avatar-face wallet-avatar-face--${size} wallet-avatar-face--${
        showImg ? kind : 'mono'
      } ${className}`.trim()}
      aria-hidden
    >
      {showImg ? (
        <img
          src={src}
          alt=""
          className="wallet-avatar-face-img"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="wallet-avatar-face-mono">{initials}</span>
      )}
    </span>
  );
}

/**
 * Wallet top-left account control — Apple-like sheet with identity + security.
 * Rent lives on /rent (not in this menu).
 */
export default function WalletAccountMenu({
  profile,
  officeLogoUrl = '',
  officeName = '',
  onOpenAccount,
  onOpenSecurity,
  onOpenLostFound,
  onLogout,
}) {
  const menuId = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus?.();
      }
    };
    // pointerdown covers mouse + touch (native Capacitor).
    document.addEventListener('pointerdown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Lift .wallet-app stacking so the sheet stays above ticket peeks (Capacitor WebView).
  useEffect(() => {
    const app = rootRef.current?.closest?.('.wallet-app');
    if (!app) return undefined;
    if (open) app.classList.add('wallet-app--account-open');
    else app.classList.remove('wallet-app--account-open');
    return () => app.classList.remove('wallet-app--account-open');
  }, [open]);

  const go = (fn) => {
    setOpen(false);
    fn?.();
  };

  const name = profile?.name || 'Πελάτης';
  const email = profile?.email || '';
  const initials = useMemo(() => customerInitials(name, email), [name, email]);
  const resolvedLogo = useMemo(
    () => resolveSiteAssetUrl(officeLogoUrl) || '',
    [officeLogoUrl],
  );
  const rawPicture = String(profile?.picture || '').trim();
  // Skip Google’s generated letter tiles (crude colored circle + glyph).
  const pictureOk = Boolean(rawPicture) && !isGeneratedLetterAvatar(rawPicture);

  // Sheet identity: prefer the person (photo), else office logo, else monogram.
  // Topbar trigger stays a person icon (user request).
  const sheetSrc = pictureOk ? rawPicture : resolvedLogo || '';
  const sheetKind = pictureOk ? 'photo' : resolvedLogo ? 'logo' : 'mono';
  const brandLabel = String(officeName || '').trim();

  return (
    <div className={`wallet-topbar-menu${open ? ' is-open' : ''}`} ref={rootRef}>
      {open ? (
        <button
          type="button"
          className="wallet-account-scrim"
          aria-label="Κλείσιμο μενού"
          tabIndex={-1}
          onClick={() => setOpen(false)}
        />
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        className={`wallet-topbar-btn wallet-topbar-btn--account${open ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={email ? `Λογαριασμός · ${name} · ${email}` : `Λογαριασμός · ${name}`}
        title={email || name}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="material-symbols-outlined wallet-topbar-person" aria-hidden>
          person
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Λογαριασμός"
          className="wallet-account-sheet wallet-topbar-popover--start"
        >
          <div className="wallet-account-sheet-identity">
            <WalletAvatarFace
              src={sheetSrc}
              kind={sheetKind}
              initials={initials}
              size="lg"
            />
            <div className="wallet-account-sheet-identity-text">
              <p className="wallet-account-sheet-name">{name}</p>
              {email ? <p className="wallet-account-sheet-email">{email}</p> : null}
              {brandLabel ? (
                <p className="wallet-account-sheet-office">{brandLabel}</p>
              ) : null}
            </div>
          </div>

          <div className="wallet-account-sheet-section" role="group" aria-label="Λογαριασμός">
            <p className="wallet-account-sheet-section-label">Λογαριασμός</p>
            <button
              type="button"
              role="menuitem"
              className="wallet-account-sheet-item"
              onClick={() => go(onOpenAccount)}
            >
              <span className="wallet-account-sheet-item-icon" aria-hidden>
                <span className="material-symbols-outlined">manage_accounts</span>
              </span>
              <span className="wallet-account-sheet-item-body">
                <span className="wallet-account-sheet-item-label">Προφίλ</span>
                <span className="wallet-account-sheet-item-hint">Στοιχεία και σύνδεση</span>
              </span>
              <span className="material-symbols-outlined wallet-account-sheet-chevron" aria-hidden>
                chevron_right
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="wallet-account-sheet-item"
              onClick={() => go(() => onOpenSecurity?.())}
            >
              <span className="wallet-account-sheet-item-icon is-mint" aria-hidden>
                <span className="material-symbols-outlined">shield</span>
              </span>
              <span className="wallet-account-sheet-item-body">
                <span className="wallet-account-sheet-item-label">Ασφάλεια</span>
                <span className="wallet-account-sheet-item-hint">
                  Βιομετρικά, PIN, κωδικός, email
                </span>
              </span>
              <span className="material-symbols-outlined wallet-account-sheet-chevron" aria-hidden>
                chevron_right
              </span>
            </button>
          </div>

          <div className="wallet-account-sheet-section" role="group" aria-label="Υποστήριξη">
            <p className="wallet-account-sheet-section-label">Υποστήριξη</p>
            <button
              type="button"
              role="menuitem"
              className="wallet-account-sheet-item"
              onClick={() => go(onOpenLostFound)}
            >
              <span className="wallet-account-sheet-item-icon is-sunset" aria-hidden>
                <span className="material-symbols-outlined">support_agent</span>
              </span>
              <span className="wallet-account-sheet-item-body">
                <span className="wallet-account-sheet-item-label">Απωλεσθέντα</span>
                <span className="wallet-account-sheet-item-hint">Δήλωση αντικειμένου</span>
              </span>
              <span className="material-symbols-outlined wallet-account-sheet-chevron" aria-hidden>
                chevron_right
              </span>
            </button>
          </div>

          <div className="wallet-account-sheet-footer">
            <button
              type="button"
              role="menuitem"
              className="wallet-account-sheet-item is-danger"
              onClick={() => go(onLogout)}
            >
              <span className="wallet-account-sheet-item-icon is-danger" aria-hidden>
                <span className="material-symbols-outlined">logout</span>
              </span>
              <span className="wallet-account-sheet-item-body">
                <span className="wallet-account-sheet-item-label">Έξοδος</span>
                <span className="wallet-account-sheet-item-hint">Αποσύνδεση από τη συσκευή</span>
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
