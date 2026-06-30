/** HTML wrapper & helpers για compose / preview email. */

function esc(s) {
  if (typeof document === 'undefined') {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

const DEFAULT_SIGNATURE = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">
<tr><td style="font-family:Inter,Segoe UI,Arial,sans-serif;font-size:13px;color:#64748b;line-height:1.5;">
<strong style="color:#0f172a;">PoreiaGo Travel</strong><br/>
<a href="mailto:info@poreiago.app" style="color:#4f46e5;text-decoration:none;">info@poreiago.app</a>
</td></tr></table>`;

export function buildComposeHtml({
  body_html = '<p></p>',
  preheader = '',
  includeSignature = true,
  signatureHtml = DEFAULT_SIGNATURE,
}) {
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</div>`
    : '';
  const sig = includeSignature ? signatureHtml : '';
  const inner = body_html || '<p></p>';
  return `<!DOCTYPE html>
<html lang="el"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;">
${pre}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:20px 12px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;padding:28px 24px;box-shadow:0 2px 12px rgba(15,23,42,.06);">
<tr><td style="font-size:15px;line-height:1.65;color:#334155;">${inner}</td></tr>
${sig ? `<tr><td>${sig}</td></tr>` : ''}
</table></td></tr></table></body></html>`;
}

export const COMPOSE_SNIPPETS = [
  { id: 'greet', label: 'Χαιρετισμός', html: '<p>Αγαπητέ/ή πελάτη,</p>' },
  { id: 'thanks', label: 'Ευχαριστία', html: '<p>Σας ευχαριστούμε για την εμπιστοσύνη σας.</p>' },
  {
    id: 'cta',
    label: 'Κουμπί CTA',
    html: '<p style="text-align:center;margin:20px 0;"><a href="https://example.com" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Κράτηση τώρα</a></p>',
  },
  { id: 'farewell', label: 'Αποχαιρετισμός', html: '<p>Με εκτίμηση,<br/><strong>Η ομάδα PoreiaGo</strong></p>' },
];
