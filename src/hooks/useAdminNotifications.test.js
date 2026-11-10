import { describe, it, expect } from 'vitest';
import {
  alertBelongsToTenant,
  dedupeStoredItems,
  isDemoFleetMockAlert,
  scrubInboxForTenant,
} from './useAdminNotifications.js';

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

  it('collapses timestamp chat ids without driver into one office row', () => {
    const rows = dedupeStoredItems([
      {
        id: 'chat-1785447000000',
        type: 'driver_office_chat',
        title: 'Νέο μήνυμα οδηγού',
        body: '1 μη αναγνωσμένα',
      },
      {
        id: 'chat-1785447060000',
        type: 'driver_office_chat',
        title: 'Νέο μήνυμα οδηγού',
        body: '1 μη αναγνωσμένα',
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('chat-office');
  });
});

describe('admin notification tenant seal', () => {
  it('detects the shared demo ROUTE_DEVIATION mock', () => {
    expect(
      isDemoFleetMockAlert({
        id: 'mock-1',
        message: 'Αποκλίνουσα διαδρομή — 120m εκτός διαδρόμου',
        vehicle_id: 'demo-vehicle-1',
        tenant_id: '00000000-0000-0000-0000-000000000001',
      }),
    ).toBe(true);
    expect(
      isDemoFleetMockAlert({
        id: 'alert-real-9',
        body: 'Αποκλίνουσα διαδρομή — 80m εκτός διαδρόμου',
        tenantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      }),
    ).toBe(false);
  });

  it('scrubs demo mock from non-demo office inbox', () => {
    const officeTid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const rows = scrubInboxForTenant(
      [
        {
          id: 'alert-mock-1',
          type: 'route_deviation',
          title: 'Ειδοποίηση στόλου',
          body: 'Αποκλίνουσα διαδρομή — 120m εκτός διαδρόμου',
          tenantId: '00000000-0000-0000-0000-000000000001',
        },
        {
          id: 'alert-real',
          type: 'sos',
          title: 'SOS οδηγού',
          body: 'help',
          tenantId: officeTid,
        },
      ],
      officeTid,
    );
    expect(rows.map((r) => r.id)).toEqual(['alert-real']);
  });

  it('rejects alerts for another tenant', () => {
    expect(
      alertBelongsToTenant(
        { tenant_id: 'tenant-a' },
        'tenant-b',
      ),
    ).toBe(false);
    expect(alertBelongsToTenant({ tenant_id: 'tenant-a' }, 'tenant-a')).toBe(true);
    expect(alertBelongsToTenant({}, 'tenant-a')).toBe(true);
  });
});
