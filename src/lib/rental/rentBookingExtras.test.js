import { describe, expect, it } from 'vitest';
import {
  RENT_COVERAGE_OPTIONS,
  createCoverageOption,
  normalizeCoverageOptions,
  normalizeIncludedDefaults,
  extrasDayTotal,
  readExtrasSelection,
  resolveUpsellCoverage,
  visibleCoverageOptions,
} from './rentBookingExtras.js';

describe('rentBookingExtras catalog', () => {
  it('normalizes empty overrides to defaults', () => {
    const opts = normalizeCoverageOptions([]);
    expect(opts.length).toBe(RENT_COVERAGE_OPTIONS.length);
    expect(opts[0].title).toBe('SCDW Plus');
  });

  it('keeps custom prices and filters hidden from booking', () => {
    const opts = normalizeCoverageOptions([
      { id: 'scdw', title: 'SCDW Custom', eurPerDay: 20, formKey: 'extra_insurance', visible: true },
      { id: 'hidden', title: 'Hidden', eurPerDay: 99, formKey: 'hidden_x', visible: false },
    ]);
    expect(opts).toHaveLength(2);
    expect(opts[0].eurPerDay).toBe(20);
    expect(visibleCoverageOptions(opts)).toHaveLength(1);
    const sel = readExtrasSelection({ extra_insurance: true }, opts);
    expect(extrasDayTotal(sel, opts)).toBe(20);
  });

  it('creates unique form keys', () => {
    const a = createCoverageOption({ title: 'A', formKey: 'extra' });
    const b = createCoverageOption({ title: 'B', formKey: 'extra' });
    const list = normalizeCoverageOptions([a, b]);
    expect(list[0].formKey).not.toBe(list[1].formKey);
  });

  it('normalizes included bullets', () => {
    expect(normalizeIncludedDefaults(['  a ', '', 'b'])).toEqual(['a', 'b']);
    expect(normalizeIncludedDefaults([])).toContain('Basic CDW');
  });

  it('resolves preferred upsell when not selected', () => {
    const opts = normalizeCoverageOptions(RENT_COVERAGE_OPTIONS);
    const preferred = opts.find((o) => o.id === 'super_cover') || opts[1];
    const hit = resolveUpsellCoverage(opts, {}, preferred.id);
    expect(hit?.id).toBe(preferred.id);
    const afterPick = resolveUpsellCoverage(opts, { [preferred.formKey]: true }, preferred.id);
    expect(afterPick?.id).not.toBe(preferred.id);
    expect(afterPick).toBeTruthy();
  });
});
