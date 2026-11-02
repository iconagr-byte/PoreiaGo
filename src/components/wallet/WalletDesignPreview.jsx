/**
 * Design-studio preview for My Wallet «Αρχική».
 * Loaded at /wallet?preview=1 — no customer login required.
 */
import { useEffect, useMemo, useState } from 'react';
import OfficeBrandMark from '../storefront/OfficeBrandMark.jsx';
import WalletStartFeed from './WalletStartFeed.jsx';
import {
  DEFAULT_SITE_APPEARANCE,
  fetchSiteAppearance,
} from '../../services/siteAppearanceApi.js';
import {
  isStorefrontPreviewMode,
  readHomepagePreviewDraft,
  subscribeHomepagePreviewDraft,
} from '../../lib/homepage/homepagePreview.js';
import { resolveOfficeBrand } from '../../lib/branding/officeBrand.js';
import { useRentMobile, useRentPhone } from '../../lib/rental/rentDevice.js';
import '../../styles/wallet-pass.css';

const PREVIEW_TABS = [
  { id: 'home', label: 'Αρχική', icon: 'home' },
  { id: 'pass', label: 'Εισιτήριο', icon: 'confirmation_number' },
  { id: 'bookings', label: 'Κρατήσεις', icon: 'event_note' },
  { id: 'more', label: 'Περισσότερα', icon: 'travel_explore' },
];

function mergeAppearance(base, draft) {
  if (!draft || typeof draft !== 'object') return base || DEFAULT_SITE_APPEARANCE;
  return { ...(base || DEFAULT_SITE_APPEARANCE), ...draft };
}

export default function WalletDesignPreview() {
  const isMobile = useRentMobile();
  const isPhone = useRentPhone();
  const isDesktop = !isMobile;
  const [liveAppearance, setLiveAppearance] = useState(DEFAULT_SITE_APPEARANCE);
  const [draft, setDraft] = useState(() =>
    isStorefrontPreviewMode() ? readHomepagePreviewDraft() : null,
  );

  useEffect(() => {
    document.documentElement.dataset.walletSurface = isPhone
      ? 'phone'
      : isDesktop
        ? 'desktop'
        : 'tablet';
    return () => {
      delete document.documentElement.dataset.walletSurface;
    };
  }, [isPhone, isDesktop]);

  useEffect(() => {
    let cancelled = false;
    fetchSiteAppearance()
      .then((data) => {
        if (!cancelled) setLiveAppearance(data || DEFAULT_SITE_APPEARANCE);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isStorefrontPreviewMode()) return undefined;
    setDraft(readHomepagePreviewDraft());
    return subscribeHomepagePreviewDraft((next) => setDraft(next));
  }, []);

  const appearance = useMemo(
    () => mergeAppearance(liveAppearance, draft),
    [liveAppearance, draft],
  );
  const officeBrand = useMemo(() => resolveOfficeBrand(appearance || {}), [appearance]);
  const brandLabel =
    officeBrand.displayName ||
    String(appearance?.footer_brand_name || appearance?.display_name || '').trim() ||
    'My Wallet';

  const stageClass = [
    'wallet-phone-stage',
    isPhone ? 'wallet-phone-stage--phone' : '',
    isDesktop ? 'wallet-phone-stage--desktop' : '',
    !isPhone && !isDesktop ? 'wallet-phone-stage--tablet' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={stageClass}
      data-wallet-device={isPhone ? 'phone' : isDesktop ? 'desktop' : 'tablet'}
      data-wallet-design-preview="1"
    >
      <div
        className={`wallet-app${
          isPhone ? ' wallet-app--phone' : isDesktop ? ' wallet-app--desktop' : ''
        }`}
      >
        <header className="wallet-topbar">
          <div className="wallet-topbar-brand" style={{ marginInline: 'auto' }}>
            <OfficeBrandMark
              className="h-8"
              variant="light"
              fallbackLabel={brandLabel}
              asLink={false}
            />
          </div>
        </header>

        <div className={isDesktop ? 'wallet-desktop-shell' : 'wallet-body-shell'}>
          {isDesktop ? (
            <nav className="wallet-nav wallet-nav--desktop" aria-label="My Wallet preview">
              {PREVIEW_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={tab.id === 'home' ? 'is-active' : ''}
                  tabIndex={-1}
                  aria-disabled="true"
                >
                  <span className="material-symbols-outlined" aria-hidden>
                    {tab.icon}
                  </span>
                  <span className="wallet-nav-label">{tab.label}</span>
                </button>
              ))}
            </nav>
          ) : null}

          <main className="wallet-main">
            {isDesktop ? (
              <div className="wallet-desktop-home">
                <div className="wallet-desktop-pass-col">
                  <WalletStartFeed
                    appearance={appearance}
                    officeName={brandLabel !== 'My Wallet' ? brandLabel : ''}
                  />
                </div>
                <aside className="wallet-desktop-rail" aria-label="Προεπισκόπηση">
                  <div className="wallet-desktop-rail-hello">
                    <p className="wallet-desktop-rail-kicker">Προεπισκόπηση</p>
                    <p className="wallet-desktop-rail-name">Αρχική Wallet</p>
                    <p className="wallet-desktop-rail-email">Χωρίς σύνδεση πελάτη</p>
                  </div>
                </aside>
              </div>
            ) : (
              <WalletStartFeed
                appearance={appearance}
                officeName={brandLabel !== 'My Wallet' ? brandLabel : ''}
              />
            )}
          </main>

          {!isDesktop ? (
            <nav
              className="wallet-nav"
              aria-label="My Wallet preview"
              style={{ '--wallet-nav-cols': PREVIEW_TABS.length }}
            >
              {PREVIEW_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={tab.id === 'home' ? 'is-active' : ''}
                  tabIndex={-1}
                  aria-disabled="true"
                >
                  <span className="material-symbols-outlined" aria-hidden>
                    {tab.icon}
                  </span>
                  <span className="wallet-nav-label">{tab.label}</span>
                </button>
              ))}
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}
