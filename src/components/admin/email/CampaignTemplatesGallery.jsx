import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import {
  STITCH_TEMPLATE_CATEGORIES,
  STITCH_CAMPAIGN_TEMPLATES,
  getStitchTemplatePreviewHtml,
  getStitchTemplatesByCategory,
} from '../../../lib/email/stitchTemplates.js';
import {
  filterStitchCategories,
  filterStitchTemplates,
} from '../../../lib/email/stitchTemplateAccess.js';

const PREVIEW_BASE =
  typeof window !== 'undefined' ? window.location.origin : '';

function TemplatePreviewFrame({ html, label, scrollable = false }) {
  return (
    <div
      className={`emh-tpl-preview-frame ${scrollable ? 'emh-tpl-preview-frame--scroll' : ''}`}
      aria-hidden={!label}
    >
      <div className="emh-tpl-preview-scaler">
        <iframe title={label ? `Προεπισκόπηση: ${label}` : 'Προεπισκόπηση'} srcDoc={html} referrerPolicy="no-referrer" />
      </div>
    </div>
  );
}

export default function CampaignTemplatesGallery({
  onSelect,
  variant = 'modal',
  initialCategory = 'all',
  access = { rentEnabled: false, newsletterEnabled: false },
}) {
  const visibleCategories = useMemo(
    () => filterStitchCategories(STITCH_TEMPLATE_CATEGORIES, access),
    [access],
  );

  const [category, setCategory] = useState(() =>
    visibleCategories.some((c) => c.id === initialCategory) ? initialCategory : 'all',
  );
  const [lightboxTpl, setLightboxTpl] = useState(null);

  useEffect(() => {
    if (!visibleCategories.some((c) => c.id === category)) {
      setCategory('all');
    }
  }, [visibleCategories, category]);

  const templates = useMemo(() => {
    const list = getStitchTemplatesByCategory(category);
    return filterStitchTemplates(list, access);
  }, [category, access]);

  const visibleAll = useMemo(
    () => filterStitchTemplates(STITCH_CAMPAIGN_TEMPLATES, access),
    [access],
  );

  const previewById = useMemo(() => {
    const map = {};
    for (const tpl of visibleAll) {
      map[tpl.id] = getStitchTemplatePreviewHtml(tpl, PREVIEW_BASE);
    }
    return map;
  }, [visibleAll]);

  const counts = useMemo(() => {
    const map = { all: visibleAll.length };
    for (const c of visibleCategories) {
      if (c.id !== 'all') {
        map[c.id] = filterStitchTemplates(getStitchTemplatesByCategory(c.id), access).length;
      }
    }
    return map;
  }, [visibleCategories, visibleAll, access]);

  const isPage = variant === 'page';
  const catClass = isPage ? 'emh-templates-categories--page' : 'emh-templates-categories--modal';
  const gridClass = isPage
    ? 'emh-templates-grid--page emh-templates-grid--comfortable'
    : 'emh-templates-grid--modal emh-templates-grid--comfortable';
  const cardClass = isPage ? 'emh-templates-card--page' : 'emh-templates-card--modal';
  const bodyClass = isPage ? 'emh-templates-page-body' : 'emh-templates-modal-body';

  return (
    <>
      <nav className={`emh-templates-categories ${catClass}`} aria-label="Κατηγορίες προτύπων">
        {visibleCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`emh-templates-cat ${category === cat.id ? 'emh-templates-cat-active' : ''}`}
            onClick={() => setCategory(cat.id)}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              {cat.icon}
            </span>
            {cat.label}
            <span className="emh-templates-cat-count">{counts[cat.id] ?? 0}</span>
          </button>
        ))}
      </nav>

      <div className={bodyClass}>
        <div className={isPage ? 'emh-templates-page-grid-wrap' : 'emh-templates-modal-grid-wrap'}>
          <div className={`emh-templates-grid ${gridClass}`}>
            {templates.map((tpl) => (
              <article key={tpl.id} className={`emh-templates-card ${cardClass} emh-templates-card--gallery`}>
                <button
                  type="button"
                  className="emh-tpl-thumb-btn"
                  onClick={() => setLightboxTpl(tpl)}
                  aria-label={`Προεπισκόπηση: ${tpl.name}`}
                >
                  <TemplatePreviewFrame html={previewById[tpl.id]} label={tpl.name} scrollable />
                </button>
                <div className="emh-templates-card-body">
                  <h3 className="emh-templates-card-name">{tpl.name}</h3>
                  <p className="emh-templates-card-sub">{tpl.subtitle}</p>
                  <p className="emh-templates-card-meta">
                    <span>Subject:</span> {tpl.subject}
                  </p>
                  <div className="emh-templates-card-actions">
                    <button
                      type="button"
                      className="emh-btn-outline emh-templates-preview-btn"
                      onClick={() => setLightboxTpl(tpl)}
                    >
                      <Eye size={16} aria-hidden />
                      Προεπισκόπηση
                    </button>
                    <button
                      type="button"
                      className="emh-btn-primary emh-templates-use-btn"
                      onClick={() => onSelect?.(tpl)}
                    >
                      Χρήση
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {templates.length === 0 && (
            <p className="emh-templates-empty">Δεν υπάρχουν πρότυπα σε αυτή την κατηγορία.</p>
          )}
        </div>
      </div>

      {lightboxTpl && (
        <div
          className="emh-tpl-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Προεπισκόπηση: ${lightboxTpl.name}`}
          onClick={() => setLightboxTpl(null)}
        >
          <div className="emh-tpl-lightbox-panel" onClick={(e) => e.stopPropagation()}>
            <header className="emh-tpl-lightbox-header">
              <div className="min-w-0">
                <h3 className="emh-tpl-lightbox-title">{lightboxTpl.name}</h3>
                <p className="emh-tpl-lightbox-sub">{lightboxTpl.subtitle}</p>
                <p className="emh-templates-card-meta m-0 mt-1">
                  <span>Subject:</span> {lightboxTpl.subject}
                </p>
              </div>
              <button
                type="button"
                className="emh-btn-ghost p-2 shrink-0"
                onClick={() => setLightboxTpl(null)}
                aria-label="Κλείσιμο προεπισκόπησης"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>
            <div className="emh-tpl-lightbox-frame">
              <iframe
                title={`Πλήρης προεπισκόπηση: ${lightboxTpl.name}`}
                srcDoc={previewById[lightboxTpl.id]}
                referrerPolicy="no-referrer"
              />
            </div>
            <footer className="emh-tpl-lightbox-footer">
              <button type="button" className="emh-btn-outline" onClick={() => setLightboxTpl(null)}>
                Πίσω
              </button>
              <button
                type="button"
                className="emh-btn-primary"
                onClick={() => {
                  onSelect?.(lightboxTpl);
                  setLightboxTpl(null);
                }}
              >
                Χρήση στον editor
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
