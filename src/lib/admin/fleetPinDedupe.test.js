import {
  dedupeVehiclesByPlate,
  preferVehicleRow,
  isHardwareTrackerRow,
  isPhoneGpsRow,
} from './fleetPinDedupe.js';

const tel = {
  id: 'tel-1',
  bus_plate: 'EEX5670',
  source: 'teltonika',
  imei: '861076085468260',
  timestamp: '2026-03-25T12:00:00.000Z',
};
const app = {
  id: 'app-1',
  bus_plate: 'EEX5670',
  source: 'driver_pwa',
  timestamp: '2026-03-25T12:00:05.000Z',
};

console.assert(isHardwareTrackerRow(tel) === true, 'teltonika is hardware');
console.assert(isPhoneGpsRow(app) === true, 'driver_pwa is phone');
console.assert(preferVehicleRow(tel, app) === tel, 'teltonika wins over app');

const deduped = dedupeVehiclesByPlate({
  'app-1': app,
  'tel-1': tel,
});
console.assert(Object.keys(deduped).length === 1, 'one pin after dedupe');
console.assert(Object.values(deduped)[0].source === 'teltonika', 'winner is teltonika');

console.log('fleetPinDedupe.test.js: ok');
