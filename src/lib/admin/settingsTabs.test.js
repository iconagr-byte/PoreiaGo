import assert from 'node:assert/strict';
import {
  PLATFORM_ONLY_TAB_IDS,
  sanitizeSettingsSubTab,
  settingsTabsForRole,
  TENANT_SETTINGS_TABS,
} from './settingsTabs.js';

assert.equal(sanitizeSettingsSubTab('tenants', false), 'platform');
assert.equal(sanitizeSettingsSubTab('saas_infra', false), 'platform');
assert.equal(sanitizeSettingsSubTab('backup', false), 'platform');
assert.equal(sanitizeSettingsSubTab('growth', false), 'platform');
assert.equal(sanitizeSettingsSubTab('homepage', false), 'homepage');
assert.equal(sanitizeSettingsSubTab('tenants', true), 'tenants');
assert.equal(sanitizeSettingsSubTab('growth', true), 'growth');

const tenantTabs = settingsTabsForRole(false);
assert.ok(tenantTabs.some((t) => t.id === 'homepage'));
assert.ok(tenantTabs.some((t) => t.id === 'drivers'));
assert.equal(sanitizeSettingsSubTab('drivers', false), 'drivers');
assert.ok(!tenantTabs.some((t) => PLATFORM_ONLY_TAB_IDS.has(t.id)));
assert.ok(!tenantTabs.some((t) => t.id === 'growth'));
assert.equal(tenantTabs.length, TENANT_SETTINGS_TABS.length);

console.log('settingsTabs role gating: OK');
