/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function installDom(html = '') {
  const listeners = new Map();
  const elements = new Map();

  const makeEl = (sel, tag = 'div') => {
    if (elements.has(sel)) return elements.get(sel);
    const el = {
      tagName: tag.toUpperCase(),
      id: sel.startsWith('#') ? sel.slice(1) : '',
      scrollIntoView: vi.fn(),
      getAttribute: (name) => el._attrs?.[name],
      _attrs: {},
    };
    elements.set(sel, el);
    return el;
  };

  const document = {
    scrollingElement: { scrollTo: vi.fn() },
    documentElement: { scrollTo: vi.fn() },
    body: { scrollTo: vi.fn() },
    defaultView: { scrollTo: vi.fn() },
    querySelector: (sel) => {
      if (html.includes(sel) || elements.has(sel)) {
        return makeEl(sel);
      }
      // Attribute / id shortcuts used by the mapping
      if (sel === '[data-pdw-editable="hero"]' && html.includes('data-pdw-editable="hero"')) {
        return makeEl(sel);
      }
      if (sel === '[data-pdw-editable="header"]' && html.includes('data-pdw-editable="header"')) {
        return makeEl(sel, 'header');
      }
      if (sel === '[data-pdw-editable="trips"]' && html.includes('data-pdw-editable="trips"')) {
        return makeEl(sel);
      }
      if (sel === '[data-pdw-editable="footer"]' && html.includes('data-pdw-editable="footer"')) {
        return makeEl(sel);
      }
      if (sel === '[data-pdw-brand]' && html.includes('data-pdw-brand')) {
        return makeEl(sel, 'a');
      }
      if (sel === '#hero' && html.includes('id="hero"')) return makeEl(sel);
      if (sel === '#header' && html.includes('id="header"')) return makeEl(sel, 'header');
      if (sel === '#trips' && html.includes('id="trips"')) return makeEl(sel);
      if (sel === '#footer' && html.includes('id="footer"')) return makeEl(sel);
      if (sel === '#search-results' && html.includes('id="search-results"')) return makeEl(sel);
      return null;
    },
  };

  globalThis.document = document;
  globalThis.window = {
    parent: null,
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
    dispatchEvent: () => true,
  };
  globalThis.requestAnimationFrame = (fn) => {
    fn();
    return 1;
  };

  return { document, elements, makeEl };
}

describe('pageDesignBridge scroll targets', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.requestAnimationFrame;
  });

  it('exposes SCROLL_TO_SECTION and a full section map', async () => {
    const mod = await import('./pageDesignBridge.js');
    expect(mod.PDW_BRIDGE.SCROLL_TO_SECTION).toBe('scroll-to-section');
    expect(mod.PDW_SECTION_SCROLL_TARGETS.header).toBeTruthy();
    expect(mod.PDW_SECTION_SCROLL_TARGETS.hero).toBeTruthy();
    expect(mod.PDW_SECTION_SCROLL_TARGETS.slider).toBeTruthy();
    expect(mod.PDW_SECTION_SCROLL_TARGETS.trips).toBeTruthy();
    expect(mod.PDW_SECTION_SCROLL_TARGETS.branding).toBeTruthy();
    expect(mod.PDW_SECTION_SCROLL_TARGETS.footer).toBeTruthy();
    expect(mod.PDW_SECTION_SCROLL_TARGETS.themes).toEqual([{ top: true }]);
  });

  it('scrolls themes to top of page', async () => {
    const { document } = installDom('');
    const mod = await import('./pageDesignBridge.js');
    const ok = mod.scrollPreviewToSection('themes', { root: document, behavior: 'smooth' });
    expect(ok).toBe(true);
    expect(document.scrollingElement.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('scrolls hero / slider via data-pdw-editable', async () => {
    const { document, elements } = installDom('data-pdw-editable="hero"');
    const mod = await import('./pageDesignBridge.js');
    expect(mod.scrollPreviewToSection('hero', { root: document })).toBe(true);
    expect(mod.scrollPreviewToSection('slider', { root: document })).toBe(true);
    const hero = elements.get('[data-pdw-editable="hero"]');
    expect(hero.scrollIntoView).toHaveBeenCalled();
  });

  it('scrolls trips / footer / branding to matching anchors', async () => {
    const { document, elements } = installDom(
      'data-pdw-editable="trips" data-pdw-editable="footer" data-pdw-brand',
    );
    const mod = await import('./pageDesignBridge.js');
    expect(mod.scrollPreviewToSection('trips', { root: document })).toBe(true);
    expect(mod.scrollPreviewToSection('footer', { root: document })).toBe(true);
    expect(mod.scrollPreviewToSection('branding', { root: document })).toBe(true);
    expect(elements.get('[data-pdw-editable="trips"]').scrollIntoView).toHaveBeenCalled();
    expect(elements.get('[data-pdw-editable="footer"]').scrollIntoView).toHaveBeenCalled();
    expect(elements.get('[data-pdw-brand]').scrollIntoView).toHaveBeenCalled();
  });
});
