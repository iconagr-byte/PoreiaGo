import { isRentMobileViewport, isRentPhoneViewport } from './rentDevice.js';

// Node has no matchMedia — helpers must not throw.
console.assert(typeof isRentMobileViewport() === 'boolean', 'mobile returns boolean');
console.assert(typeof isRentPhoneViewport() === 'boolean', 'phone returns boolean');
console.log('rentDevice: OK');
