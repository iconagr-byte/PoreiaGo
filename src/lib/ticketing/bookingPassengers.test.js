import { describe, expect, test } from 'vitest';
import {
  buildBookingPassengers,
  validateCompanionNames,
  getBookingPassengers,
  seatListFromBooking,
  expandWalletTickets,
  selectWalletPassBookings,
  sortWalletBookingsByDeparture,
  walletBookingDepartureMs,
} from './bookingPassengers.js';

describe('bookingPassengers', () => {
  test('builds booker + companions per seat', () => {
    const passengers = buildBookingPassengers({
      seats: ['5A', '5B'],
      bookerName: 'Μαρία Παπαδοπούλου',
      companionNames: ['Γιάννης Παπαδόπουλος'],
    });
    expect(passengers).toEqual([
      { seat: '5A', name: 'Μαρία Παπαδοπούλου', role: 'booker' },
      { seat: '5B', name: 'Γιάννης Παπαδόπουλος', role: 'companion' },
    ]);
  });

  test('validates missing companion names', () => {
    expect(validateCompanionNames(['5A', '5B'], [''])).toMatch(/5B/);
    expect(validateCompanionNames(['5A', '5B'], ['Γιάννης'])).toBeNull();
    expect(validateCompanionNames(['5A'], [])).toBeNull();
  });

  test('reads legacy booking without passengers array', () => {
    const list = getBookingPassengers({
      customerName: 'Μαρία',
      seats: ['1A', '1B'],
    });
    expect(list[0]).toEqual({ seat: '1A', name: 'Μαρία', role: 'booker' });
    expect(list[1].role).toBe('companion');
    expect(list[1].name).toBe('');
  });

  test('parses seat strings', () => {
    expect(seatListFromBooking('2A, 2B')).toEqual(['2A', '2B']);
  });

  test('prefers fuller seat string over truncated seats[]', () => {
    expect(
      seatListFromBooking({
        seats: ['5D'],
        seat: '5D, 5E, 5F',
      }),
    ).toEqual(['5D', '5E', '5F']);
  });

  test('expands short passengers[] to match all seats', () => {
    const list = getBookingPassengers({
      customerName: 'Buyer',
      seats: ['5D'],
      seat: '5D, 5E, 5F',
      passengers: [{ seat: '5D', name: 'Buyer', role: 'booker' }],
    });
    expect(list).toHaveLength(3);
    expect(list.map((p) => p.seat)).toEqual(['5D', '5E', '5F']);
    expect(list[0].name).toBe('Buyer');
    expect(list[1].role).toBe('companion');
  });

  test('expandWalletTickets flattens multi-seat bookings', () => {
    const tickets = expandWalletTickets([
      {
        id: 'B1',
        tripTitle: 'Ιωάννινα',
        seats: ['5D', '5E', '5F'],
        customerName: 'Buyer',
      },
    ]);
    expect(tickets).toHaveLength(3);
    expect(tickets[2].passenger.seat).toBe('5F');
  });

  test('expandWalletTickets keeps separate Achillio bookings sorted by date', () => {
    const tickets = expandWalletTickets([
      {
        id: 'B-ioa-5d',
        tripTitle: 'Μαγευτικά Ιωάννινα',
        date: '2026-06-17',
        time: '12:00 μ.μ.',
        seat: '5D',
        seats: ['5D'],
        customerName: 'sdsdsdsdsdsd',
        status: 'Επιβεβαιωμένη',
      },
      {
        id: 'B-ioa-4d',
        tripTitle: 'Μαγευτικά Ιωάννινα',
        date: '2026-06-17',
        time: '12:00 μ.μ.',
        seat: '4D',
        seats: ['4D'],
        customerName: 'Axilleas',
        status: 'Επιβεβαιωμένη',
      },
      {
        id: 'B-met-3a',
        tripTitle: 'Ημερήσια στα Μετέωρα',
        date: '2026-06-15',
        time: '08:00 π.μ.',
        seat: '3A',
        seats: ['3A'],
        customerName: 'Axilleas',
        status: 'Επιβεβαιωμένη',
      },
    ]);
    expect(tickets).toHaveLength(3);
    // Μετέωρα 2026-06-15 before Ιωάννινα 2026-06-17
    expect(tickets.map((t) => t.passenger.seat)).toEqual(['3A', '4D', '5D']);
    expect(tickets[0].booking.tripTitle).toMatch(/Μετέωρα/);
  });

  test('sortWalletBookingsByDeparture puts 2026-06-15 before 2026-06-17', () => {
    const sorted = sortWalletBookingsByDeparture([
      {
        id: 'ioannina',
        tripTitle: 'Μαγευτικά Ιωάννινα',
        date: '2026-06-17',
        time: '12:00 μ.μ.',
      },
      {
        id: 'meteora',
        tripTitle: 'Ημερήσια στα Μετέωρα',
        date: '2026-06-15',
        time: '08:00 π.μ.',
      },
    ]);
    expect(sorted.map((b) => b.id)).toEqual(['meteora', 'ioannina']);
    expect(walletBookingDepartureMs(sorted[0])).toBeLessThan(
      walletBookingDepartureMs(sorted[1]),
    );
  });

  test('expandWalletTickets splits seat string when seats[] truncated', () => {
    const tickets = expandWalletTickets([
      {
        id: 'B-party',
        tripTitle: 'Ιωάννινα',
        seats: ['5D'],
        seat: '5D, 4D',
        passengers: [{ seat: '5D', name: 'Buyer', role: 'booker' }],
        customerName: 'Buyer',
      },
    ]);
    expect(tickets).toHaveLength(2);
    expect(tickets.map((t) => t.passenger.seat)).toEqual(['5D', '4D']);
  });

  test('selectWalletPassBookings keeps past tickets when none are upcoming', () => {
    const now = new Date('2026-10-21T12:00:00');
    const selected = selectWalletPassBookings(
      [
        {
          id: 'B1',
          date: '2026-06-17',
          time: '12:00 μ.μ.',
          seat: '5D',
          status: 'Επιβεβαιωμένη',
        },
        {
          id: 'B2',
          date: '2026-06-17',
          time: '12:00 μ.μ.',
          seat: '4D',
          status: 'Επιβεβαιωμένη',
        },
        {
          id: 'B3',
          date: '2026-06-15',
          time: '08:00 π.μ.',
          seat: '3A',
          status: 'Επιβεβαιωμένη',
        },
        {
          id: 'B-x',
          date: '2026-06-01',
          seat: '1A',
          status: 'Ακυρωμένη',
        },
      ],
      { now },
    );
    expect(selected).toHaveLength(3);
    // Earliest calendar first — featured/front ticket is Μετέωρα (3A)
    expect(selected[0].seat).toBe('3A');
    expect(selected[0].date).toBe('2026-06-15');
    expect(selected.map((b) => b.date)).toEqual(['2026-06-15', '2026-06-17', '2026-06-17']);
  });

  test('selectWalletPassBookings prefers upcoming when mixed', () => {
    const now = new Date('2026-06-16T12:00:00');
    const selected = selectWalletPassBookings(
      [
        { id: 'past', date: '2026-06-15', seat: '3A', status: 'Επιβεβαιωμένη' },
        { id: 'next', date: '2026-06-17', seat: '5D', status: 'Επιβεβαιωμένη' },
        { id: 'next2', date: '2026-06-17', seat: '4D', status: 'Επιβεβαιωμένη' },
      ],
      { now },
    );
    expect(selected).toHaveLength(2);
    expect(selected.every((b) => b.date === '2026-06-17')).toBe(true);
    expect(selected.map((b) => b.id).sort()).toEqual(['next', 'next2']);
  });
});
