import assert from 'node:assert/strict';
import { tenantDocumentTitle, platformDocumentTitle } from './applyBranding.js';

assert.equal(platformDocumentTitle().startsWith('PoreiaGo'), true);

assert.equal(tenantDocumentTitle('Achillio Travel', 'achilliotravel.com'), 'Achillio Travel');
assert.equal(tenantDocumentTitle('Achillio Travel — Εκδρομές', 'achilliotravel.com'), 'Achillio Travel — Εκδρομές');
assert.equal(tenantDocumentTitle('', 'achilliotravel.com'), 'Achilliotravel');
assert.equal(tenantDocumentTitle('AeroStride', 'achilliotravel.com'), 'Achilliotravel');
assert.equal(tenantDocumentTitle('poreiago', 'demo.poreiago.com'), 'Demo');

console.log('applyBranding titles: OK');
