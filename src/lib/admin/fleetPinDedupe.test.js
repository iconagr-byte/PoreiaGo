import {
  collapseVehicleListByPlate,
  dedupeVehiclesByPlate,
  normalizePlateString,
  preferVehicleRow,
  isHardwareTrackerRow,
  isPhoneGpsRow,
} from './fleetPinDedupe.js';

const nowIso = new Date().toISOString();
const tel = {
  id: 'tel-1',
  vehicle_id: 'tel-1',
  bus_plate: 'EEX5670',
  source: 'teltonika',
  imei: '861076085468260',
  lat: 40.8,
  lng: 22.05,
  timestamp: '2026-03-25T12:00:00.000Z',
  tracker_signal_at: nowIso,
};
const app = {
  id: 'app-1',
  vehicle_id: 'app-1',
  bus_plate: 'EEX5670',
  source: 'driver_pwa',
  lat: 40.81,
  lng: 22.06,
  timestamp: '2026-03-25T12:00:05.000Z',
  app_seen_at: '2026-03-25T12:00:05.000Z',
};

console.assert(isHardwareTrackerRow(tel) === true, 'teltonika is hardware');
console.assert(isPhoneGpsRow(app) === true, 'driver_pwa is phone');
const preferred = preferVehicleRow(tel, app);
console.assert(preferred.source === 'teltonika', 'teltonika wins position');
console.assert(preferred.lat === 40.8, 'hardware lat kept (no App jump)');
console.assert(
  preferred.gps_sources?.includes('teltonika') && preferred.gps_sources?.includes('app'),
  'both sources kept on winner',
);

const deduped = dedupeVehiclesByPlate({
  'app-1': app,
  'tel-1': tel,
});
console.assert(Object.keys(deduped).length === 1, 'one pin after dedupe');
const winner = Object.values(deduped)[0];
console.assert(winner.source === 'teltonika', 'winner is teltonika');
console.assert(
  winner.gps_sources.includes('teltonika') && winner.gps_sources.includes('app'),
  'dual sources on deduped pin',
);

// Greek lookalike Ε vs Latin E must collapse to one pin.
console.assert(normalizePlateString('ΕΕΧ5670') === 'EEX5670', 'greek plate folds to latin');
const greekApp = { ...app, id: 'app-gr', vehicle_id: 'app-gr', bus_plate: 'ΕΕΧ5670' };
const mixed = dedupeVehiclesByPlate({ 'tel-1': tel, 'app-gr': greekApp });
console.assert(Object.keys(mixed).length === 1, 'greek/latin plate collapse');
console.assert(
  collapseVehicleListByPlate([tel, app]).length === 1,
  'array hard-collapse keeps one',
);

console.log('fleetPinDedupe.test.js: ok');
