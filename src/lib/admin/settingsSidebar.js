/** Sidebar ρυθμίσεων — κάτω από το κύριο μενού Back Office. */

import {
  TENANT_SETTINGS_TABS,
  SUPER_ADMIN_SETTINGS_TABS,
  PLATFORM_NAV_SECTIONS,
} from './settingsTabs.js';

export function settingsTabToNavItem(tab) {
  return {
    id: `settings_${tab.id}`,
    label: tab.label,
    icon: tab.icon,
    filled: true,
    type: 'settings_subtab',
    tab: 'settings',
    settingsSubTab: tab.id,
    settingsSection: tab.section,
    accent: tab.accent || (tab.section === 'platform' ? 'indigo' : 'blue'),
  };
}

export function getSettingsSidebarSections(isSuperAdmin) {
  const tabs = isSuperAdmin ? SUPER_ADMIN_SETTINGS_TABS : TENANT_SETTINGS_TABS;

  if (!isSuperAdmin) {
    return [
      {
        id: 'office',
        label: 'Ρυθμίσεις γραφείου',
        items: TENANT_SETTINGS_TABS.map(settingsTabToNavItem),
      },
    ];
  }

  return PLATFORM_NAV_SECTIONS.map((section) => ({
    ...section,
    items: tabs.filter((t) => t.section === section.id).map(settingsTabToNavItem),
  }));
}
