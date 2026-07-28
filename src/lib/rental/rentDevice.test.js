import { isRentMobileViewport } from './rentDevice.js';

// Node has no matchMedia — helper must not throw.
console.assert(typeof isRentMobileViewport() === 'boolean', 'returns boolean');
console.log('rentDevice: OK');
