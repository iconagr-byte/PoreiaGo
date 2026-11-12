import assert from 'node:assert/strict';
import {
  createEmbeddedWizardNavigate,
  parseWizardNavTarget,
} from './rentWizardEmbed.js';

assert.equal(parseWizardNavTarget('/rent/book/services'), 'services');
assert.equal(parseWizardNavTarget('/rent/book/details'), 'details');
assert.equal(parseWizardNavTarget('/rent/book/payment'), 'payment');
assert.equal(parseWizardNavTarget('/wallet?tab=rentals'), 'done');
assert.equal(parseWizardNavTarget('/rent?need_dates=1#rent-pickup-date'), 'fleet');
assert.equal(parseWizardNavTarget('/rent#rent-guest-fleet'), 'fleet');
assert.equal(parseWizardNavTarget('/rent/login'), 'login');

let hit = '';
const nav = createEmbeddedWizardNavigate(
  () => {
    hit = 'router';
  },
  (to) => {
    if (parseWizardNavTarget(to) === 'details') {
      hit = 'embedded';
      return true;
    }
    return false;
  },
);
nav('/rent/book/details');
assert.equal(hit, 'embedded');
nav('/rent/login');
assert.equal(hit, 'router');

console.log('rentWizardEmbed.test.js: ok');
