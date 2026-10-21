import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageDesignLivePreview from './PageDesignLivePreview.jsx';

const COLLAPSE_KEY = 'poreiago_page_design_nav_collapsed';
const LAYOUT_KEY = 'poreiago_page_design_layout_mode';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function readLayoutMode() {
  try {
    const v = localStorage.getItem(LAYOUT_KEY);
    if (v === 'editor' || v === 'preview' || v === 'split') return v;
  } catch {
    /* ignore */
  }
  // Desktop-first: Split on by default when the viewport is wide enough.
  if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1100px)').matches) {
    return 'split';
  }
  return 'editor';
}

export default function PageDesignWizardShell({
  designPage,
  activePageMeta,
  canSwitchPages,
  availablePages,
  contractBadge,
  officeMode,
  navSections,
  section,
  onSelectPage,
  onSelectSection,
  previewTo,
  previewLabel,
  previewSrc,
  previewPathLabel,
  siteLabel,
  brandName,
  openSiteHref,
  copyLinkHref,
  backOfficeTo = '/admin',
  saving = false,
  dirty = false,
  onSave,
  previewRefreshToken = 0,
  children,
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [layoutMode, setLayoutMode] = useState(readLayoutMode);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, layoutMode);
    } catch {
      /* ignore */
    }
  }, [layoutMode]);

  const heroClass =
    designPage === 'rent'
      ? 'page-design-wizard__hero is-rent'
      : 'page-design-wizard__hero';

  const showPreview = layoutMode === 'split' || layoutMode === 'preview';
  const showEditor = layoutMode === 'split' || layoutMode === 'editor';
  const activeSection = navSections.find((s) => s.id === section);
  const liveBadge = 'LIVE';
  const titleBrand = (brandName || '').trim() || siteLabel || 'Γραφείο';

  const copyLink = async () => {
    const href =
      copyLinkHref ||
      (typeof window !== 'undefined'
        ? `${window.location.origin}${String(openSiteHref || previewTo || '/').split('?')[0]}`
        : '');
    if (!href) return;
    try {
      await navigator.clipboard?.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  const iframeSrc =
    previewSrc ||
    (designPage === 'rent' ? '/rent?preview=1' : '/storefront?preview=1');

  return (
    <div
      className={[
        'page-design-wizard__studio',
        collapsed ? 'is-nav-collapsed' : '',
        `is-layout-${layoutMode}`,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="page-design-wizard__toolbar">
        <div className="page-design-wizard__toolbar-brand">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="page-design-wizard__toolbar-kicker">
                {designPage === 'rent' ? 'Σελίδα ενοικιάσεων' : 'Ιστοσελίδα γραφείου'}
              </p>
              <span className="page-design-wizard__live-badge">{liveBadge}</span>
            </div>
            <p className="page-design-wizard__toolbar-title truncate">{titleBrand}</p>
            <p className="page-design-wizard__toolbar-meta truncate">{contractBadge}</p>
          </div>
        </div>

        <div className="page-design-wizard__toolbar-actions">
          <Link to={backOfficeTo} className="page-design-wizard__tool-btn">
            <span className="material-symbols-outlined text-[18px]">home</span>
            <span className="hidden sm:inline">Back Office</span>
          </Link>

          <button
            type="button"
            className={`page-design-wizard__tool-btn${layoutMode === 'preview' ? ' is-active' : ''}`}
            onClick={() => setLayoutMode('preview')}
            aria-pressed={layoutMode === 'preview'}
            title="Πλήρης προεπισκόπηση"
          >
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            <span className="hidden sm:inline">Προεπισκόπηση</span>
          </button>

          <button
            type="button"
            className={`page-design-wizard__tool-btn${layoutMode === 'split' ? ' is-active' : ''}`}
            onClick={() => setLayoutMode((m) => (m === 'split' ? 'editor' : 'split'))}
            aria-pressed={layoutMode === 'split'}
            title="Split · επεξεργασία + ζωντανή προεπισκόπηση"
          >
            <span className="material-symbols-outlined text-[18px]">vertical_split</span>
            <span className="hidden sm:inline">Split</span>
          </button>

          <button
            type="button"
            className="page-design-wizard__tool-btn"
            onClick={copyLink}
            title="Αντιγραφή link"
          >
            <span className="material-symbols-outlined text-[18px]">
              {copied ? 'check' : 'link'}
            </span>
            <span className="hidden md:inline">{copied ? 'Αντιγράφηκε' : 'Αντιγραφή link'}</span>
          </button>

          <a
            href={openSiteHref || previewTo}
            target="_blank"
            rel="noreferrer"
            className="page-design-wizard__tool-btn"
            title={previewLabel || 'Άνοιγμα site'}
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            <span className="hidden md:inline">Άνοιγμα site</span>
          </a>

          <button
            type="button"
            className="page-design-wizard__tool-save"
            disabled={saving || !onSave}
            onClick={() => onSave?.()}
            title={dirty ? 'Αποθήκευση αλλαγών' : 'Αποθήκευση'}
          >
            <span className="material-symbols-outlined text-[18px]">
              {saving ? 'progress_activity' : 'save'}
            </span>
            {saving ? 'Αποθήκευση…' : dirty ? 'Αποθήκευση' : 'Αποθήκευση'}
          </button>
        </div>
      </header>

      <div
        className={`page-design-wizard__layout${collapsed ? ' is-nav-collapsed' : ''}${
          showPreview ? ' has-preview' : ''
        }`}
      >
        {collapsed && showEditor ? (
          <button
            type="button"
            className="page-design-wizard__nav-expand"
            onClick={() => setCollapsed(false)}
            title="Εμφάνιση μενού"
            aria-label="Εμφάνιση μενού σχεδιασμού"
          >
            <span className="material-symbols-outlined text-[20px]">menu_open</span>
            <span className="page-design-wizard__nav-expand-label">Μενού</span>
          </button>
        ) : null}

        {showEditor ? (
          <nav
            className={`page-design-wizard__sidebar${collapsed ? ' is-collapsed' : ''}`}
            aria-label="Βήματα σχεδιασμού"
            aria-hidden={collapsed || undefined}
          >
            <div className={heroClass}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="page-design-wizard__hero-kicker">Διαμόρφωση</p>
                  <span className="page-design-wizard__hero-badge">
                    <span className="material-symbols-outlined text-[12px]">layers</span>
                    {officeMode === 'both' ? '2 σελίδες' : '1 σελίδα'}
                  </span>
                </div>
                <button
                  type="button"
                  className="page-design-wizard__nav-collapse"
                  onClick={() => setCollapsed(true)}
                  title="Μάζεμα μενού — περισσότερος χώρος"
                  aria-label="Μάζεμα μενού σχεδιασμού"
                >
                  <span className="material-symbols-outlined text-[18px]">left_panel_close</span>
                </button>
              </div>
              <p className="page-design-wizard__hero-title">{activePageMeta.title}</p>
              <p className="page-design-wizard__hero-blurb">{activePageMeta.blurb}</p>
              <p className="mt-1.5 text-[11px] font-semibold text-white/60">{contractBadge}</p>

              {canSwitchPages ? (
                <div
                  className="page-design-wizard__page-tabs"
                  role="tablist"
                  aria-label="Σελίδα προς σχεδιασμό"
                >
                  {availablePages.map((p) => {
                    const active = designPage === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onSelectPage(p.id)}
                        className={`page-design-wizard__page-tab${active ? ' is-active' : ''}`}
                      >
                        <span className="page-design-wizard__page-tab-icon">
                          <span className="material-symbols-outlined text-[17px]">{p.icon}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold leading-tight">{p.label}</span>
                          <span
                            className={`block text-[11px] mt-0.5 leading-snug ${
                              active ? 'text-slate-500' : 'text-white/70'
                            }`}
                          >
                            {p.id === 'home' ? 'Αρχική εκδρομών' : 'App /rent'}
                          </span>
                        </span>
                        {active ? (
                          <span className="material-symbols-outlined text-[18px] text-emerald-600">
                            check_circle
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-xl bg-black/20 border border-white/10 px-3 py-2.5 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                    <span className="material-symbols-outlined text-[18px]">
                      {activePageMeta.icon}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{activePageMeta.label}</p>
                    <p className="text-[11px] text-white/70 mt-0.5">
                      Μόνο αυτή η σελίδα στο συμβόλαιό σου
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="page-design-wizard__nav">
              <p className="page-design-wizard__nav-group">Ιστοσελίδα</p>
              {navSections.map((s) => {
                const active = section === s.id;
                const accent = designPage === 'rent' ? 'teal' : 'violet';
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelectSection(s.id)}
                    data-accent={accent}
                    className={`page-design-wizard__nav-item${active ? ' is-active' : ''}`}
                  >
                    <span className="page-design-wizard__nav-icon">
                      <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                    </span>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </nav>
        ) : null}

        {showEditor ? (
          <div className="page-design-wizard__main">
            {activeSection ? (
              <div className="page-design-wizard__section-head">
                <div>
                  <h3 className="page-design-wizard__section-title">{activeSection.label}</h3>
                  <p className="page-design-wizard__section-hint">
                    Οι αλλαγές φαίνονται αμέσως στο Split · πάτα «Αποθήκευση» για μόνιμη εφαρμογή.
                  </p>
                </div>
                {layoutMode === 'editor' ? (
                  <button
                    type="button"
                    className="page-design-wizard__tool-btn"
                    onClick={() => setLayoutMode('split')}
                  >
                    <span className="material-symbols-outlined text-[18px]">vertical_split</span>
                    Split
                  </button>
                ) : null}
              </div>
            ) : null}
            {children}
          </div>
        ) : null}

        {showPreview ? (
          <PageDesignLivePreview
            previewSrc={iframeSrc}
            previewPathLabel={previewPathLabel}
            designPage={designPage}
            refreshToken={previewRefreshToken}
            expanded={layoutMode === 'preview'}
          />
        ) : null}

        {layoutMode === 'preview' ? (
          <button
            type="button"
            className="page-design-wizard__exit-preview"
            onClick={() => setLayoutMode('split')}
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Επιστροφή στην επεξεργασία
          </button>
        ) : null}
      </div>
    </div>
  );
}
