/**
 * Smoke: office staff login link copy + target.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'OfficeLoginLink.jsx'), 'utf8');

console.assert(src.includes('to="/admin/login"'), 'links to /admin/login');
console.assert(src.includes('Είσοδος γραφείου'), 'discreet Greek label');
console.assert(src.includes('isTenantStorefrontHost'), 'tenant host only');
console.assert(!src.includes('Σύνδεση γραφείου'), 'old label removed');

console.log('OfficeLoginLink.test.js: ok');
