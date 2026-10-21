import { describe, expect, it } from 'vitest';
import { qrLookupIds } from './useRotatingTicketQr.js';

describe('qrLookupIds', () => {
  it('puts the booking id first and avoids duplicate pnr noise', () => {
    const ids = qrLookupIds({ id: 'B-B95F8658', pnr: 'BK-B95F8658' });
    expect(ids[0]).toBe('B-B95F8658');
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('BK-B95F8658');
  });

  it('prefers local B- form from pnr before invented B-BK- alias', () => {
    const ids = qrLookupIds({ id: 'BK-B95F8658', pnr: 'BK-B95F8658' });
    expect(ids.indexOf('B-B95F8658')).toBeLessThan(ids.indexOf('B-BK-B95F8658'));
  });
});
