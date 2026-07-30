import { describe, it, expect } from 'vitest';
import { dedupeStoredItems } from './useAdminNotifications.js';

describe('admin notification chat dedupe', () => {
  it('collapses repeated Νέο μήνυμα οδηγού rows per driver', () => {
    const rows = dedupeStoredItems([
      {
        id: 'chat-1710000000001',
        type: 'driver_office_chat',
        title: 'Νέο μήνυμα οδηγού',
        body: '1 μη αναγνωσμένα',
        driverId: 'd1',
        at: '2026-07-30T21:56:00Z',
      },
      {
        id: 'chat-1710000000002',
        type: 'driver_office_chat',
        title: 'Νέο μήνυμα οδηγού',
        body: '1 μη αναγνωσμένα',
        driverId: 'd1',
        at: '2026-07-30T21:53:00Z',
      },
      {
        id: 'chat-1710000000003',
        type: 'driver_office_chat',
        title: 'Νέο μήνυμα οδηγού',
        body: 'Achilleas Charalambidis',
        driverId: 'd1',
        at: '2026-07-30T21:51:00Z',
      },
      {
        id: 'alert-1',
        type: 'sos',
        title: 'SOS οδηγού',
        body: 'help',
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('chat-d1');
    expect(rows[0].body).toBe('1 μη αναγνωσμένα');
    expect(rows[1].id).toBe('alert-1');
  });

  it('keeps separate chat rows for different drivers', () => {
    const rows = dedupeStoredItems([
      {
        id: 'chat-a',
        type: 'driver_office_chat',
        driverId: 'd1',
        title: 'Νέο μήνυμα οδηγού',
      },
      {
        id: 'chat-b',
        type: 'driver_office_chat',
        driverId: 'd2',
        title: 'Νέο μήνυμα οδηγού',
      },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['chat-d1', 'chat-d2']);
  });
});
