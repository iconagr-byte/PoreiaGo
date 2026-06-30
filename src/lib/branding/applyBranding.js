const STORAGE_KEY = 'aerostride_branding_v1';

export function cacheBranding(branding) {
  if (!branding) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(branding));
  applyBrandingToDocument(branding);
}

export function loadCachedBranding() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function applyBrandingToDocument(branding) {
  if (!branding) return;
  const root = document.documentElement;
  if (branding.primary_color) {
    root.style.setProperty('--color-primary', branding.primary_color);
    root.style.setProperty('--primary', branding.primary_color);
  }
  if (branding.display_name) {
    document.title = document.title.includes('|')
      ? `${branding.display_name} | ${document.title.split('|').pop().trim()}`
      : branding.display_name;
  }

  let styleEl = document.getElementById('tenant-branding-css');
  if (branding.css_injection_inline) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'tenant-branding-css';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = branding.css_injection_inline;
  } else if (styleEl) {
    styleEl.remove();
  }

  if (branding.css_injection_url) {
    let linkEl = document.getElementById('tenant-branding-css-link');
    if (!linkEl) {
      linkEl = document.createElement('link');
      linkEl.id = 'tenant-branding-css-link';
      linkEl.rel = 'stylesheet';
      document.head.appendChild(linkEl);
    }
    linkEl.href = branding.css_injection_url;
  }
}
