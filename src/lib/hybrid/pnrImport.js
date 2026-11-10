/**
 * Parse airline group PNR / passenger CSV into hybrid manifest rows.
 * Accepts headers like: name, passenger, ground_seat, flight_seat, pnr, ticket, flight_number
 */
import { emptyPassengerSeat } from './hybridDefaults.js';

const NAME_KEYS = ['passenger_name', 'passenger', 'name', 'ονομα', 'ονοματεπωνυμο', 'full_name'];
const GROUND_KEYS = ['ground_seat', 'bus_seat', 'seat', 'θεση', 'θεση_λεωφορειου'];
const FLIGHT_SEAT_KEYS = ['flight_seat', 'air_seat', 'seat_air', 'θεση_πτησης'];
const PNR_KEYS = ['pnr', 'pnr_code', 'booking_ref', 'group_pnr'];
const TICKET_KEYS = ['ticket', 'ticket_code', 'e_ticket', 'eticket'];
const FLIGHT_KEYS = ['flight_id', 'flight_number', 'flight', 'πτηση'];

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== '') return String(row[k]).trim();
  }
  return '';
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function parsePnrCsv(text, { flights = [], defaultFlightId = '' } = {}) {
  const raw = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!raw) return { rows: [], errors: ['Άδειο αρχείο'] };

  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], errors: ['Χρειάζεται γραμμή κεφαλίδων και τουλάχιστον μία γραμμή'] };

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const flightMap = Object.fromEntries(
    (flights || []).map((f) => [String(f.flight_number || '').toUpperCase().replace(/\s+/g, ''), f]),
  );

  const rows = [];
  const errors = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    if (cols.every((c) => !c)) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? '';
    });
    const name = pick(obj, NAME_KEYS);
    if (!name) {
      errors.push(`Γραμμή ${i + 1}: λείπει όνομα επιβάτη`);
      continue;
    }
    const flightRef = pick(obj, FLIGHT_KEYS).toUpperCase().replace(/\s+/g, '');
    let flight_id = defaultFlightId || flights[0]?.id || '';
    if (flightRef && flightMap[flightRef]) flight_id = flightMap[flightRef].id;
    else if (/^[0-9a-f-]{36}$/i.test(flightRef)) flight_id = flightRef;

    const fl = (flights || []).find((f) => f.id === flight_id);
    rows.push(
      emptyPassengerSeat({
        passenger_name: name,
        ground_seat: pick(obj, GROUND_KEYS),
        flight_seat: pick(obj, FLIGHT_SEAT_KEYS),
        pnr_code: pick(obj, PNR_KEYS) || fl?.pnr_code || '',
        ticket_code: pick(obj, TICKET_KEYS),
        flight_id,
      }),
    );
  }

  return { rows, errors };
}

export const PNR_CSV_TEMPLATE = `passenger_name,ground_seat,flight_seat,pnr,ticket,flight_number
Papadopoulos Nikos,12A,14C,ABC123,ET001,A3520
Ioannou Maria,12B,14D,ABC123,ET002,A3520
`;
