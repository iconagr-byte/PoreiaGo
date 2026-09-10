import {
  buildBookingPassengers,
  validateCompanionNames,
  getBookingPassengers,
  seatListFromBooking,
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
});
