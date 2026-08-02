import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRIP_EXTRA_OPTIONS,
  applyExtrasToPending,
  buildTripExtrasLines,
  createTripExtraOption,
  normalizeTripExtraOptions,
  tripExtrasTotal,
  visibleTripExtraOptions,
} from './tripBookingExtras.js';

describe('tripBookingExtras catalog', () => {
  it('falls back to defaults when empty', () => {
    const opts = normalizeTripExtraOptions([]);
    expect(opts.length).toBe(DEFAULT_TRIP_EXTRA_OPTIONS.length);
    expect(opts[0].title).toContain('Ασφάλεια');
  });

  it('prices per person and per booking', () => {
    const catalog = normalizeTripExtraOptions([
      { id: 'a', title: 'Meal', eur: 10, priceMode: 'per_person', formKey: 'meal' },
      { id: 'b', title: 'Bag', eur: 5, priceMode: 'per_booking', formKey: 'bag' },
    ]);
    const sel = { meal: true, bag: true };
    expect(tripExtrasTotal(sel, catalog, 3)).toBe(35);
    const lines = buildTripExtrasLines(sel, catalog, 3);
    expect(lines.find((l) => l.id === 'a')?.qty).toBe(3);
    expect(lines.find((l) => l.id === 'b')?.qty).toBe(1);
  });

  it('hides invisible options from booking', () => {
    const opts = normalizeTripExtraOptions([
      { id: 'a', title: 'On', eur: 1, visible: true, formKey: 'on' },
      { id: 'b', title: 'Off', eur: 9, visible: false, formKey: 'off' },
    ]);
    expect(visibleTripExtraOptions(opts)).toHaveLength(1);
  });

  it('dedupes form keys', () => {
    const list = normalizeTripExtraOptions([
      createTripExtraOption({ title: 'A', formKey: 'extra' }),
      createTripExtraOption({ title: 'B', formKey: 'extra' }),
    ]);
    expect(list[0].formKey).not.toBe(list[1].formKey);
  });

  it('applies extras onto pending checkout total', () => {
    const catalog = normalizeTripExtraOptions([
      { id: 'meal', title: 'Meal', eur: 12, priceMode: 'per_person', formKey: 'meal' },
    ]);
    const next = applyExtrasToPending(
      { tripId: 1, seats: '1A,1B', total: 80, seatBreakdown: [{ number: '1A' }, { number: '1B' }] },
      { meal: true },
      catalog,
    );
    expect(next.seatSubtotal).toBe(80);
    expect(next.extrasTotal).toBe(24);
    expect(next.total).toBe(104);
    expect(next.extras).toHaveLength(1);
  });
});
