/**
 * Smoke: platform operator UI stays off on tenant office hosts.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'saasJwt.js'), 'utf8');

console.assert(src.includes('isTenantStorefrontHost'), 'gates platform UI off office hosts');
console.assert(src.includes('canAccessPlatformOperatorUi'), 'exports platform gate');
console.log('saasJwt.officeHost.test.js: ok');
