import { Link } from 'react-router-dom';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import { officeLogoImageStyle, resolveOfficeBrand } from '../../lib/branding/officeBrand.js';

function FooterBrandBlock({ siteAppearance, tone = 'light' }) {
  const brand = resolveOfficeBrand(siteAppearance);
  const logoSrc = brand.hasLogo ? resolveSiteAssetUrl(brand.logoUrl) : '';
  const nameClass = tone === 'dark' ? 'text-white' : 'text-on-surface';
  const copyClass = tone === 'dark' ? 'text-white/60' : 'text-secondary';
  const logoStyle = {
    ...officeLogoImageStyle(siteAppearance),
    // Footer reads a bit larger than header by default when unset height is small.
    height: `${Math.max(brand.heightPx, 36)}px`,
  };

  return (
    <div>
      {logoSrc ? (
        <img src={logoSrc} alt={brand.name} style={logoStyle} className="mb-4 object-contain" />
      ) : (
        <p className={`text-2xl font-bold mb-3 ${nameClass}`}>{brand.name}</p>
      )}
      {brand.displayName && logoSrc && (
        <p className={`font-bold text-lg mb-2 ${nameClass}`}>{brand.displayName}</p>
      )}
      {brand.copyright && <p className={`text-sm ${copyClass}`}>{brand.copyright}</p>}
    </div>
  );
}

function DiscreetOfficeLogin({ tone = 'light' }) {
  const className =
    tone === 'dark'
      ? 'text-[11px] font-medium text-white/35 hover:text-white/60 transition-colors'
      : 'text-[11px] font-medium text-secondary/55 hover:text-secondary transition-colors';
  return (
    <div className="mt-8 pt-4 border-t border-black/[0.04] flex justify-center sm:justify-end">
      <Link to="/admin/login" className={className} title="Σύνδεση για το γραφείο">
        Σύνδεση γραφείου
      </Link>
    </div>
  );
}

export default function StorefrontFooter({ siteAppearance, templateId = 'classic_columns' }) {
  const contact = (
    <>
      {siteAppearance.footer_contact_email && (
        <p>
          <a href={`mailto:${siteAppearance.footer_contact_email}`} className="hover:underline">
            {siteAppearance.footer_contact_email}
          </a>
        </p>
      )}
      {siteAppearance.footer_contact_phone && (
        <p>
          <a href={`tel:${siteAppearance.footer_contact_phone.replace(/\s/g, '')}`} className="hover:underline">
            {siteAppearance.footer_contact_phone}
          </a>
        </p>
      )}
      {siteAppearance.footer_address && <p>{siteAppearance.footer_address}</p>}
    </>
  );

  const links = (
    <>
      {siteAppearance.footer_privacy_label && (
        <a href={siteAppearance.footer_privacy_url || '#'} className="hover:underline">
          {siteAppearance.footer_privacy_label}
        </a>
      )}
      {siteAppearance.footer_terms_label && (
        <a href={siteAppearance.footer_terms_url || '#'} className="hover:underline">
          {siteAppearance.footer_terms_label}
        </a>
      )}
    </>
  );

  if (templateId === 'minimal_center') {
    return (
      <footer id="contact" className="scroll-mt-24 bg-surface-container-lowest py-16 border-t border-surface-container text-center">
        <div className="max-w-container-max mx-auto px-margin-desktop flex flex-col items-center">
          <FooterBrandBlock siteAppearance={siteAppearance} />
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-secondary">{links}</div>
          <DiscreetOfficeLogin />
        </div>
      </footer>
    );
  }

  if (templateId === 'dark_band') {
    return (
      <footer id="contact" className="scroll-mt-24 bg-slate-950 text-white py-16">
        <div className="max-w-container-max mx-auto px-margin-desktop">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <FooterBrandBlock siteAppearance={siteAppearance} tone="dark" />
              <div className="mt-6 space-y-1 text-sm text-white/70">{contact}</div>
            </div>
            <div className="flex flex-wrap gap-6 items-start md:justify-end text-sm text-white/80">{links}</div>
          </div>
          <div className="mt-8 pt-4 border-t border-white/10 flex justify-center sm:justify-end">
            <Link
              to="/admin/login"
              className="text-[11px] font-medium text-white/35 hover:text-white/60 transition-colors"
              title="Σύνδεση για το γραφείο"
            >
              Σύνδεση γραφείου
            </Link>
          </div>
        </div>
      </footer>
    );
  }

  if (templateId === 'split_contact') {
    return (
      <footer id="contact" className="scroll-mt-24 bg-white border-t border-black/[0.06] py-14">
        <div className="max-w-container-max mx-auto px-margin-desktop">
          <div className="grid md:grid-cols-3 gap-10">
            <FooterBrandBlock siteAppearance={siteAppearance} />
            <div className="space-y-3 text-sm text-on-surface-variant">
              <p className="font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">contact_mail</span>
                Επικοινωνία
              </p>
              {contact}
            </div>
            <div className="flex flex-wrap gap-4 items-start text-sm text-secondary">{links}</div>
          </div>
          <DiscreetOfficeLogin />
        </div>
      </footer>
    );
  }

  if (templateId === 'newsletter_cta') {
    // CTA banner lives above the footer (NewsletterOfferBanner); keep contact only.
    return (
      <footer id="contact" className="scroll-mt-24 bg-surface-container-lowest border-t py-14">
        <div className="max-w-container-max mx-auto px-margin-desktop">
          <div className="grid md:grid-cols-2 gap-8">
            <FooterBrandBlock siteAppearance={siteAppearance} />
            <div className="flex flex-wrap gap-6 justify-start md:justify-end text-sm text-secondary">{links}</div>
          </div>
          <DiscreetOfficeLogin />
        </div>
      </footer>
    );
  }

  if (templateId === 'compact_inline') {
    const brand = resolveOfficeBrand(siteAppearance);
    const logoSrc = brand.hasLogo ? resolveSiteAssetUrl(brand.logoUrl) : '';
    const logoStyle = officeLogoImageStyle(siteAppearance);
    return (
      <footer id="contact" className="scroll-mt-24 bg-surface-container-low py-6 border-t">
        <div className="max-w-container-max mx-auto px-margin-desktop flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-secondary">
          <div className="flex items-center gap-3 min-w-0">
            {logoSrc ? (
              <img src={logoSrc} alt={brand.name} style={logoStyle} className="object-contain" />
            ) : (
              <span className="font-bold text-on-surface">{brand.name}</span>
            )}
            {brand.copyright && <span className="truncate">· {brand.copyright}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {links}
            <Link
              to="/admin/login"
              className="text-[11px] font-medium text-secondary/55 hover:text-secondary transition-colors"
              title="Σύνδεση για το γραφείο"
            >
              Σύνδεση γραφείου
            </Link>
          </div>
        </div>
      </footer>
    );
  }

  // classic_columns
  return (
    <footer id="contact" className="scroll-mt-24 bg-surface-container-lowest py-stack-lg border-t border-surface-container">
      <div className="px-margin-desktop max-w-container-max mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter">
          <div className="col-span-1">
            <FooterBrandBlock siteAppearance={siteAppearance} />
            {(siteAppearance.footer_contact_email ||
              siteAppearance.footer_contact_phone ||
              siteAppearance.footer_address) && (
              <div className="mt-4 space-y-1 text-sm text-secondary">{contact}</div>
            )}
          </div>
          <div className="col-span-1 md:col-span-3 flex flex-wrap justify-end items-center gap-x-8 gap-y-3 text-sm text-secondary">
            {links}
          </div>
        </div>
        <DiscreetOfficeLogin />
      </div>
    </footer>
  );
}
