/**
 * Smoke: office-minimal admin login has no PoreiaGo marketing chrome.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'AdminLoginPage.jsx'), 'utf8');

console.assert(src.includes('isTenantStorefrontHost'), 'detects office host');
console.assert(src.includes('pg-login--office-minimal'), 'minimal class');
console.assert(src.includes('officeMinimal'), 'gates marketing');
console.assert(
  src.includes('{officeMinimal ? null : (') || src.includes('officeMinimal ? null'),
  'hides marketing aside/foot on office',
);

console.log('AdminLoginPage.test.js: ok');
