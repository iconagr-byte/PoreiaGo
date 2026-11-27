import {
  isRentMobileViewport,
  isRentPhoneViewport,
  readRentPreviewViewport,
} from './rentDevice.js';

// Node has no matchMedia — helpers must not throw.
console.assert(typeof isRentMobileViewport() === 'boolean', 'mobile returns boolean');
console.assert(typeof isRentPhoneViewport() === 'boolean', 'phone returns boolean');
console.assert(readRentPreviewViewport('') === null, 'empty search → null');
console.assert(
  readRentPreviewViewport('?preview=1&vp=desktop') === 'desktop',
  'preview desktop override',
);
console.assert(
  readRentPreviewViewport('?preview=1&vp=tablet') === 'tablet',
  'preview tablet override',
);
console.assert(
  readRentPreviewViewport('?preview=1&vp=phone') === 'phone',
  'preview phone override',
);
console.assert(
  readRentPreviewViewport('?vp=desktop') === null,
  'vp without preview is ignored',
);
console.log('rentDevice: OK');
