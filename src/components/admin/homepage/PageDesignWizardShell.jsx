import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageDesignLivePreview from './PageDesignLivePreview.jsx';

const COLLAPSE_KEY = 'poreiago_page_design_nav_collapsed';
const LAYOUT_KEY = 'poreiago_page_design_layout_mode';
const HINT_KEY = 'poreiago_page_design_hint_dismissed';
const SPLIT_MIN = 1100;

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
  if (typeof window !== 'undefined' && window.matchMedia(`(min-width: ${SPLIT_MIN}px)`).matches) {
    return 'split';
  }
  return 'editor';
}

function readHintDismissed() {
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function useWideEnoughForSplit() {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(`(min-width: ${SPLIT_MIN}px)`).matches
      : true,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia(`(min-width: ${SPLIT_MIN}px)`);
    const onChange = () => setWide(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  return wide;
}

/** Group labels for clearer left-nav hierarchy (structure only). */
function sectionGroup(id, designPage) {
  if (designPage === 'rent') {
    if (id === 'overview') return null;
    if (id === 'themes' || id === 'fleet') return 'Εμφάνιση';
    if (id === 'branding' || id === 'copy') return 'Μάρκα';
    if (id === 'slider') return 'Περιεχόμενο';
    return 'Ιστοσελίδα';
  }
  if (id === 'overview') return null;
  if (id === 'themes' || id === 'general' || id === 'header' || id === 'hero') return 'Εμφάνιση';
  if (id === 'slider' || id === 'trips') return 'Περιεχόμενο';
  if (id === 'branding' || id === 'footer') return 'Μάρκα';
  return 'Ιστοσελίδα';
}

const SECTION_HINTS = {
  overview: 'Σύνοψη των ενεργών προτύπων διάταξης.',
  themes: 'Διάλεξε θέμα · το Split δείχνει live. Πλήρης οθόνη από «Επισκόπηση».',
  general: 'Χρώματα brand και ποιες ενότητες εμφανίζονται στην αρχική.',
  header: 'Πρότυπο κορυφής — λογότυπο, μενού, στυλ.',
  hero: 'Η πρώτη εντύπωση: φωτογραφία, τίτλοι, αναζήτηση.',
  slider: 'Carousel διαφανειών πάνω από ή αντί για το στατικό hero.',
  trips: 'Διάταξη λίστας και στυλ καρτών εκδρομών.',
  branding: 'Επωνυμία γραφείου, λογότυπο και hero εικόνα.',
  footer: 'Υποσέλιδο, επικοινωνία και νομικοί σύνδεσμοι.',
  copy: 'Όνομα και κείμενα της σελίδας /rent.',
  fleet: 'Διάταξη και στυλ καρτών στόλου ενοικίασης.',
};

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
  const [hintDismissed, setHintDismissed] = useState(readHintDismissed);
  const [narrowPreviewOpen, setNarrowPreviewOpen] = useState(false);
  const wideEnough = useWideEnoughForSplit();

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

  // Narrow screens: keep Split preference but fall back to editor + peek preview.
  const effectiveLayout = useMemo(() => {
    if (layoutMode === 'split' && !wideEnough) return 'editor';
    return layoutMode;
  }, [layoutMode, wideEnough]);

  const wantsSplitButNarrow = layoutMode === 'split' && !wideEnough;

  const heroClass =
    designPage === 'rent'
      ? 'page-design-wizard__hero is-rent'
      : 'page-design-wizard__hero';

  const showPreview =
    effectiveLayout === 'split' ||
    effectiveLayout === 'preview' ||
    (wantsSplitButNarrow && narrowPreviewOpen);
  const showEditor = effectiveLayout === 'split' || effectiveLayout === 'editor';
  const activeSection = navSections.find((s) => s.id === section);
  const activeIndex = Math.max(
    0,
    navSections.findIndex((s) => s.id === section),
  );
  const prevSection = activeIndex > 0 ? navSections[activeIndex - 1] : null;
  const nextSection =
    activeIndex >= 0 && activeIndex < navSections.length - 1
      ? navSections[activeIndex + 1]
      : null;
  const liveBadge = 'LIVE';
  const titleBrand = (brandName || '').trim() || siteLabel || 'Γραφείο';
  const sectionHint =
    (activeSection && SECTION_HINTS[activeSection.id]) ||
    'Οι αλλαγές φαίνονται ζωντανά δεξιά. Αποθήκευση πάνω δεξιά για μόνιμη εφαρμογή.';

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

  const dismissHint = () => {
    setHintDismissed(true);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  let lastGroup = null;

  return (
    <div
      className={[
        'page-design-wizard__studio',
        collapsed ? 'is-nav-collapsed' : '',
        `is-layout-${effectiveLayout}`,
        wantsSplitButNarrow ? 'is-narrow-split' : '',
        narrowPreviewOpen ? 'is-narrow-preview-open' : '',
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
              <span className="page-design-wizard__live-badge" title="Ζωντανή προεπισκόπηση draft">
                {liveBadge}
              </span>
              {dirty ? (
                <span className="page-design-wizard__dirty-badge" title="Υπάρχουν μη αποθηκευμένες αλλαγές">
                  Μη αποθηκευμένα
                </span>
              ) : null}
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

          <div
            className="page-design-wizard__layout-toggle"
            role="group"
            aria-label="Διάταξη στούντιο"
          >
            <button
              type="button"
              className={`page-design-wizard__tool-btn${
                layoutMode === 'editor' || (wantsSplitButNarrow && !narrowPreviewOpen)
                  ? ' is-active'
                  : ''
              }`}
              onClick={() => {
                setLayoutMode('editor');
                setNarrowPreviewOpen(false);
              }}
              aria-pressed={layoutMode === 'editor'}
              title="Μόνο επεξεργασία"
            >
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              <span className="hidden lg:inline">Επεξεργασία</span>
            </button>

            <button
              type="button"
              className={`page-design-wizard__tool-btn${layoutMode === 'split' ? ' is-active' : ''}`}
              onClick={() => {
                setLayoutMode('split');
                if (!wideEnough) setNarrowPreviewOpen(true);
              }}
              aria-pressed={layoutMode === 'split'}
              title={
                wideEnough
                  ? 'Split · επεξεργασία + ζωντανή προεπισκόπηση'
                  : 'Split · σε στενή οθόνη ανοίγει προεπισκόπηση από κάτω'
              }
            >
              <span className="material-symbols-outlined text-[18px]">vertical_split</span>
              <span className="hidden sm:inline">Split</span>
            </button>

            <button
              type="button"
              className={`page-design-wizard__tool-btn${layoutMode === 'preview' ? ' is-active' : ''}`}
              onClick={() => {
                setLayoutMode('preview');
                setNarrowPreviewOpen(false);
              }}
              aria-pressed={layoutMode === 'preview'}
              title="Πλήρης προεπισκόπηση"
            >
              <span className="material-symbols-outlined text-[18px]">visibility</span>
              <span className="hidden sm:inline">Προεπισκόπηση</span>
            </button>
          </div>

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
            className={`page-design-wizard__tool-save${dirty ? ' is-dirty' : ''}${
              !dirty && !saving ? ' is-clean' : ''
            }`}
            disabled={saving || !onSave || (!dirty && !saving)}
            onClick={() => onSave?.()}
            title={
              dirty
                ? 'Αποθήκευση όλων των αλλαγών'
                : 'Δεν υπάρχουν μη αποθηκευμένες αλλαγές'
            }
          >
            <span className="material-symbols-outlined text-[18px]">
              {saving ? 'progress_activity' : dirty ? 'save' : 'check'}
            </span>
            {saving ? 'Αποθήκευση…' : dirty ? 'Αποθήκευση' : 'Αποθηκευμένα'}
          </button>
        </div>
      </header>

      {wantsSplitButNarrow && !narrowPreviewOpen ? (
        <div className="page-design-wizard__narrow-banner" role="status">
          <span className="material-symbols-outlined text-[18px]">info</span>
          <p>
            Το Split χρειάζεται φαρδύτερη οθόνη. Επεξεργάζεσαι κανονικά — άνοιξε προεπισκόπηση όταν
            θέλεις.
          </p>
          <button
            type="button"
            className="page-design-wizard__tool-btn is-active"
            onClick={() => setNarrowPreviewOpen(true)}
          >
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            Προεπισκόπηση
          </button>
        </div>
      ) : null}

      {!hintDismissed ? (
        <div className="page-design-wizard__onboard" role="note">
          <span className="material-symbols-outlined text-[20px] text-[#0071e3]">lightbulb</span>
          <div className="min-w-0 flex-1">
            <p className="page-design-wizard__onboard-title">Γρήγορα βήματα</p>
            <p className="page-design-wizard__onboard-text">
              Αριστερά διάλεξε ενότητα · στη μέση επεξεργασία · δεξιά ζωντανή προεπισκόπηση. Η μπλε
              «Αποθήκευση» πάνω δεξιά αποθηκεύει τα πάντα· τα κουμπιά στις κάρτες αποθηκεύουν μόνο την
              ενότητα.
            </p>
          </div>
          <button
            type="button"
            className="page-design-wizard__onboard-dismiss"
            onClick={dismissHint}
            aria-label="Κλείσιμο υπόδειξης"
          >
            Κατάλαβα
          </button>
        </div>
      ) : null}

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
              {navSections.map((s, idx) => {
                const active = section === s.id;
                const accent = designPage === 'rent' ? 'teal' : 'violet';
                const group = sectionGroup(s.id, designPage);
                const showGroup = group && group !== lastGroup;
                if (showGroup) lastGroup = group;
                return (
                  <div key={s.id} className="page-design-wizard__nav-block">
                    {showGroup ? (
                      <p className="page-design-wizard__nav-group">{group}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onSelectSection(s.id)}
                      data-accent={accent}
                      className={`page-design-wizard__nav-item${active ? ' is-active' : ''}`}
                      title={SECTION_HINTS[s.id] || s.label}
                      aria-current={active ? 'step' : undefined}
                    >
                      <span className="page-design-wizard__nav-step" aria-hidden>
                        {idx + 1}
                      </span>
                      <span className="page-design-wizard__nav-icon">
                        <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                      </span>
                      <span className="page-design-wizard__nav-label">
                        <span className="page-design-wizard__nav-label-text">{s.label}</span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </nav>
        ) : null}

        {showEditor ? (
          <div className="page-design-wizard__main">
            {activeSection ? (
              <div className="page-design-wizard__section-head">
                <div className="min-w-0">
                  <p className="page-design-wizard__section-kicker">
                    Βήμα {activeIndex + 1} από {navSections.length}
                  </p>
                  <h3 className="page-design-wizard__section-title">{activeSection.label}</h3>
                  <p className="page-design-wizard__section-hint">{sectionHint}</p>
                  <p className="page-design-wizard__section-save-hint">
                    {dirty
                      ? 'Υπάρχουν αλλαγές — πάτα «Αποθήκευση» πάνω δεξιά για όλα, ή το κουμπί της ενότητας.'
                      : 'Οι αλλαγές φαίνονται αμέσως στο Split · αποθήκευση όταν είσαι έτοιμος.'}
                  </p>
                </div>
                <div className="page-design-wizard__section-nav">
                  <button
                    type="button"
                    className="page-design-wizard__tool-btn"
                    disabled={!prevSection}
                    onClick={() => prevSection && onSelectSection(prevSection.id)}
                    title={prevSection ? `Πίσω: ${prevSection.label}` : undefined}
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    <span className="hidden sm:inline">Πίσω</span>
                  </button>
                  <button
                    type="button"
                    className="page-design-wizard__tool-btn"
                    disabled={!nextSection}
                    onClick={() => nextSection && onSelectSection(nextSection.id)}
                    title={nextSection ? `Επόμενο: ${nextSection.label}` : undefined}
                  >
                    <span className="hidden sm:inline">Επόμενο</span>
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                  {effectiveLayout === 'editor' && wideEnough ? (
                    <button
                      type="button"
                      className="page-design-wizard__tool-btn is-active"
                      onClick={() => setLayoutMode('split')}
                    >
                      <span className="material-symbols-outlined text-[18px]">vertical_split</span>
                      Split
                    </button>
                  ) : null}
                </div>
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
            expanded={effectiveLayout === 'preview'}
            narrowOverlay={wantsSplitButNarrow && narrowPreviewOpen}
            onCloseNarrow={
              wantsSplitButNarrow && narrowPreviewOpen
                ? () => setNarrowPreviewOpen(false)
                : undefined
            }
          />
        ) : null}

        {effectiveLayout === 'preview' ? (
          <button
            type="button"
            className="page-design-wizard__exit-preview"
            onClick={() => setLayoutMode(wideEnough ? 'split' : 'editor')}
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Επιστροφή στην επεξεργασία
          </button>
        ) : null}
      </div>

      {showEditor && dirty ? (
        <div className="page-design-wizard__mobile-save" role="status">
          <span className="text-xs font-semibold text-slate-600">Μη αποθηκευμένες αλλαγές</span>
          <button
            type="button"
            className="page-design-wizard__tool-save is-dirty"
            disabled={saving || !onSave}
            onClick={() => onSave?.()}
          >
            <span className="material-symbols-outlined text-[18px]">
              {saving ? 'progress_activity' : 'save'}
            </span>
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
