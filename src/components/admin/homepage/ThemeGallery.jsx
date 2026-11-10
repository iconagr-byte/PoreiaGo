import { getSelectableHomepageThemes } from '../../../lib/homepage/homepageThemes.js';

/**
 * Homepage Themes panel — waiting for demo website themes.
 * Saved theme id / apply plumbing stays in HomepageSettingsPanel
 * (handleThemePreview / handleThemeApply + themeToAppearancePatch).
 * Selectable catalog remains empty until demos arrive
 * (see getSelectableHomepageThemes in homepageThemes.js).
 */
export function isHomepageThemesPlaceholder() {
  return getSelectableHomepageThemes().length === 0;
}

export default function ThemeGallery({
  // Kept for API stability when demos land (active strip + picker).
  activeThemeId: _activeThemeId,
  onPreview: _onPreview,
  onApply: _onApply,
  applying: _applying = false,
}) {
  return (
    <p className="text-sm leading-relaxed text-[#6e6e73]">
      Θέματα από demo ιστοσελίδες θα εμφανιστούν εδώ σύντομα.
    </p>
  );
}
