import { Link } from 'react-router-dom';

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
  children,
}) {
  const heroClass =
    designPage === 'rent'
      ? 'page-design-wizard__hero is-rent'
      : 'page-design-wizard__hero';

  return (
    <div className="page-design-wizard__layout">
      <nav className="page-design-wizard__sidebar" aria-label="Βήματα σχεδιασμού">
        <div className={heroClass}>
          <div className="flex items-start justify-between gap-2">
            <p className="page-design-wizard__hero-kicker">Διαμόρφωση</p>
            <span className="page-design-wizard__hero-badge">
              <span className="material-symbols-outlined text-[12px]">layers</span>
              {officeMode === 'both' ? '2 σελίδες' : '1 σελίδα'}
            </span>
          </div>
          <p className="page-design-wizard__hero-title">{activePageMeta.title}</p>
          <p className="page-design-wizard__hero-blurb">{activePageMeta.blurb}</p>
          <p className="mt-1.5 text-[11px] font-semibold text-white/60">{contractBadge}</p>

          {canSwitchPages ? (
            <div className="page-design-wizard__page-tabs" role="tablist" aria-label="Σελίδα προς σχεδιασμό">
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
                      <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-black/20 border border-white/10 px-3 py-2.5 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <span className="material-symbols-outlined text-[18px]">{activePageMeta.icon}</span>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold">{activePageMeta.label}</p>
                <p className="text-[11px] text-white/70 mt-0.5">Μόνο αυτή η σελίδα στο συμβόλαιό σου</p>
              </div>
            </div>
          )}

          <Link to={previewTo} target="_blank" className="page-design-wizard__preview-link">
            <span className="material-symbols-outlined text-[15px]">open_in_new</span>
            {previewLabel}
          </Link>
        </div>

        <div className="page-design-wizard__nav">
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

      <div className="page-design-wizard__main">{children}</div>
    </div>
  );
}
