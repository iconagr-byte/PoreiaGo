import {
  buildBookingPassengers,
  validateCompanionNames,
  getBookingPassengers,
  seatListFromBooking,
  expandWalletTickets,
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
});
