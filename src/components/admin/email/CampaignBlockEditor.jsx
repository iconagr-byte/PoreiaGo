import {
  Image,
  ImagePlus,
  MousePointerClick,
  Package,
  Type,
} from 'lucide-react';
import { BLOCK_META } from '../../../lib/email/campaignBlocks.js';
import RichTextEditor from './RichTextEditor.jsx';
import ImageUploadField from './ImageUploadField.jsx';

const BLOCK_ICONS = { Type, Image, ImagePlus, MousePointerClick, Package };

function Field({ label, hint, children }) {
  return (
    <div className="emh-field">
      <span className="emh-field-label">{label}</span>
      {children}
      {hint ? <span className="emh-field-hint">{hint}</span> : null}
    </div>
  );
}

export default function CampaignBlockEditor({ block, onUpdate, onPickProduct }) {
  if (!block) return null;

  const meta = BLOCK_META[block.type] || { label: block.type, icon: 'Type', accent: '#6366f1' };
  const Icon = BLOCK_ICONS[meta.icon] || Type;

  return (
    <div className="emh-block-editor">
      <div className="emh-block-editor-head">
        <span className="emh-block-editor-badge" style={{ background: `${meta.accent}18`, color: meta.accent }}>
          <Icon size={16} strokeWidth={2} />
        </span>
        <div>
          <p className="emh-block-editor-title">{meta.label}</p>
          <p className="emh-field-hint">Οι αλλαγές εμφανίζονται αμέσως στο preview</p>
        </div>
      </div>

      {block.type === 'header' && (
        <ImageUploadField
          label="URL εικόνας (hero)"
          urlPlaceholder="https://images.unsplash.com/…"
          url={block.url}
          alt={block.alt}
          onUrlChange={(url) => onUpdate({ url })}
          onAltChange={(alt) => onUpdate({ alt })}
        />
      )}

      {block.type === 'text' && (
        <Field label="Περιεχόμενο" hint="Μορφοποίηση με τη γραμμή εργαλείων — bold, λίστες, σύνδεσμοι">
          <RichTextEditor
            variant="mail"
            value={block.content || '<p></p>'}
            onChange={(html) => onUpdate({ content: html })}
            minHeight={140}
          />
        </Field>
      )}

      {block.type === 'image' && (
        <ImageUploadField
          label="URL εικόνας"
          url={block.url}
          alt={block.alt}
          onUrlChange={(url) => onUpdate({ url })}
          onAltChange={(alt) => onUpdate({ alt })}
        />
      )}

      {block.type === 'cta' && (
        <>
          <div className="emh-cta-preview">
            <span>{block.label || 'Κουμπί'}</span>
          </div>
          <Field label="Κείμενο κουμπιού">
            <input
              className="emh-input mb-0"
              value={block.label || ''}
              onChange={(e) => onUpdate({ label: e.target.value })}
            />
          </Field>
          <Field label="Σύνδεσμος (URL)">
            <input
              className="emh-input mb-0"
              value={block.href || ''}
              onChange={(e) => onUpdate({ href: e.target.value })}
            />
          </Field>
        </>
      )}

      {block.type === 'product' && (
        <div className="emh-product-edit-card">
          {block.product ? (
            <>
              {block.product.image_url && (
                <img
                  src={block.product.image_url.startsWith('/') ? block.product.image_url : block.product.image_url}
                  alt=""
                  className="emh-thumb-img rounded-lg mb-2"
                />
              )}
              <p className="font-semibold text-[#0f172a] m-0">{block.product.title}</p>
              <p className="text-[#4f46e5] font-bold mt-1">€{Number(block.product.price).toFixed(2)}</p>
            </>
          ) : (
            <p className="emh-field-hint m-0">Δεν έχει επιλεγεί προϊόν</p>
          )}
          <button type="button" className="emh-btn-outline w-full mt-3 text-sm" onClick={onPickProduct}>
            {block.product ? 'Αλλαγή προϊόντος' : 'Επιλογή από inventory'}
          </button>
        </div>
      )}
    </div>
  );
}
