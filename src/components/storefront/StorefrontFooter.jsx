import { Link } from 'react-router-dom';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import { officeLogoImageStyle, resolveOfficeBrand } from '../../lib/branding/officeBrand.js';
import { isTenantStorefrontHost } from '../../lib/platform/tenantHost.js';
import { resolveFooterContact } from '../../lib/storefront/footerContact.js';
import OfficeLoginLink from './OfficeLoginLink.jsx';
import '../../styles/storefront-footer.css';
import '../../styles/storefront-sections.css';

function FooterBrandBlock({ siteAppearance, tone = 'light', tagline = '' }) {
  const brand = resolveOfficeBrand(siteAppearance);
  const logoSrc = brand.hasLogo ? resolveSiteAssetUrl(brand.logoUrl) : '';
  const nameClass = tone === 'dark' ? 'text-white' : 'sf-footer__brand-name';
  const logoStyle = {
    ...officeLogoImageStyle(siteAppearance),
    height: `${Math.max(Math.min(brand.heightPx, 56), 36)}px`,
    maxWidth: `${Math.min(brand.maxWidthPx, 160)}px`,
  };

  return (
    <div>
      {logoSrc ? (
        <img src={logoSrc} alt={brand.name} style={logoStyle} className="mb-3 object-contain" />
      ) : (
        <p className={nameClass}>{brand.name}</p>
      )}
      {brand.displayName && logoSrc ? <p className={nameClass}>{brand.displayName}</p> : null}
      {tagline ? <p className="sf-footer__tagline">{tagline}</p> : null}
    </div>
  );
}

function ContactLines({ contact, tone = 'light' }) {
  const muted = tone === 'dark' ? 'text-white/70' : '';
  const iconTone = tone === 'dark' ? 'text-sky-300' : '';
  return (
    <div className="space-y-3">
      {contact.email ? (
        <p className={`sf-footer__contact-line ${muted}`}>
          <span className={`material-symbols-outlined ${iconTone}`} aria-hidden>
            mail
          </span>
          <Link to="/contact">{contact.email}</Link>
        </p>
      ) : null}
      {contact.phone ? (
        <p className={`sf-footer__contact-line ${muted}`}>
          <span className={`material-symbols-outlined ${iconTone}`} aria-hidden>
            call
          </span>
          <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>{contact.phone}</a>
        </p>
      ) : null}
      {contact.address ? (
        <p className={`sf-footer__contact-line ${muted}`}>
          <span className={`material-symbols-outlined ${iconTone}`} aria-hidden>
            location_on
          </span>
          <span>{contact.address}</span>
        </p>
      ) : null}
      {contact.hours ? (
        <p className={`sf-footer__contact-line ${muted}`}>
          <span className={`material-symbols-outlined ${iconTone}`} aria-hidden>
            schedule
          </span>
          <span>{contact.hours}</span>
        </p>
      ) : null}
      {!contact.email && !contact.phone && !contact.address && !contact.hours ? (
        <p className={`text-sm ${tone === 'dark' ? 'text-white/55' : 'text-slate-500'}`}>
          Συμπληρώστε στοιχεία επικοινωνίας από το Design της αρχικής.
        </p>
      ) : null}
      <p className="pt-1">
        <Link
          to="/contact"
          className={
            tone === 'dark'
              ? 'inline-flex items-center gap-1.5 text-sm font-bold text-sky-300 hover:text-sky-200'
              : 'inline-flex items-center gap-1.5 text-sm font-bold text-sky-700 hover:text-sky-800'
          }
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            edit_square
          </span>
          Φόρμα επικοινωνίας
        </Link>
      </p>
    </div>
  );
}

function SocialRow({ contact }) {
  if (!contact.facebook && !contact.instagram) return null;
  return (
    <div className="sf-footer__social" aria-label="Κοινωνικά δίκτυα">
      {contact.facebook ? (
        <a href={contact.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            public
          </span>
        </a>
      ) : null}
      {contact.instagram ? (
        <a href={contact.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            photo_camera
          </span>
        </a>
      ) : null}
    </div>
  );
}

function ExploreLinks({ tripsEnabled, rentEnabled, showFleet, className = '' }) {
  return (
    <ul className={`sf-footer__list ${className}`.trim()}>
      {tripsEnabled ? (
        <li>
          <a href="#search-results">Εκδρομές</a>
        </li>
      ) : null}
      {rentEnabled ? (
        <li>
          <Link to="/rent">Ενοικίαση</Link>
        </li>
      ) : null}
      {showFleet ? (
        <li>
          <a href="#our-fleet">Στόλος</a>
        </li>
      ) : null}
      {tripsEnabled ? (
        <li>
          <Link to="/my-booking">Η κράτησή μου</Link>
        </li>
      ) : null}
      <li>
        <Link to="/wallet">My Wallet</Link>
      </li>
      <li>
        <Link to="/contact">Επικοινωνία</Link>
      </li>
    </ul>
  );
}

function LegalLinks({ siteAppearance, className = '' }) {
  return (
    <ul className={`sf-footer__list ${className}`.trim()}>
      {siteAppearance.footer_privacy_label ? (
        <li>
          <a href={siteAppearance.footer_privacy_url || '#'}>{siteAppearance.footer_privacy_label}</a>
        </li>
      ) : null}
      {siteAppearance.footer_terms_label ? (
        <li>
          <a href={siteAppearance.footer_terms_url || '#'}>{siteAppearance.footer_terms_label}</a>
        </li>
      ) : null}
    </ul>
  );
}

function FooterOfficeLogin({ tone = 'light' }) {
  if (typeof window !== 'undefined' && !isTenantStorefrontHost()) {
    return null;
  }
  return <OfficeLoginLink variant={tone === 'dark' ? 'dark' : 'light'} density="footer" />;
}

export default function StorefrontFooter({
  siteAppearance,
  templateId = 'classic_columns',
  tripsEnabled = true,
  rentEnabled = false,
}) {
  const brand = resolveOfficeBrand(siteAppearance);
  const contact = resolveFooterContact(siteAppearance);
  const showFleet = tripsEnabled && siteAppearance?.show_fleet_section !== false;
  const tagline =
    String(siteAppearance.footer_tagline || '').trim() ||
    'Κράτηση θέσης, εισιτήρια και υποστήριξη γραφείου — σε μία σύγχρονη εμπειρία.';

  // Prefer the modern multi-column layout for classic + contact-forward templates.
  if (
    templateId === 'classic_columns' ||
    templateId === 'split_contact' ||
    !templateId
  ) {
    return (
      <footer id="contact" className="sf-footer">
        <div className="sf-footer__inner">
          <div className="sf-footer__grid">
            <div>
              <FooterBrandBlock siteAppearance={siteAppearance} tagline={tagline} />
              <SocialRow contact={contact} />
            </div>

            <div>
              <p className="sf-footer__heading">Πλοήγηση</p>
              <ExploreLinks
                tripsEnabled={tripsEnabled}
                rentEnabled={rentEnabled}
                showFleet={showFleet}
              />
            </div>

            <div>
              <p className="sf-footer__heading">Επικοινωνία</p>
              <ContactLines contact={contact} />
            </div>

            <div>
              <p className="sf-footer__heading">Νομικά</p>
              <LegalLinks siteAppearance={siteAppearance} />
            </div>
          </div>

          <div className="sf-footer__bottom">
            <p className="sf-footer__copy">
              {brand.copyright || `© ${new Date().getFullYear()} ${brand.name}`}
            </p>
            <div className="sf-footer__bottom-links">
              <Link to="/contact">Φόρμα επικοινωνίας</Link>
              <FooterOfficeLogin />
            </div>
          </div>
        </div>
      </footer>
    );
  }

  if (templateId === 'minimal_center') {
    return (
      <footer id="contact" className="scroll-mt-24 bg-surface-container-lowest py-16 border-t border-surface-container text-center">
        <div className="max-w-container-max mx-auto px-4 sm:px-margin-desktop flex flex-col items-center">
          <FooterBrandBlock siteAppearance={siteAppearance} tagline={tagline} />
          <div className="mt-8 max-w-md w-full text-left sm:text-center">
            <p className="sf-footer__heading sm:!text-center">Επικοινωνία</p>
            <ContactLines contact={contact} />
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-secondary">
            <LegalLinks siteAppearance={siteAppearance} className="!flex-row !gap-6" />
          </div>
          <div className="mt-8">
            <FooterOfficeLogin />
          </div>
        </div>
      </footer>
    );
  }

  if (templateId === 'dark_band') {
    return (
      <footer id="contact" className="scroll-mt-24 bg-slate-950 text-white py-16">
        <div className="max-w-container-max mx-auto px-4 sm:px-margin-desktop">
          <div className="grid md:grid-cols-3 gap-10">
            <div>
              <FooterBrandBlock siteAppearance={siteAppearance} tone="dark" tagline={tagline} />
              <SocialRow contact={contact} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-white/45 mb-3">
                Επικοινωνία
              </p>
              <ContactLines contact={contact} tone="dark" />
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-white/45 mb-3">
                  Πλοήγηση
                </p>
                <ExploreLinks
                  tripsEnabled={tripsEnabled}
                  rentEnabled={rentEnabled}
                  showFleet={showFleet}
                  className="[&_a]:text-white/80"
                />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-white/45 mb-3">
                  Νομικά
                </p>
                <LegalLinks siteAppearance={siteAppearance} className="[&_a]:text-white/80" />
              </div>
            </div>
          </div>
          <div className="mt-10 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/55">
              {brand.copyright || `© ${new Date().getFullYear()} ${brand.name}`}
            </p>
            <FooterOfficeLogin tone="dark" />
          </div>
        </div>
      </footer>
    );
  }

  if (templateId === 'newsletter_cta') {
    // CTA banner lives above the footer (NewsletterOfferBanner); keep contact only.
    return (
      <footer id="contact" className="scroll-mt-24 bg-gradient-to-b from-surface-container-lowest to-slate-100 border-t py-16">
        <div className="max-w-container-max mx-auto px-4 sm:px-margin-desktop">
          <div className="rounded-3xl bg-slate-900 text-white p-8 md:p-10 mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-xl font-bold mb-1">Μείνετε ενημερωμένοι</p>
              <p className="text-white/70 text-sm">Νέες εκδρομές και προσφορές στο inbox σας.</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input
                type="email"
                placeholder="email@example.com"
                className="flex-1 md:w-64 px-4 py-3 rounded-full text-slate-900 text-sm"
                readOnly
                aria-label="Newsletter email"
              />
              <button type="button" className="px-6 py-3 rounded-full bg-sky-500 font-bold text-sm shrink-0">
                Εγγραφή
              </button>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FooterBrandBlock siteAppearance={siteAppearance} tagline={tagline} />
            <div>
              <p className="sf-footer__heading">Επικοινωνία</p>
              <ContactLines contact={contact} />
            </div>
            <div>
              <p className="sf-footer__heading">Νομικά</p>
              <LegalLinks siteAppearance={siteAppearance} />
            </div>
          </div>
          <div className="mt-8 flex justify-end">
            <FooterOfficeLogin />
          </div>
        </div>
      </footer>
    );
  }

  if (templateId === 'compact_inline') {
    const logoSrc = brand.hasLogo ? resolveSiteAssetUrl(brand.logoUrl) : '';
    const logoStyle = officeLogoImageStyle(siteAppearance);
    return (
      <footer id="contact" className="scroll-mt-24 bg-surface-container-low py-8 border-t">
        <div className="max-w-container-max mx-auto px-4 sm:px-margin-desktop space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-secondary">
            <div className="flex items-center gap-3 min-w-0">
              {logoSrc ? (
                <img src={logoSrc} alt={brand.name} style={logoStyle} className="object-contain" />
              ) : (
                <span className="font-bold text-on-surface">{brand.name}</span>
              )}
              {brand.copyright ? <span className="truncate">· {brand.copyright}</span> : null}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <LegalLinks siteAppearance={siteAppearance} className="!flex-row !gap-4" />
              <FooterOfficeLogin />
            </div>
          </div>
          <div className="pt-2 border-t border-black/[0.05]">
            <p className="sf-footer__heading">Επικοινωνία</p>
            <ContactLines contact={contact} />
          </div>
        </div>
      </footer>
    );
  }

  // Fallback → same modern classic
  return (
    <footer id="contact" className="sf-footer">
      <div className="sf-footer__inner">
        <div className="sf-footer__grid">
          <FooterBrandBlock siteAppearance={siteAppearance} tagline={tagline} />
          <div>
            <p className="sf-footer__heading">Πλοήγηση</p>
            <ExploreLinks tripsEnabled={tripsEnabled} rentEnabled={rentEnabled} showFleet={showFleet} />
          </div>
          <div>
            <p className="sf-footer__heading">Επικοινωνία</p>
            <ContactLines contact={contact} />
          </div>
          <div>
            <p className="sf-footer__heading">Νομικά</p>
            <LegalLinks siteAppearance={siteAppearance} />
          </div>
        </div>
        <div className="sf-footer__bottom">
          <p className="sf-footer__copy">
            {brand.copyright || `© ${new Date().getFullYear()} ${brand.name}`}
          </p>
          <FooterOfficeLogin />
        </div>
      </div>
    </footer>
  );
}
