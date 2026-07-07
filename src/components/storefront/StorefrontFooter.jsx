import { Link } from 'react-router-dom';

export default function StorefrontFooter({ siteAppearance, templateId = 'classic_columns' }) {
  const brand = siteAppearance.footer_brand_name || 'PoreiaGo';
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
      <Link
        to="/admin/login"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white font-bold hover:bg-gray-800 transition-all"
      >
        <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
        Admin Login
      </Link>
    </>
  );

  if (templateId === 'minimal_center') {
    return (
      <footer className="bg-surface-container-lowest py-16 border-t border-surface-container text-center">
        <div className="max-w-container-max mx-auto px-margin-desktop">
          <p className="font-headline-md font-bold text-on-surface mb-2">{brand}</p>
          <p className="text-secondary text-sm mb-8">{siteAppearance.footer_copyright}</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-secondary">{links}</div>
        </div>
      </footer>
    );
  }

  if (templateId === 'dark_band') {
    return (
      <footer className="bg-slate-950 text-white py-16">
        <div className="max-w-container-max mx-auto px-margin-desktop grid md:grid-cols-2 gap-10">
          <div>
            <p className="text-2xl font-bold mb-3">{brand}</p>
            <p className="text-white/60 text-sm">{siteAppearance.footer_copyright}</p>
            <div className="mt-6 space-y-1 text-sm text-white/70">{contact}</div>
          </div>
          <div className="flex flex-wrap gap-6 items-start md:justify-end text-sm text-white/80">{links}</div>
        </div>
      </footer>
    );
  }

  if (templateId === 'split_contact') {
    return (
      <footer className="bg-white border-t border-black/[0.06] py-14">
        <div className="max-w-container-max mx-auto px-margin-desktop grid md:grid-cols-3 gap-10">
          <div>
            <p className="font-bold text-xl text-on-surface mb-2">{brand}</p>
            <p className="text-sm text-secondary">{siteAppearance.footer_copyright}</p>
          </div>
          <div className="space-y-3 text-sm text-on-surface-variant">
            <p className="font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">contact_mail</span>
              Επικοινωνία
            </p>
            {contact}
          </div>
          <div className="flex flex-wrap gap-4 items-start text-sm text-secondary">{links}</div>
        </div>
      </footer>
    );
  }

  if (templateId === 'newsletter_cta') {
    return (
      <footer className="bg-gradient-to-b from-surface-container-lowest to-slate-100 border-t py-16">
        <div className="max-w-container-max mx-auto px-margin-desktop">
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
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p className="font-bold text-on-surface">{brand}</p>
              <p className="text-sm text-secondary mt-2">{siteAppearance.footer_copyright}</p>
            </div>
            <div className="flex flex-wrap gap-6 justify-start md:justify-end text-sm text-secondary">{links}</div>
          </div>
        </div>
      </footer>
    );
  }

  if (templateId === 'compact_inline') {
    return (
      <footer className="bg-surface-container-low py-6 border-t">
        <div className="max-w-container-max mx-auto px-margin-desktop flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-secondary">
          <p>
            <span className="font-bold text-on-surface">{brand}</span> · {siteAppearance.footer_copyright}
          </p>
          <div className="flex flex-wrap gap-4">{links}</div>
        </div>
      </footer>
    );
  }

  // classic_columns
  return (
    <footer className="bg-surface-container-lowest py-stack-lg border-t border-surface-container">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter px-margin-desktop max-w-container-max mx-auto">
        <div className="col-span-1">
          <div className="font-headline-md text-headline-md font-bold text-on-surface mb-4">{brand}</div>
          <p className="font-label-md text-label-md text-secondary mb-3">{siteAppearance.footer_copyright}</p>
          {(siteAppearance.footer_contact_email ||
            siteAppearance.footer_contact_phone ||
            siteAppearance.footer_address) && (
            <div className="space-y-1 text-sm text-secondary">{contact}</div>
          )}
        </div>
        <div className="col-span-1 md:col-span-3 flex flex-wrap justify-end items-center gap-x-8 gap-y-3 text-sm text-secondary">
          {links}
        </div>
      </div>
    </footer>
  );
}
