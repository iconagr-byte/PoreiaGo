/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  filterStitchCategories,
  filterStitchTemplates,
  isStitchTemplateUnlocked,
  resolveStitchTemplateAccess,
} from './stitchTemplateAccess.js';

describe('stitchTemplateAccess', () => {
  it('hides rent templates when rent is not enabled', () => {
    const access = resolveStitchTemplateAccess({
      rentEnabled: false,
      modules: { plan: 'starter' },
      subscription: { status: 'active', plan: 'starter' },
    });
    expect(access.rentEnabled).toBe(false);
    expect(access.newsletterEnabled).toBe(true);

    const cats = filterStitchCategories(
      [
        { id: 'all' },
        { id: 'newsletter', requiresModule: 'newsletter' },
        { id: 'rent', requiresModule: 'rent' },
      ],
      access,
    );
    expect(cats.map((c) => c.id)).toEqual(['all', 'newsletter']);

    const tpls = filterStitchTemplates(
      [
        { id: 'a', category: 'promotions' },
        { id: 'b', requiresModule: 'newsletter' },
        { id: 'c', requiresModule: 'rent' },
      ],
      access,
    );
    expect(tpls.map((t) => t.id)).toEqual(['a', 'b']);
    expect(isStitchTemplateUnlocked({ requiresModule: 'rent' }, access)).toBe(false);
  });

  it('keeps free templates always unlocked', () => {
    const access = resolveStitchTemplateAccess({ rentEnabled: false });
    expect(isStitchTemplateUnlocked({ category: 'promotions' }, access)).toBe(true);
  });
});
