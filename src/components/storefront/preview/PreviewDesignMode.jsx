import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  isStorefrontPreviewMode,
  pushHomepagePreviewDraft,
  readHomepagePreviewDraft,
  subscribeHomepagePreviewDraft,
} from '../../../lib/homepage/homepagePreview.js';
import {
  PDW_BRIDGE,
  postPdwBridge,
  subscribePdwBridge,
} from '../../../lib/homepage/pageDesignBridge.js';
import PageDesignBuilderPanel from '../../admin/homepage/PageDesignBuilderPanel.jsx';
import '../../../styles/page-design-wizard.css';
import '../../../styles/storefront-preview-builder.css';

const PreviewDesignCtx = createContext(null);

const SECTION_LABELS = {
  general: 'Γενικά',
  header: 'Header',
  hero: 'Hero',
  slider: 'Slider',
  trips: 'Καρτέλες',
  footer: 'Footer',
};

export function usePreviewDesignMode() {
  return useContext(PreviewDesignCtx);
}

/**
 * Enables Divi-like section overlays only when `?preview=1`.
 * Outside preview mode this is a no-op passthrough.
 */
export function PreviewDesignModeProvider({ children, appearance }) {
  const enabled = isStorefrontPreviewMode();
  const [form, setFormState] = useState(() => {
    const draft = readHomepagePreviewDraft();
    return draft || appearance || {};
  });
  const [focusedSection, setFocusedSection] = useState(null);
  const [openSection, setOpenSection] = useState(null);
  const syncingFromParent = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeHomepagePreviewDraft((draft) => {
      if (!draft || typeof draft !== 'object') return;
      syncingFromParent.current = true;
      setFormState((prev) => {
        const next = { ...prev, ...draft };
        return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
      });
      queueMicrotask(() => {
        syncingFromParent.current = false;
      });
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !appearance) return;
    setFormState((prev) => ({ ...prev, ...appearance }));
  }, [enabled, appearance]);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribePdwBridge((msg) => {
      if (msg.type === PDW_BRIDGE.SECTION_FOCUS && msg.section) {
        setFocusedSection(msg.section);
      }
    });
  }, [enabled]);

  const setForm = useCallback((updater) => {
    setFormState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      if (!syncingFromParent.current) {
        pushHomepagePreviewDraft(next);
        postPdwBridge({ type: PDW_BRIDGE.APPEARANCE_SYNC, appearance: next });
      }
      return next;
    });
  }, []);

  const selectSection = useCallback((sectionId) => {
    if (!sectionId) return;
    setFocusedSection(sectionId);
    postPdwBridge({ type: PDW_BRIDGE.SELECT_SECTION, section: sectionId });
  }, []);

  const openBuilder = useCallback(
    (sectionId) => {
      if (!sectionId) return;
      selectSection(sectionId);
      setOpenSection((cur) => (cur === sectionId ? null : sectionId));
    },
    [selectSection],
  );

  const closeBuilder = useCallback(() => setOpenSection(null), []);

  const requestThemes = useCallback(() => {
    postPdwBridge({ type: PDW_BRIDGE.REQUEST_THEMES });
    closeBuilder();
  }, [closeBuilder]);

  const value = useMemo(() => {
    if (!enabled) return null;
    return {
      enabled: true,
      form,
      setForm,
      focusedSection,
      openSection,
      openBuilder,
      closeBuilder,
      selectSection,
      requestThemes,
      sectionLabel: (id) => SECTION_LABELS[id] || id,
    };
  }, [
    enabled,
    form,
    setForm,
    focusedSection,
    openSection,
    openBuilder,
    closeBuilder,
    selectSection,
    requestThemes,
  ]);

  if (!enabled) return children;

  return <PreviewDesignCtx.Provider value={value}>{children}</PreviewDesignCtx.Provider>;
}

/**
 * Compact Builder control — place inline (e.g. right of ΠΡΟΓΡΑΜΜΑ ΕΚΔΡΟΜΩΝ)
 * or as a floating bar on a section overlay.
 */
export function PreviewBuilderControl({
  sectionId,
  label,
  variant = 'inline',
  className = '',
}) {
  const ctx = usePreviewDesignMode();
  const wrapRef = useRef(null);
  if (!ctx?.enabled || !sectionId) return null;

  const isOpen = ctx.openSection === sectionId;
  const title = label || ctx.sectionLabel(sectionId);

  return (
    <div
      ref={wrapRef}
      className={`sf-preview-builder ${variant === 'bar' ? 'is-bar' : 'is-inline'} ${className}`.trim()}
      data-pdw-section={sectionId}
    >
      <button
        type="button"
        className={`sf-preview-builder__btn${isOpen ? ' is-open' : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={`Builder · ${title}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          ctx.openBuilder(sectionId);
        }}
      >
        <span className="material-symbols-outlined sf-preview-builder__icon" aria-hidden>
          build
        </span>
        <span className="sf-preview-builder__label">Builder</span>
        <span className="material-symbols-outlined sf-preview-builder__chev" aria-hidden>
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {isOpen ? (
        <PreviewBuilderPopover
          sectionId={sectionId}
          title={title}
          form={ctx.form}
          setForm={ctx.setForm}
          onClose={ctx.closeBuilder}
          onSelectThemes={ctx.requestThemes}
          anchorRef={wrapRef}
        />
      ) : null}
    </div>
  );
}

function PreviewBuilderPopover({
  sectionId,
  title,
  form,
  setForm,
  onClose,
  onSelectThemes,
  anchorRef,
}) {
  const popRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      const t = e.target;
      if (popRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorRef]);

  return (
    <div
      ref={popRef}
      className="sf-preview-builder__popover"
      role="dialog"
      aria-label={`Builder · ${title}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="sf-preview-builder__popover-scroll">
        <PageDesignBuilderPanel
          section={sectionId}
          form={form}
          setForm={setForm}
          onSelectThemes={onSelectThemes}
        />
      </div>
    </div>
  );
}

/**
 * Divi-like section wrapper: hover/selected outline + optional floating Builder bar.
 * Use `inlineControl` when the Builder sits inside the module header instead.
 */
export function PreviewEditableSection({
  sectionId,
  label,
  children,
  className = '',
  /** Hide the floating top-right bar (caller renders PreviewBuilderControl inline). */
  hideFloatingBar = false,
  as: Tag = 'div',
}) {
  const ctx = usePreviewDesignMode();
  if (!ctx?.enabled) {
    return Tag === 'div' && !className ? (
      children
    ) : (
      <Tag className={className || undefined}>{children}</Tag>
    );
  }

  // Slider edits live on the hero canvas — highlight Hero when Slider is selected.
  const focused =
    ctx.focusedSection === sectionId ||
    (sectionId === 'hero' && ctx.focusedSection === 'slider');
  const open =
    ctx.openSection === sectionId ||
    (sectionId === 'hero' && ctx.openSection === 'slider');
  const title = label || ctx.sectionLabel(sectionId);

  return (
    <Tag
      className={`sf-preview-section ${className}`.trim()}
      data-pdw-editable={sectionId}
      data-pdw-focused={focused || open ? '1' : undefined}
      onMouseEnter={() => {
        /* outline via CSS :hover; keep focus sync soft */
      }}
      onClick={(e) => {
        // Clicking empty section chrome focuses it in the left nav (Divi click-to-edit).
        if (e.target.closest?.('a, button, input, select, textarea, label, [role="dialog"]')) {
          return;
        }
        ctx.selectSection(sectionId);
      }}
    >
      {!hideFloatingBar ? (
        <div className="sf-preview-section__bar" aria-hidden={false}>
          <span className="sf-preview-section__bar-label">{title}</span>
          <PreviewBuilderControl sectionId={sectionId} label={title} variant="bar" />
        </div>
      ) : null}
      {children}
    </Tag>
  );
}
