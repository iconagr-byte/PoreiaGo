/**
 * @vitest-environment node
 *
 * Lightweight draft-sync smoke tests for the page-design Split preview.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function installStorage() {
  const maps = { local: new Map(), session: new Map() };
  const make = (kind) => ({
    getItem: (k) => (maps[kind].has(k) ? maps[kind].get(k) : null),
    setItem: (k, v) => maps[kind].set(String(k), String(v)),
    removeItem: (k) => maps[kind].delete(k),
    clear: () => maps[kind].clear(),
  });
  globalThis.localStorage = make('local');
  globalThis.sessionStorage = make('session');
}

function installWindow(search = '') {
  const listeners = new Map();
  globalThis.window = {
    location: { search },
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
    dispatchEvent: (event) => {
      const set = listeners.get(event.type);
      if (!set) return true;
      for (const fn of set) fn(event);
      return true;
    },
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
  return listeners;
}

describe('homepagePreview draft sync', () => {
  beforeEach(() => {
    vi.resetModules();
    installStorage();
    installWindow('');
  });

  afterEach(() => {
    delete globalThis.window;
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
    delete globalThis.CustomEvent;
  });

  it('writes and reads draft appearance', async () => {
    const mod = await import('./homepagePreview.js');
    mod.pushHomepagePreviewDraft({
      accent_color: '#112233',
      footer_brand_name: 'Demo Office',
    });
    const draft = mod.readHomepagePreviewDraft();
    expect(draft.accent_color).toBe('#112233');
    expect(draft.footer_brand_name).toBe('Demo Office');
    expect(draft._previewAt).toBeUndefined();
  });

  it('detects preview query mode', async () => {
    installWindow('');
    let mod = await import('./homepagePreview.js');
    expect(mod.isStorefrontPreviewMode()).toBe(false);

    vi.resetModules();
    installStorage();
    installWindow('?preview=1');
    mod = await import('./homepagePreview.js');
    expect(mod.isStorefrontPreviewMode()).toBe(true);
  });

  it('notifies subscribers via custom event', async () => {
    const mod = await import('./homepagePreview.js');
    const seen = [];
    const unsub = mod.subscribeHomepagePreviewDraft((draft) => {
      seen.push(draft?.footer_brand_name || null);
    });
    mod.pushHomepagePreviewDraft({ footer_brand_name: 'Split Live' });
    expect(seen).toContain('Split Live');
    unsub();
  });
});
