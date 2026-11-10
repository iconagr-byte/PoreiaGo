/**
 * Serialize the rendered ticket QR (SVG) to a data URL for offline display.
 */

export function svgElementToDataUrl(svg) {
  if (!svg) return '';
  try {
    const xml = new XMLSerializer().serializeToString(svg);
    const encoded = window.btoa(unescape(encodeURIComponent(xml)));
    return `data:image/svg+xml;base64,${encoded}`;
  } catch {
    return '';
  }
}
