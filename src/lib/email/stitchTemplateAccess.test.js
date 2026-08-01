/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  isStitchTemplateUnlocked,
  resolveStitchTemplateAccess,
} from './stitchTemplateAccess.js';

describe('stitchTemplateAccess', () => {
  it('unlocks rent templates only when rent is enabled', () => {
    const locked = resolveStitchTemplateAccess({
      rentEnabled: false,
      modules: { plan: 'starter' },
      subscription: { status: 'active', plan: 'starter' },
    });
    expect(locked.rentEnabled).toBe(false);
    expect(locked.newsletterEnabled).toBe(true);
    expect(
      isStitchTemplateUnlocked({ requiresModule: 'rent' }, locked),
    ).toBe(false);
    expect(
      isStitchTemplateUnlocked({ requiresModule: 'newsletter' }, locked),
    ).toBe(true);

    const open = resolveStitchTemplateAccess({
      rentEnabled: true,
      modules: { plan: 'rent', rent_enabled: true },
      subscription: { status: 'active', plan: 'rent' },
    });
    expect(open.rentEnabled).toBe(true);
    expect(isStitchTemplateUnlocked({ requiresModule: 'rent' }, open)).toBe(true);
  });

  it('keeps free templates always unlocked', () => {
    const access = resolveStitchTemplateAccess({ rentEnabled: false });
    expect(isStitchTemplateUnlocked({ category: 'promotions' }, access)).toBe(true);
  });
});
