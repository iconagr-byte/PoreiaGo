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
  scrollPreviewToSection,
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
  branding: 'Μάρκα',
  footer: 'Footer',
};

/** Nav sections that should outline the hero block when focused. */
const HERO_FOCUS_ALIASES = new Set(['slider', 'themes', 'general']);
/** Nav sections that should outline the header / brand when focused. */
const HEADER_FOCUS_ALIASES = new Set(['branding']);

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
  /** `{ section, instance }` — instance distinguishes multiple Builders for the same section (fleet cards). */
  const [openBuilderState, setOpenBuilderState] = useState({ section: null, instance: null });
  const openSection = openBuilderState.section;
  const openInstance = openBuilderState.instance;
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
      // Left-nav → live preview: smooth-scroll to the mapped storefront section.
      // Re-fires when the same nav item is clicked again (parent always posts SCROLL).
      if (msg.type === PDW_BRIDGE.SCROLL_TO_SECTION && msg.section) {
        scrollPreviewToSection(msg.section, { behavior: 'smooth', block: 'start' });
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
    (sectionId, instanceId = null) => {
      if (!sectionId) return;
      selectSection(sectionId);
      setOpenBuilderState((cur) => {
        if (cur.section === sectionId && cur.instance === instanceId) {
          return { section: null, instance: null };
        }
        return { section: sectionId, instance: instanceId };
      });
    },
    [selectSection],
  );

  const closeBuilder = useCallback(() => {
    setOpenBuilderState({ section: null, instance: null });
  }, []);

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
      openInstance,
      openBuilder,
      closeBuilder,
      selectSection,
      requestThemes,
      sectionLabel: (id) => SECTION_LABELS[id] || id,
      isBuilderOpen: (sectionId, instanceId = null) =>
        openSection === sectionId && openInstance === instanceId,
    };
  }, [
    enabled,
    form,
    setForm,
    focusedSection,
    openSection,
    openInstance,
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
  /** Unique key when several controls share the same sectionId (one popover at a time). */
  instanceId = null,
}) {
  const ctx = usePreviewDesignMode();
  const wrapRef = useRef(null);
  if (!ctx?.enabled || !sectionId) return null;

  const isOpen = ctx.isBuilderOpen
    ? ctx.isBuilderOpen(sectionId, instanceId)
    : ctx.openSection === sectionId && ctx.openInstance === instanceId;
  const title = label || ctx.sectionLabel(sectionId);

  return (
    <div
      ref={wrapRef}
      className={`sf-preview-builder ${variant === 'bar' ? 'is-bar' : 'is-inline'} ${
        variant === 'card' ? 'is-card' : ''
      } ${isOpen ? 'is-open' : ''} ${className}`.trim()}
      data-pdw-section={sectionId}
      data-pdw-instance={instanceId || undefined}
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
          ctx.openBuilder(sectionId, instanceId);
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

/**
 * Optional per-card Builder chip (hover-reveal). Prefer section-level
 * PreviewBuilderControl for shared card templates (trips / fleet / rent).
 * Renders nothing outside ?preview=1.
 */
export function PreviewCardBuilder({
  sectionId,
  label,
  instanceId,
  className = '',
}) {
  const ctx = usePreviewDesignMode();
  if (!ctx?.enabled || !sectionId || !instanceId) return null;
  return (
    <div className={`sf-preview-card-builder ${className}`.trim()}>
      <PreviewBuilderControl
        sectionId={sectionId}
        label={label}
        variant="card"
        instanceId={instanceId}
      />
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
      /* Comfortable 2-col template reading; CSS clamps with vw/vh on small admins */
      style={{
        ['--sf-builder-popover-w']: '36rem',
        ['--sf-builder-popover-max-h']: '44rem',
      }}
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

  // Slider / themes / general map onto the hero canvas for outline + scroll.
  const focused =
    ctx.focusedSection === sectionId ||
    (sectionId === 'hero' && HERO_FOCUS_ALIASES.has(ctx.focusedSection)) ||
    (sectionId === 'header' && HEADER_FOCUS_ALIASES.has(ctx.focusedSection));
  const open =
    ctx.openSection === sectionId ||
    (sectionId === 'hero' && ctx.openSection === 'slider');
  const title = label || ctx.sectionLabel(sectionId);
  // Stable anchors for left-nav → preview scrollIntoView (also keep data-pdw-editable).
  const anchorId =
    sectionId === 'hero' || sectionId === 'footer' || sectionId === 'trips'
      ? sectionId
      : `pdw-${sectionId}`;

  return (
    <Tag
      id={anchorId}
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
          <PreviewBuilderControl
            sectionId={sectionId}
            label={title}
            variant="bar"
            instanceId={`section-bar-${sectionId}`}
          />
        </div>
      ) : null}
      {children}
    </Tag>
  );
}
