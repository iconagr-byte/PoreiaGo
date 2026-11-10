/**
 * Office setup must prefer real office identity over PoreiaGo/IconaRent placeholders.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'OfficeSetupWizard.jsx'), 'utf8');

console.assert(src.includes('isPlatformPlaceholderName'), 'placeholder name helper');
console.assert(src.includes('pickOfficeName'), 'picks real office name');
console.assert(src.includes('iconarent'), 'treats IconaRent as placeholder');
console.assert(src.includes('@poreiago.app'), 'treats poreiago.app as placeholder email');
console.assert(
  src.includes('branding?.display_name') || src.includes('branding.display_name'),
  'reads branding display_name',
);
console.assert(
  src.includes('appearance?.footer_brand_name') || src.includes('appearance.footer_brand_name'),
  'reads appearance footer brand',
);

console.log('OfficeSetupWizard.seed.test.js: ok');
