import assert from 'node:assert/strict';
import { ADMIN_UI_DICT } from './adminUiDict.js';
import { t, tAdmin, tNavItem } from './t.js';
import { getUiLang, setUiLang } from './uiLang.js';

const prev = getUiLang();

try {
  setUiLang('en');
  assert.equal(getUiLang(), 'en');
  assert.equal(t('notifications'), 'Notifications');
  assert.equal(tAdmin('nav', 'fleet_live_map'), 'Live map');
  assert.equal(tAdmin('settings', 'homepage'), 'Page design');
  assert.equal(tAdmin('rent', 'live_gps'), 'Rental GPS');
  assert.equal(
    tNavItem({ id: 'fleet_rental_clients', label: 'Πελάτες ενοικιάσεων' }),
    'Rental customers',
  );
  assert.equal(t('notifications_unread', { n: 3 }), 'Notifications, 3 new');

  setUiLang('el');
  assert.equal(t('notifications'), 'Ειδοποιήσεις');
  assert.equal(tAdmin('nav', 'fleet_live_map'), 'Ζωντανός Χάρτης');

  // Every EN key exists in EL.
  for (const key of Object.keys(ADMIN_UI_DICT.en)) {
    assert.ok(ADMIN_UI_DICT.el[key], `missing el key: ${key}`);
  }
} finally {
  setUiLang(prev);
}

console.log('uiLang.test.js OK');
