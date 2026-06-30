import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Image,
  ImagePlus,
  LayoutTemplate,
  MousePointerClick,
  Package,
  Mail,
  Sparkles,
  Trash2,
  Type,
} from 'lucide-react';
import toast from 'react-hot-toast';
import '../../../styles/emailMarketingHub.css';
import {
  DND_BLOCK_ID,
  DND_BLOCK_TYPE,
  insertBlockAt,
  readDragPayload,
  reorderBlocks,
} from '../../../lib/email/blockDrag.js';
import {
  BLOCK_META,
  BLOCK_PALETTE,
  blockSummary,
  blocksFromCampaign,
  compileBlocksToHtml,
  newBlock,
} from '../../../lib/email/campaignBlocks.js';
import CampaignBlockEditor from './CampaignBlockEditor.jsx';
import AudienceSelect from './AudienceSelect.jsx';
import {
  createCampaign,
  deleteCampaign,
  fetchCampaign,
  fetchCampaignSegments,
  fetchInventoryEmailBlock,
  generateCampaignSubjects,
  sendCampaignTest,
  updateCampaign,
} from '../../../services/emailMarketingApi.js';
import { fetchCampaignMetrics, sendCampaignTracked } from '../../../services/emailClientApi.js';

const TEST_EMAIL_STORAGE_KEY = 'emh_campaign_test_email';
import ProductPickerModal from './ProductPickerModal.jsx';
import CampaignTemplatesModal from './CampaignTemplatesModal.jsx';
import { applyStitchTemplate } from '../../../lib/email/stitchTemplates.js';

const BLOCK_ICONS = {
  Type,
  Image,
  ImagePlus,
  MousePointerClick,
  Package,
};

const ROW_ICONS = BLOCK_ICONS;

const API_BASE_PREVIEW = typeof window !== 'undefined' ? window.location.origin : '';

export default function NewCampaignEditor({
  emailSettingsId = '',
  campaignId = null,
  initialDraft = null,
  onBack,
  onSaved,
  onDeleted,
}) {
  const isEdit = Boolean(campaignId);
  const [loading, setLoading] = useState(isEdit);
  const [campaignStatus, setCampaignStatus] = useState('Draft');
  const [metrics, setMetrics] = useState(null);
  const [name, setName] = useState(initialDraft?.name || '');
  const [subject, setSubject] = useState(initialDraft?.subject || '');
  const [preheader, setPreheader] = useState(initialDraft?.preheader || '');
  const [audience, setAudience] = useState('all');
  const [segments, setSegments] = useState([]);
  const [blocks, setBlocks] = useState(
    initialDraft?.blocks?.length ? initialDraft.blocks : [newBlock('header'), newBlock('text')],
  );
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [previewMode, setPreviewMode] = useState('desktop');
  const [productModal, setProductModal] = useState(false);
  const [pendingProductBlockId, setPendingProductBlockId] = useState(null);
  const [subjectSuggestions, setSubjectSuggestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [draggingBlockId, setDraggingBlockId] = useState(null);
  const [draggingPaletteType, setDraggingPaletteType] = useState(null);
  const [previewDropActive, setPreviewDropActive] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [testEmail, setTestEmail] = useState(() => {
    try {
      return localStorage.getItem(TEST_EMAIL_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [sendingTest, setSendingTest] = useState(false);
  const [railSettingsOpen, setRailSettingsOpen] = useState(true);
  const [railBlocksOpen, setRailBlocksOpen] = useState(true);
  const [railSendOpen, setRailSendOpen] = useState(true);

  useEffect(() => {
    fetchCampaignSegments()
      .then((list) => setSegments(list?.length ? list : []))
      .catch(() => setSegments([]));
  }, []);

  useEffect(() => {
    if (!campaignId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const c = await fetchCampaign(campaignId);
        if (cancelled) return;
        setName(c.name || '');
        setSubject(c.subject || '');
        setPreheader(c.preheader || '');
        setAudience(c.audience_filter || 'all');
        setCampaignStatus(c.status || 'Draft');
        const loadedBlocks = blocksFromCampaign(c);
        setBlocks(loadedBlocks);
        setActiveBlockId(loadedBlocks[loadedBlocks.length - 1]?.id || null);
        if (c.status === 'Sent') {
          try {
            const m = await fetchCampaignMetrics(campaignId);
            if (!cancelled) setMetrics(m);
          } catch {
            if (!cancelled) {
              setMetrics({ open_count: c.open_count, click_count: c.click_count });
            }
          }
        } else {
          setMetrics(null);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err.message);
          onBack?.();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId, onBack]);

  useEffect(() => {
    if (!blocks.length) {
      setActiveBlockId(null);
      return;
    }
    if (!activeBlockId || !blocks.some((b) => b.id === activeBlockId)) {
      setActiveBlockId(blocks[blocks.length - 1].id);
    }
  }, [blocks, activeBlockId]);

  const previewHtml = useMemo(
    () => compileBlocksToHtml(blocks, { preheader, baseUrl: API_BASE_PREVIEW }),
    [blocks, preheader],
  );

  const applyTemplate = (tpl) => {
    const applied = applyStitchTemplate(tpl);
    setName(applied.name);
    setSubject(applied.subject);
    setPreheader(applied.preheader);
    setBlocks(applied.blocks);
    setActiveBlockId(applied.blocks[applied.blocks.length - 1]?.id || null);
    setTemplatesOpen(false);
    toast.success(`Φορτώθηκε το πρότυπο «${tpl.name}»`);
  };

  const clearDragState = useCallback(() => {
    setDragOverIndex(null);
    setDraggingBlockId(null);
    setDraggingPaletteType(null);
    setPreviewDropActive(false);
  }, []);

  const insertBlock = (type, index) => {
    if (type === 'product') {
      const blk = newBlock('product');
      setBlocks((b) => {
        const at = Math.max(0, Math.min(index ?? b.length, b.length));
        return insertBlockAt(b, blk, at);
      });
      setActiveBlockId(blk.id);
      setPendingProductBlockId(blk.id);
      setProductModal(true);
      return blk;
    }
    const blk = newBlock(type);
    setBlocks((b) => {
      const at = Math.max(0, Math.min(index ?? b.length, b.length));
      return insertBlockAt(b, blk, at);
    });
    setActiveBlockId(blk.id);
    return blk;
  };

  const addBlock = (type) => insertBlock(type, blocks.length);

  const handleDropAtIndex = (e, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();
    const { blockType, blockId } = readDragPayload(e.dataTransfer);
    clearDragState();
    if (blockType) {
      insertBlock(blockType, dropIndex);
      return;
    }
    if (blockId) {
      setBlocks((list) => reorderBlocks(list, blockId, dropIndex));
      setActiveBlockId(blockId);
    }
  };

  const onPaletteDragStart = (e, type) => {
    e.dataTransfer.setData(DND_BLOCK_TYPE, type);
    e.dataTransfer.setData('text/plain', type);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggingPaletteType(type);
  };

  const onBlockDragStart = (e, blockId) => {
    e.dataTransfer.setData(DND_BLOCK_ID, blockId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingBlockId(blockId);
  };

  const onDragOverIndex = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(DND_BLOCK_ID) ? 'move' : 'copy';
    setDragOverIndex(index);
    setPreviewDropActive(false);
  };

  const updateBlock = (id, patch) => {
    setBlocks((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const removeBlock = (id) => {
    setBlocks((list) => list.filter((b) => b.id !== id));
    if (activeBlockId === id) setActiveBlockId(null);
  };

  const duplicateBlock = (id) => {
    const source = blocks.find((b) => b.id === id);
    if (!source) return;
    const clone = {
      ...source,
      id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      product: source.product ? { ...source.product } : null,
      productHtml: source.productHtml || null,
    };
    const idx = blocks.findIndex((b) => b.id === id);
    setBlocks((list) => {
      const next = [...list];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    setActiveBlockId(clone.id);
  };

  const activeBlock = blocks.find((b) => b.id === activeBlockId);

  const moveBlock = (id, dir) => {
    setBlocks((list) => {
      const idx = list.findIndex((b) => b.id === id);
      if (idx < 0) return list;
      const next = idx + dir;
      if (next < 0 || next >= list.length) return list;
      const copy = [...list];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  };

  const onProductPicked = async (product) => {
    let productHtml = null;
    try {
      const data = await fetchInventoryEmailBlock(product.id);
      productHtml = data.html;
      product = data.product || product;
    } catch {
      /* fallback: client-side productBlockHtml */
    }
    const patch = { type: 'product', product, productHtml };
    if (pendingProductBlockId) {
      updateBlock(pendingProductBlockId, patch);
      setPendingProductBlockId(null);
    } else {
      setBlocks((b) => [...b, { ...newBlock('product'), ...patch }]);
    }
  };

  const runAiSubjects = async () => {
    setAiLoading(true);
    try {
      const r = await generateCampaignSubjects({
        body_html: previewHtml,
        campaign_name: name,
        preheader,
      });
      setSubjectSuggestions(r.subjects || []);
      toast.success(r.source === 'openai' ? 'Προτάσεις από AI' : 'Προτάσεις (τοπικές)');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const sendTest = async () => {
    const email = testEmail.trim();
    if (!email) {
      toast.error('Συμπληρώστε email για δοκιμή');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Μη έγκυρη διεύθυνση email');
      return;
    }
    if (!subject.trim()) {
      toast.error('Συμπληρώστε θέμα καμπάνιας');
      return;
    }
    setSendingTest(true);
    try {
      const r = await sendCampaignTest({
        to_email: email,
        subject: subject.trim(),
        body_html: previewHtml,
        preheader: preheader.trim(),
        blocks,
        email_settings_id: emailSettingsId || null,
      });
      try {
        localStorage.setItem(TEST_EMAIL_STORAGE_KEY, email);
      } catch {
        /* ignore */
      }
      toast.success(`Test στάλθηκε στο ${r.to}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingTest(false);
    }
  };

  const save = async (sendNow) => {
    if (!name.trim() || !subject.trim()) {
      toast.error('Συμπληρώστε όνομα και θέμα καμπάνιας');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        subject: subject.trim(),
        preheader: preheader.trim(),
        body_html: previewHtml,
        audience_filter: audience,
        email_settings_id: emailSettingsId || null,
        blocks,
      };

      if (isEdit) {
        await updateCampaign(campaignId, payload);
        if (sendNow) {
          await sendCampaignTracked(campaignId, {
            subscriberList: 'subscribed_only',
            emailSettingsId: emailSettingsId || null,
          });
          toast.success('Η αποστολή ξεκίνηκε');
        } else {
          toast.success('Η καμπάνια αποθηκεύτηκε');
        }
        onSaved?.();
        return;
      }

      const created = await createCampaign({
        ...payload,
        send_now: sendNow,
        status: 'Draft',
      });
      toast.success(sendNow ? 'Η αποστολή ξεκίνησε στο background' : 'Η καμπάνια αποθηκεύτηκε ως Draft');
      onSaved?.(created);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!campaignId) return;
    if (!window.confirm('Διαγραφή καμπάνιας; Η ενέργεια δεν αναιρείται.')) return;
    setSaving(true);
    try {
      await deleteCampaign(campaignId);
      toast.success('Η καμπάνια διαγράφηκε');
      onDeleted?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="emh-editor emh-editor--wide emh-editor-loading">
        <p className="emh-loading-text">Φόρτωση καμπάνιας…</p>
      </div>
    );
  }

  return (
    <div className="emh-editor emh-editor--wide emh-editor--horizon">
      <header className="emh-editor-header emh-editor-header--compact">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="emh-btn-ghost" aria-label="Πίσω">
            <ArrowLeft size={18} />
          </button>
          <h1>{isEdit ? 'Επεξεργασία καμπάνιας' : 'Νέα Καμπάνια'}</h1>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {isEdit && (
            <button
              type="button"
              disabled={saving}
              onClick={handleDelete}
              className="emh-btn-danger-outline"
            >
              Διαγραφή
            </button>
          )}
          <button type="button" disabled={saving} onClick={() => save(false)} className="emh-btn-outline">
            {isEdit ? 'Αποθήκευση' : 'Αποθήκευση Draft'}
          </button>
          {campaignStatus !== 'Sent' && (
            <button type="button" disabled={saving} onClick={() => save(true)} className="emh-btn-primary">
              {saving ? '…' : 'Αποστολή τώρα'}
            </button>
          )}
        </div>
      </header>

      {metrics && (
        <div className="emh-campaign-metrics">
          <span>Opens: <strong>{metrics.open_count ?? 0}</strong></span>
          <span>Clicks: <strong>{metrics.click_count ?? 0}</strong></span>
          <span>Απεσταλμένα: <strong>{metrics.sent_count ?? metrics.stats?.sent ?? '—'}</strong></span>
        </div>
      )}

      <div className="emh-split emh-split-editor">
        <aside className="emh-panel-side emh-panel-rail emh-panel-rail--stack">
          <button
            type="button"
            className="emh-rail-templates-btn"
            onClick={() => setTemplatesOpen(true)}
            title="Πρότυπα καμπάνιας"
          >
            <span className="emh-rail-templates-icon" aria-hidden>
              <LayoutTemplate size={18} strokeWidth={2} />
            </span>
            <span className="emh-rail-templates-copy">
              <span className="emh-rail-templates-title">Πρότυπα</span>
              <span className="emh-rail-templates-sub">Stitch gallery</span>
            </span>
          </button>

          <div className="emh-rail-card">
            <button
              type="button"
              className={`emh-rail-card-toggle ${railSettingsOpen ? 'emh-rail-card-toggle-open' : ''}`}
              onClick={() => setRailSettingsOpen((v) => !v)}
              aria-expanded={railSettingsOpen}
            >
              <span className="emh-rail-card-toggle-left">
                <span className="emh-rail-card-toggle-icon">
                  <Type size={15} strokeWidth={2.25} />
                </span>
                <span className="emh-rail-card-toggle-label">Ρυθμίσεις</span>
              </span>
              <ChevronDown size={16} className="emh-rail-chevron" aria-hidden />
            </button>
            {railSettingsOpen && (
              <div className="emh-rail-card-body">
                <label className="emh-rail-field">
                  <span className="emh-rail-field-label">Όνομα καμπάνιας</span>
                  <input
                    className="emh-input emh-input--rail"
                    placeholder="π.χ. Stitch – Ταξίδια Εσωτερικού"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="emh-rail-field">
                  <span className="emh-rail-field-label">Subject</span>
                  <input
                    className="emh-input emh-input--rail"
                    placeholder="Θέμα email *"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </label>
                <label className="emh-rail-field">
                  <span className="emh-rail-field-label">Preheader</span>
                  <input
                    className="emh-input emh-input--rail"
                    placeholder="Κείμενο προεπισκόπησης"
                    value={preheader}
                    onChange={(e) => setPreheader(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={runAiSubjects}
                  disabled={aiLoading}
                  className="emh-rail-ai-btn"
                >
                  <Sparkles size={14} aria-hidden />
                  {aiLoading ? 'Δημιουργία θέματος…' : 'Θέμα με AI'}
                </button>
                {subjectSuggestions.length > 0 && (
                  <ul className="emh-rail-suggestions">
                    {subjectSuggestions.slice(0, 3).map((s) => (
                      <li key={s}>
                        <button type="button" onClick={() => setSubject(s)} className="emh-rail-suggestion">
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="emh-rail-card">
            <button
              type="button"
              className={`emh-rail-card-toggle ${railBlocksOpen ? 'emh-rail-card-toggle-open' : ''}`}
              onClick={() => setRailBlocksOpen((v) => !v)}
              aria-expanded={railBlocksOpen}
            >
              <span className="emh-rail-card-toggle-left">
                <span className="emh-rail-card-toggle-icon emh-rail-card-toggle-icon-blocks">
                  <LayoutTemplate size={15} strokeWidth={2.25} />
                </span>
                <span className="emh-rail-card-toggle-label">Blocks</span>
              </span>
              <ChevronDown size={16} className="emh-rail-chevron" aria-hidden />
            </button>
            {railBlocksOpen && (
              <div className="emh-rail-card-body emh-rail-card-body--flush">
                <p className="emh-rail-hint">Σύρετε ή κάντε κλικ για προσθήκη</p>
                <ul className="emh-palette-list">
                  {BLOCK_PALETTE.map((item) => {
                    const Icon = BLOCK_ICONS[item.icon] || Image;
                    const meta = BLOCK_META[item.type] || BLOCK_META.text;
                    return (
                      <li key={item.type}>
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => onPaletteDragStart(e, item.type)}
                          onDragEnd={clearDragState}
                          onClick={() => addBlock(item.type)}
                          title={item.label}
                          className={`emh-palette-item ${
                            draggingPaletteType === item.type ? 'emh-palette-item-dragging' : ''
                          }`}
                          style={{ '--chip-accent': meta.accent }}
                        >
                          <GripVertical size={14} className="emh-palette-grip" aria-hidden />
                          <span className="emh-palette-item-icon" aria-hidden>
                            <Icon size={16} strokeWidth={2.25} />
                          </span>
                          <span className="emh-palette-item-copy">
                            <span className="emh-palette-item-label">{meta.label}</span>
                            <span className="emh-palette-item-desc">{item.label}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="emh-rail-card emh-rail-card-send">
            <button
              type="button"
              className={`emh-rail-card-toggle ${railSendOpen ? 'emh-rail-card-toggle-open' : ''}`}
              onClick={() => setRailSendOpen((v) => !v)}
              aria-expanded={railSendOpen}
            >
              <span className="emh-rail-card-toggle-left">
                <span className="emh-rail-card-toggle-icon emh-rail-card-toggle-icon-send">
                  <Mail size={15} strokeWidth={2.25} />
                </span>
                <span className="emh-rail-card-toggle-label">Αποστολή</span>
              </span>
              <ChevronDown size={16} className="emh-rail-chevron" aria-hidden />
            </button>
            {railSendOpen && (
              <div className="emh-rail-card-body">
                <p className="emh-rail-send-note">Μαζική καμπάνια & δοκιμαστικό email</p>
                <label className="emh-rail-field">
                  <span className="emh-rail-field-label">Ακροατήριο</span>
                  <AudienceSelect
                    value={audience}
                    onChange={setAudience}
                    segments={segments}
                    loading={!segments.length}
                  />
                </label>
                <label className="emh-rail-field">
                  <span className="emh-rail-field-label">Email test</span>
                  <input
                    type="email"
                    className="emh-input emh-input--rail"
                    placeholder="you@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>
                <button
                  type="button"
                  onClick={sendTest}
                  disabled={sendingTest || saving}
                  className="emh-rail-test-btn"
                >
                  <Mail size={15} aria-hidden />
                  {sendingTest ? 'Αποστολή test…' : 'Αποστολή test'}
                </button>
              </div>
            )}
          </div>
        </aside>

        <div className="emh-panel-workspace">
          <section className="emh-workspace-blocks">
            <div className="emh-workspace-blocks-head">
              <h2 className="emh-section-title m-0">Σειρά</h2>
              <span className="emh-workspace-count">{blocks.length}</span>
            </div>
            <ul
              className="emh-block-list"
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setDragOverIndex(null);
              }}
            >
              {blocks.map((block, idx) => {
                const meta = BLOCK_META[block.type] || BLOCK_META.text;
                const RowIcon = ROW_ICONS[meta.icon] || Type;
                return (
                  <li key={block.id}>
                    {dragOverIndex === idx && <div className="emh-drop-line" aria-hidden />}
                    <div
                      className={`emh-block-row ${activeBlockId === block.id ? 'emh-block-row-active' : ''} ${
                        draggingBlockId === block.id ? 'emh-block-row-dragging' : ''
                      }`}
                      onDragOver={(e) => onDragOverIndex(e, idx)}
                      onDrop={(e) => handleDropAtIndex(e, idx)}
                    >
                      <span
                        className="emh-drag-handle"
                        draggable
                        onDragStart={(e) => onBlockDragStart(e, block.id)}
                        onDragEnd={clearDragState}
                        title="Σύρετε για αναδιάταξη"
                      >
                        <GripVertical size={14} />
                      </span>
                      <button
                        type="button"
                        className="emh-block-row-select"
                        onClick={() => setActiveBlockId(block.id)}
                      >
                        <span
                          className="emh-block-row-badge"
                          style={{ background: `${meta.accent}14`, color: meta.accent }}
                        >
                          <RowIcon size={12} strokeWidth={2} />
                        </span>
                        <span className="emh-block-row-body">
                          <span className="emh-block-row-label">
                            <span className="emh-block-row-index">{idx + 1}</span>
                            {meta.label}
                          </span>
                          <span className="emh-block-row-summary">{blockSummary(block)}</span>
                        </span>
                      </button>
                      <span className="emh-block-row-actions">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveBlock(block.id, -1)}
                          className="emh-icon-btn"
                          aria-label="Πάνω"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === blocks.length - 1}
                          onClick={() => moveBlock(block.id, 1)}
                          className="emh-icon-btn"
                          aria-label="Κάτω"
                        >
                          <ChevronDown size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateBlock(block.id)}
                          className="emh-icon-btn"
                          aria-label="Αντιγραφή"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBlock(block.id)}
                          className="emh-icon-btn emh-icon-btn-danger"
                          aria-label="Διαγραφή"
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    </div>
                  </li>
                );
              })}
              <li
                className={`emh-drop-zone-end ${dragOverIndex === blocks.length ? 'emh-drop-zone-active' : ''}`}
                onDragOver={(e) => onDragOverIndex(e, blocks.length)}
                onDrop={(e) => handleDropAtIndex(e, blocks.length)}
              >
                {dragOverIndex === blocks.length && <div className="emh-drop-line" aria-hidden />}
                <span className="material-symbols-outlined text-[#94a3b8]">add_circle</span>
                <span>Σύρετε εδώ</span>
              </li>
            </ul>
          </section>

          {activeBlock && (
            <section className="emh-workspace-editor">
              <CampaignBlockEditor
                block={activeBlock}
                onUpdate={(patch) => updateBlock(activeBlock.id, patch)}
                onPickProduct={() => {
                  setPendingProductBlockId(activeBlock.id);
                  setProductModal(true);
                }}
              />
            </section>
          )}
        </div>

        <main className="emh-panel-center emh-panel-preview">
          <div className="emh-preview-toolbar">
            <span className="emh-preview-label">Live Preview</span>
            <div className="emh-preview-pills">
              <button
                type="button"
                onClick={() => setPreviewMode('mobile')}
                className={`emh-preview-toggle ${previewMode === 'mobile' ? 'active' : ''}`}
              >
                Mobile
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('desktop')}
                className={`emh-preview-toggle ${previewMode === 'desktop' ? 'active' : ''}`}
              >
                Desktop
              </button>
            </div>
          </div>
          <div
            className={`emh-preview-stage ${previewDropActive ? 'emh-preview-stage-drop' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = e.dataTransfer.types.includes(DND_BLOCK_ID) ? 'move' : 'copy';
              setPreviewDropActive(true);
              setDragOverIndex(null);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setPreviewDropActive(false);
            }}
            onDrop={(e) => {
              handleDropAtIndex(e, blocks.length);
              setPreviewDropActive(false);
            }}
          >
            {previewDropActive && (
              <div className="emh-preview-drop-overlay">
                <span>Αφήστε για προσθήκη στο email</span>
              </div>
            )}
            {previewMode === 'mobile' ? (
              <div className="emh-phone-frame">
                <div className="emh-phone-notch" aria-hidden />
                <div className="emh-phone-screen">
                  {preheader && (
                    <div className="px-3 py-1.5 bg-gray-100 text-[10px] text-gray-500 border-b truncate">
                      {preheader}
                    </div>
                  )}
                  <iframe title="Email mobile preview" srcDoc={previewHtml} referrerPolicy="no-referrer" />
                </div>
              </div>
            ) : (
              <div className="emh-desktop-frame">
                {preheader && (
                  <div className="px-4 py-2 bg-gray-100 text-xs text-gray-500 border-b truncate">
                    {preheader}
                  </div>
                )}
                <iframe title="Email desktop preview" srcDoc={previewHtml} referrerPolicy="no-referrer" />
              </div>
            )}
          </div>
        </main>
      </div>

      <ProductPickerModal
        open={productModal}
        themed
        onClose={() => {
          setProductModal(false);
          setPendingProductBlockId(null);
        }}
        onSelect={onProductPicked}
      />

      <CampaignTemplatesModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onSelect={applyTemplate}
      />
    </div>
  );
}
