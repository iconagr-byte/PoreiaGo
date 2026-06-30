/** Client-side compile blocks → HTML (συγχρονισμένο με backend campaign_compiler). */

const HEADER_DEFAULT =
  'https://images.unsplash.com/photo-1469854523086-cc02afe5c88c?auto=format&fit=crop&w=1200&h=400&q=80';
const PRODUCT_ICON =
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=96&h=96&fit=crop&q=80';
const BTN_RADIUS = '8px';
const BTN_SHADOW = '0 4px 14px rgba(15,23,42,0.18)';

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function headerBlockHtml(url, alt = 'PoreiaGo Travel', theme) {
  const u = esc(url || HEADER_DEFAULT);
  const a = esc(alt);
  const isHorizon = theme === 'horizon';
  const stripBg = isHorizon
    ? 'linear-gradient(135deg,#cde5ff 0%,#f6f3f5 100%)'
    : 'linear-gradient(135deg,#f8fafc 0%,#eef2ff 100%)';
  const brandColor = isHorizon ? '#005d90' : '#4f46e5';
  const brandLabel = isHorizon ? 'Voyage Travel' : 'PoreiaGo Travel';
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0;line-height:0;font-size:0;">
<img src="${u}" alt="${a}" width="600" style="display:block;width:100%;max-width:600px;height:auto;min-height:180px;object-fit:cover;border-radius:8px 8px 0 0;" />
</td></tr>
<tr><td style="padding:16px 20px;background:${stripBg};border-bottom:1px solid #e2e8f0;">
<table role="presentation" width="100%"><tr>
<td style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${brandColor};font-weight:700;">${brandLabel}</td>
<td align="right" style="font-size:11px;color:#64748b;">Horizon Ethos</td>
</tr></table>
</td></tr>
</table>`;
}

export function productBlockHtml(product, baseUrl = '') {
  const title = esc(product.title || 'Προϊόν');
  const price = Number(product.price || 0).toFixed(2);
  let img = product.image_url || '';
  if (img.startsWith('/') && baseUrl) img = baseUrl.replace(/\/$/, '') + img;
  if (!img) {
    img =
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=600&fit=crop&q=80';
  }
  const desc = product.description
    ? `<p style="margin:6px 0 0 0;font-size:13px;color:#64748b;">${esc(product.description)}</p>`
    : '';
  const stock =
    product.stock != null
      ? `<p style="margin:6px 0 0 0;font-size:12px;color:#64748b;">Διαθέσιμο: ${product.stock} τεμ.</p>`
      : '';
  const buyUrl = esc(product.buy_url || `${baseUrl || ''}/trips`);
  const hero = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0;line-height:0;">
<div style="max-width:100%;border-radius:8px 8px 0 0;overflow:hidden;">
<img src="${esc(img)}" alt="${title}" width="536" style="display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;" />
</div>
</td></tr></table>`;
  const icon = `<img src="${PRODUCT_ICON}" alt="" width="44" height="44" style="width:44px;height:44px;border-radius:8px;object-fit:cover;" />`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border-radius:${BTN_RADIUS};overflow:hidden;box-shadow:${BTN_SHADOW};border:1px solid #e2e8f0;">
<tr><td style="padding:0;">${hero}</td></tr>
<tr><td style="padding:18px 20px;background:#ffffff;">
<table role="presentation" width="100%"><tr>
<td width="48" valign="top">${icon}</td>
<td style="padding-left:12px;">
<h3 style="margin:0;font-size:18px;color:#0f172a;">${title}</h3>
<p style="margin:6px 0 0 0;font-size:20px;color:#059669;font-weight:700;">€${price}</p>
${desc}${stock}
</td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:16px auto 4px auto;">
<tr><td style="border-radius:${BTN_RADIUS};background-color:#7c3aed;box-shadow:${BTN_SHADOW};">
<a href="${buyUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;border-radius:${BTN_RADIUS};">Αγορά</a>
</td></tr></table>
</td></tr></table>`;
}

export function compileBlock(block, baseUrl = '') {
  const t = block.type;
  if (t === 'header') {
    return headerBlockHtml(block.url, block.alt, block.theme);
  }
  if (t === 'text') {
    return `<div style="margin:12px 0;line-height:1.6;color:#334155;">${block.content || ''}</div>`;
  }
  if (t === 'image') {
    if (!block.url) return '';
    return `<div style="margin:16px 0;text-align:center;border-radius:${BTN_RADIUS};overflow:hidden;"><img src="${esc(block.url)}" alt="${esc(block.alt || '')}" style="max-width:100%;border-radius:${BTN_RADIUS};display:block;" /></div>`;
  }
  if (t === 'cta') {
    const label = esc(block.label || 'Μάθετε περισσότερα');
    const href = esc(block.href || baseUrl || '#');
    const bg = block.bg || '#7c3aed';
    const textColor = block.textColor || '#ffffff';
    return `<div style="margin:20px 0;text-align:center;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr><td style="border-radius:${BTN_RADIUS};background-color:${bg};box-shadow:${BTN_SHADOW};">
<a href="${href}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:${textColor};text-decoration:none;border-radius:${BTN_RADIUS};">${label}</a>
</td></tr></table></div>`;
  }
  if (t === 'product') {
    if (block.productHtml) return block.productHtml;
    return productBlockHtml(block.product || block, baseUrl);
  }
  return '';
}

export function compileBlocksToHtml(blocks, { preheader = '', baseUrl = '' } = {}) {
  const list = blocks || [];
  const inner = list.map((b) => compileBlock(b, baseUrl)).join('');
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;">${esc(preheader)}</div>`
    : '';
  const isHorizon = list.some((b) => b.type === 'header' && b.theme === 'horizon');
  const footerLabel = isHorizon
    ? 'Voyage Travel · Horizon Ethos'
    : 'PoreiaGo Travel';
  const fonts = isHorizon
    ? '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Montserrat:wght@600;700&display=swap" rel="stylesheet">'
    : '';
  const fontFamily = isHorizon
    ? 'Montserrat,Inter,Segoe UI,Arial,sans-serif'
    : 'Inter,Segoe UI,Arial,sans-serif';
  return `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${fonts}</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:${fontFamily};">
${pre}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08);">
<tr><td style="padding:28px 24px;">${inner}</td></tr>
<tr><td style="padding:16px 24px;background:#f8fafc;text-align:center;font-size:11px;color:#94a3b8;">${footerLabel}</td></tr>
</table></td></tr></table></body></html>`;
}

export function newBlock(type) {
  const id = `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  if (type === 'header') {
    return { id, type: 'header', url: HEADER_DEFAULT, alt: 'PoreiaGo Travel' };
  }
  if (type === 'text') return { id, type: 'text', content: '<p>Νέο κείμενο…</p>' };
  if (type === 'image') return { id, type: 'image', url: '', alt: '' };
  if (type === 'cta') {
    return { id, type: 'cta', label: 'Κράτηση τώρα', href: 'http://localhost:5173/trips', bg: '#ffb702', textColor: '#1D1D1F' };
  }
  if (type === 'product') return { id, type: 'product', product: null, productHtml: null };
  return { id, type: 'text', content: '' };
}

/** Φόρτωση blocks από αποθηκευμένη καμπάνια (blocks_json ή legacy body_html). */
export function blocksFromCampaign(campaign) {
  if (campaign?.blocks_json) {
    try {
      const parsed = JSON.parse(campaign.blocks_json);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      /* ignore */
    }
  }
  const raw = campaign?.body_html || '';
  if (!raw.trim()) return [newBlock('header'), newBlock('text')];
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const content = (bodyMatch ? bodyMatch[1] : raw).trim();
  return [newBlock('header'), { ...newBlock('text'), content: content || '<p></p>' }];
}

/** Μεταδεδομένα block — ετικέτες & εικονίδια Lucide */
export const BLOCK_META = {
  header: { label: 'Hero', icon: 'Image', accent: '#6366f1' },
  text: { label: 'Κείμενο', icon: 'Type', accent: '#0ea5e9' },
  image: { label: 'Εικόνα', icon: 'ImagePlus', accent: '#8b5cf6' },
  cta: { label: 'CTA', icon: 'MousePointerClick', accent: '#059669' },
  product: { label: 'Προϊόν', icon: 'Package', accent: '#d97706' },
};

export function blockSummary(block) {
  if (!block) return '';
  if (block.type === 'text') {
    const plain = (block.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return plain.slice(0, 48) || 'Κενό κείμενο';
  }
  if (block.type === 'header' || block.type === 'image') {
    return block.url ? 'Με εικόνα' : 'Χωρίς εικόνα';
  }
  if (block.type === 'cta') return block.label || 'Κουμπί';
  if (block.type === 'product') return block.product?.title || 'Επιλέξτε προϊόν';
  return block.type;
}

/** Lucide icon names for visual block cards */
export const BLOCK_PALETTE = [
  { type: 'header', label: 'Hero', icon: 'Image' },
  { type: 'text', label: 'Κείμενο', icon: 'Type' },
  { type: 'image', label: 'Εικόνα', icon: 'ImagePlus' },
  { type: 'cta', label: 'CTA', icon: 'MousePointerClick' },
  { type: 'product', label: 'Προϊόν', icon: 'Package' },
];

/** Fallback αν το API segments δεν είναι διαθέσιμο */
export const SEGMENT_OPTIONS = [
  { id: 'all', label: 'Όλοι οι πελάτες', description: '', count: 0 },
  { id: 'subscribed_only', label: 'Newsletter', description: 'GDPR', count: 0 },
  { id: 'active_30d', label: 'Ενεργοί (< 30 ημέρες)', description: '', count: 0 },
  { id: 'recent_buyers', label: 'Πρόσφατες κρατήσεις', description: '', count: 0 },
  { id: 'never_bought', label: 'Χωρίς αγορά', description: '', count: 0 },
  { id: 'inactive_6m', label: 'Ανενεργοί (> 6 μήνες)', description: '', count: 0 },
];
