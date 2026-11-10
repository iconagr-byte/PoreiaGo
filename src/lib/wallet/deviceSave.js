/**
 * Save booking to phone — calendar (.ics), share, Google Calendar link.
 * Apple/Google Wallet passes need server certificates (see wallet-pass status API).
 */

function pad(n) {
  return String(n).padStart(2, '0');
}

/** @param {Date} d */
function toIcsUtc(d) {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcs(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * @param {object} booking
 * @returns {{ start: Date, end: Date } | null}
 */
export function bookingDateRange(booking) {
  if (!booking?.date) return null;
  const time = String(booking.time || '09:00').trim();
  const m = time.match(/^(\d{1,2}):(\d{2})/);
  const hh = m ? Number(m[1]) : 9;
  const mm = m ? Number(m[2]) : 0;
  const start = new Date(`${booking.date}T${pad(hh)}:${pad(mm)}:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 8 * 60 * 60 * 1000);
  return { start, end };
}

/** @param {object} booking */
export function buildBookingIcs(booking) {
  const range = bookingDateRange(booking);
  if (!range) return null;
  const pnr = booking.pnr || booking.id;
  const title = booking.tripTitle || 'Εκδρομή';
  const desc = [
    `Κράτηση ${booking.id}`,
    pnr ? `PNR ${pnr}` : '',
    booking.seat ? `Θέση ${booking.seat}` : '',
    booking.email || '',
  ]
    .filter(Boolean)
    .join('\n');

  const uid = `${booking.id}@poreiago-wallet`;
  const stamp = toIcsUtc(new Date());
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PoreiaGo//My Wallet//EL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsUtc(range.start)}`,
    `DTEND:${toIcsUtc(range.end)}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(desc)}`,
    `LOCATION:${escapeIcs(title)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** @param {object} booking */
export function downloadBookingIcs(booking) {
  const body = buildBookingIcs(booking);
  if (!body) throw new Error('Λείπει ημερομηνία κράτησης');
  const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${booking.pnr || booking.id || 'trip'}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Google Calendar template URL (no API key). */
export function googleCalendarUrl(booking) {
  const range = bookingDateRange(booking);
  if (!range) return null;
  const fmt = (d) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: booking.tripTitle || 'Εκδρομή',
    dates: `${fmt(range.start)}/${fmt(range.end)}`,
    details: [
      `Κράτηση ${booking.id}`,
      booking.pnr ? `PNR ${booking.pnr}` : '',
      booking.seat ? `Θέση ${booking.seat}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** @param {object} booking */
export function bookingSharePayload(booking) {
  const pnr = booking.pnr || booking.id;
  const title = booking.tripTitle || 'Εισιτήριο';
  const lines = [
    title,
    booking.date ? `Ημερομηνία: ${booking.date}${booking.time ? ` ${booking.time}` : ''}` : '',
    booking.seat ? `Θέση: ${booking.seat}` : '',
    `Κωδικός: ${pnr}`,
    typeof window !== 'undefined' ? `${window.location.origin}/wallet` : '',
  ].filter(Boolean);
  return {
    title: `My Wallet · ${title}`,
    text: lines.join('\n'),
    url: typeof window !== 'undefined' ? `${window.location.origin}/wallet` : undefined,
  };
}

export async function shareBooking(booking) {
  const payload = bookingSharePayload(booking);
  if (typeof navigator !== 'undefined' && navigator.share) {
    await navigator.share({
      title: payload.title,
      text: payload.text,
      url: payload.url,
    });
    return 'shared';
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(payload.text);
    return 'copied';
  }
  throw new Error('Η κοινή χρήση δεν υποστηρίζεται σε αυτή τη συσκευή');
}
