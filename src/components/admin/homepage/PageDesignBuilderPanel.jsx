import { useState } from 'react';
import toast from 'react-hot-toast';
import TemplatePicker from './TemplatePicker.jsx';
import BrandColorEditor from './BrandColorEditor.jsx';
import PageSliderEditor from './PageSliderEditor.jsx';
import CompactHeroPhoto from './CompactHeroPhoto.jsx';
import {
  FOOTER_TEMPLATES,
  HEADER_TEMPLATES,
  HERO_TEMPLATES,
  TRIP_CARD_TEMPLATES,
  TRIPS_LAYOUT_TEMPLATES,
} from '../../../lib/homepage/homepageTemplates.js';
import { getHomepageThemeById } from '../../../lib/homepage/homepageThemes.js';
import { pageSliderPatch } from '../../../lib/homepage/pageSlider.js';
import { DEFAULT_SITE_APPEARANCE } from '../../../services/siteAppearanceApi.js';

const HERO_TEXT_DEFAULTS = {
  hero_badge: DEFAULT_SITE_APPEARANCE.hero_badge,
  hero_title: DEFAULT_SITE_APPEARANCE.hero_title,
  hero_title_accent: DEFAULT_SITE_APPEARANCE.hero_title_accent,
  hero_subtitle: DEFAULT_SITE_APPEARANCE.hero_subtitle,
  hero_search_label: DEFAULT_SITE_APPEARANCE.hero_search_label,
};

const SECTION_META = {
  general: {
    title: 'Γενικά',
    blurb: 'Θέμα, χρώματα brand και εμφάνιση ενοτήτων.',
    icon: 'tune',
  },
  header: {
    title: 'Header',
    blurb: 'Πρότυπο κορυφής — λογότυπο, μενού, στυλ.',
    icon: 'web_asset',
  },
  hero: {
    title: 'Hero',
    blurb: 'Φωτογραφία φόντου, διάταξη και κείμενα.',
    icon: 'panorama',
  },
  slider: {
    title: 'Slider',
    blurb: 'Carousel διαφανειών στο hero.',
    icon: 'slideshow',
  },
  trips: {
    title: 'Καρτέλες',
    blurb: 'Διάταξη λίστας και στυλ καρτών εκδρομών.',
    icon: 'view_carousel',
  },
  footer: {
    title: 'Footer',
    blurb: 'Πρότυπο υποσέλιδου και στοιχεία επικοινωνίας.',
    icon: 'vertical_align_bottom',
  },
};

/** Sections that use Builder-on-preview (middle column collapses). */
export const PAGE_DESIGN_BUILDER_SECTIONS = new Set([
  'general',
  'header',
  'hero',
  'slider',
  'trips',
  'footer',
]);

export function isPageDesignBuilderSection(designPage, section) {
  return designPage === 'home' && PAGE_DESIGN_BUILDER_SECTIONS.has(section);
}

function BuilderTabs({ tabs, value, onChange }) {
  return (
    <div className="pdw-builder__tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          className={`pdw-builder__tab${value === t.id ? ' is-active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function CompactHeroTexts({ form, setForm }) {
  const setField = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const resetField = (key) => () =>
    setForm((p) => ({ ...p, [key]: HERO_TEXT_DEFAULTS[key] ?? '' }));

  return (
    <div className="pdw-builder__stack">
      <div className="pdw-builder__row-actions">
        <p className="pdw-builder__subhead">Κείμενα hero</p>
        <button
          type="button"
          className="pdw-builder__link"
          onClick={() => {
            setForm((p) => ({ ...p, ...HERO_TEXT_DEFAULTS }));
            toast.success('Επαναφορά προεπιλεγμένων κειμένων hero');
          }}
        >
          Επαναφορά όλων
        </button>
      </div>
      {[
        { key: 'hero_badge', label: 'Badge', rows: 1 },
        { key: 'hero_title', label: 'Τίτλος', rows: 1 },
        { key: 'hero_title_accent', label: 'Τίτλος accent', rows: 1 },
        { key: 'hero_subtitle', label: 'Υπότιτλος', rows: 2 },
        { key: 'hero_search_label', label: 'Ετικέτα αναζήτησης', rows: 1 },
      ].map(({ key, label, rows }) => (
        <label key={key} className="pdw-builder__field">
          <span className="pdw-builder__field-label">
            {label}
            <button type="button" className="pdw-builder__link" onClick={resetField(key)}>
              reset
            </button>
          </span>
          {rows > 1 ? (
            <textarea
              rows={rows}
              className="pdw-builder__input"
              value={form[key] || ''}
              onChange={setField(key)}
            />
          ) : (
            <input
              className="pdw-builder__input"
              value={form[key] || ''}
              onChange={setField(key)}
            />
          )}
        </label>
      ))}
    </div>
  );
}

/**
 * Compact section editors for Divi-like inline Builder (preview module overlays)
 * and the editor-only fallback panel. Same form fields / template IDs as before.
 */
export default function PageDesignBuilderPanel({
  section,
  form,
  setForm,
  onSelectThemes,
  saving = false,
  onSaveSlider,
}) {
  const [tripsTab, setTripsTab] = useState('layout');
  const [heroTab, setHeroTab] = useState('photo');
  const [footerTab, setFooterTab] = useState('template');
  const meta = SECTION_META[section] || SECTION_META.general;
  const theme = getHomepageThemeById(form.homepage_theme_id);

  return (
    <div className="pdw-builder__panel">
      <header className="pdw-builder__head">
        <span className="pdw-builder__head-icon" aria-hidden>
          <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="pdw-builder__kicker">Builder</p>
          <h3 className="pdw-builder__title">{meta.title}</h3>
          <p className="pdw-builder__blurb">{meta.blurb}</p>
        </div>
      </header>

      <div className="pdw-builder__body">
        {section === 'general' ? (
          <div className="pdw-builder__stack">
            <div className="pdw-builder__theme-chip">
              <div className="flex -space-x-1.5 shrink-0" aria-hidden>
                {[
                  form.accent_color || '#0ea5e9',
                  form.secondary_color || '#1e3a5f',
                  form.surface_color || '#f8fafc',
                ].map((c, i) => (
                  <span
                    key={`${c}-${i}`}
                    className="w-7 h-7 rounded-lg border-2 border-white shadow-sm"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{theme.nameEl}</p>
                <p className="text-[11px] text-slate-500 line-clamp-1">{theme.description}</p>
              </div>
              {onSelectThemes ? (
                <button type="button" className="pdw-builder__link shrink-0" onClick={onSelectThemes}>
                  Θέματα →
                </button>
              ) : null}
            </div>

            <BrandColorEditor
              accent={form.accent_color}
              secondary={form.secondary_color}
              surface={form.surface_color}
              themeName={theme.nameEl}
              onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
              onResetTheme={() => {
                setForm((p) => ({
                  ...p,
                  accent_color: theme.palette.primary,
                  secondary_color: theme.palette.secondary,
                  surface_color: theme.palette.surface,
                }));
                toast.success('Χρώματα από το ενεργό θέμα');
              }}
            />

            <p className="pdw-builder__subhead">Ενότητες σελίδας</p>
            <div className="pdw-builder__toggles">
              {[
                {
                  key: 'show_fleet_section',
                  label: 'Εμφάνιση στόλου',
                  hint: 'Premium λεωφορεία & παροχές',
                  icon: 'directions_bus',
                },
                {
                  key: 'show_why_us_section',
                  label: 'Εμφάνιση «Γιατί να μας επιλέξετε»',
                  hint: 'Τα 3 πλεονεκτήματα κάτω από τις εκδρομές',
                  icon: 'star',
                },
              ].map(({ key, label, hint, icon }) => {
                const on = form[key] !== false;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, [key]: !on }))}
                    className={`pdw-builder__toggle${on ? ' is-on' : ''}`}
                  >
                    <span className={`pdw-builder__toggle-icon${on ? ' is-on' : ''}`}>
                      <span className="material-symbols-outlined text-[18px]">{icon}</span>
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-bold text-slate-900">{label}</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">{hint}</span>
                    </span>
                    <span className={`pdw-builder__switch${on ? ' is-on' : ''}`} aria-hidden>
                      <span className="pdw-builder__switch-knob" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {section === 'header' ? (
          <TemplatePicker
            category="header"
            templates={HEADER_TEMPLATES}
            value={form.header_template}
            onChange={(id) => setForm((p) => ({ ...p, header_template: id }))}
            columns={2}
            compact
          />
        ) : null}

        {section === 'hero' ? (
          <div className="pdw-builder__stack">
            <BuilderTabs
              tabs={[
                { id: 'photo', label: 'Φωτογραφία' },
                { id: 'template', label: 'Πρότυπο' },
                { id: 'copy', label: 'Κείμενα' },
              ]}
              value={heroTab}
              onChange={setHeroTab}
            />
            {heroTab === 'photo' ? (
              <CompactHeroPhoto form={form} setForm={setForm} />
            ) : null}
            {heroTab === 'template' ? (
              <TemplatePicker
                category="hero"
                templates={HERO_TEMPLATES}
                value={form.hero_template}
                onChange={(id) => setForm((p) => ({ ...p, hero_template: id }))}
                columns={2}
                compact
              />
            ) : null}
            {heroTab === 'copy' ? (
              <CompactHeroTexts form={form} setForm={setForm} />
            ) : null}
          </div>
        ) : null}

        {section === 'slider' ? (
          <PageSliderEditor
            page="home"
            enabled={Boolean(form.home_slider_enabled)}
            autoplay={form.home_slider_autoplay !== false}
            intervalSec={form.home_slider_interval_sec}
            options={form.home_slider_options}
            slides={form.home_slider_slides}
            saving={saving}
            onChange={(next) =>
              setForm((p) => ({
                ...p,
                ...pageSliderPatch('home', next),
              }))
            }
            onSave={onSaveSlider}
          />
        ) : null}

        {section === 'trips' ? (
          <div className="pdw-builder__stack">
            <BuilderTabs
              tabs={[
                { id: 'layout', label: 'Διάταξη' },
                { id: 'card', label: 'Κάρτα' },
                { id: 'copy', label: 'Κείμενα' },
              ]}
              value={tripsTab}
              onChange={setTripsTab}
            />
            {tripsTab === 'layout' ? (
              <TemplatePicker
                category="trips_layout"
                templates={TRIPS_LAYOUT_TEMPLATES}
                value={form.trips_layout_template}
                onChange={(id) =>
                  setForm((p) => ({
                    ...p,
                    trips_layout_template: id,
                    intl_trips_layout_template: id,
                    ...(id === 'destination_bento'
                      ? {
                          trip_card_template: 'destination_poster',
                          intl_trip_card_template: 'destination_poster',
                        }
                      : {}),
                  }))
                }
                columns={2}
                compact
              />
            ) : null}
            {tripsTab === 'card' ? (
              <TemplatePicker
                category="trip_card"
                templates={TRIP_CARD_TEMPLATES}
                value={form.trip_card_template}
                onChange={(id) =>
                  setForm((p) => ({
                    ...p,
                    trip_card_template: id,
                    intl_trip_card_template: id,
                  }))
                }
                columns={2}
                compact
              />
            ) : null}
            {tripsTab === 'copy' ? (
              <div className="pdw-builder__stack">
                <p className="pdw-builder__subhead text-sky-700">Ελλάδα</p>
                <input
                  className="pdw-builder__input"
                  placeholder="Eyebrow"
                  value={form.trips_section_eyebrow || ''}
                  onChange={(e) => setForm((p) => ({ ...p, trips_section_eyebrow: e.target.value }))}
                />
                <input
                  className="pdw-builder__input font-bold"
                  placeholder="Τίτλος"
                  value={form.trips_section_title || ''}
                  onChange={(e) => setForm((p) => ({ ...p, trips_section_title: e.target.value }))}
                />
                <textarea
                  rows={2}
                  className="pdw-builder__input"
                  placeholder="Υπότιτλος"
                  value={form.trips_section_subtitle || ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, trips_section_subtitle: e.target.value }))
                  }
                />
                <p className="pdw-builder__subhead text-violet-700 mt-2">Εξωτερικό</p>
                <input
                  className="pdw-builder__input"
                  placeholder="Eyebrow"
                  value={form.intl_section_eyebrow || ''}
                  onChange={(e) => setForm((p) => ({ ...p, intl_section_eyebrow: e.target.value }))}
                />
                <input
                  className="pdw-builder__input font-bold"
                  placeholder="Τίτλος"
                  value={form.intl_section_title || ''}
                  onChange={(e) => setForm((p) => ({ ...p, intl_section_title: e.target.value }))}
                />
                <textarea
                  rows={2}
                  className="pdw-builder__input"
                  placeholder="Υπότιτλος"
                  value={form.intl_section_subtitle || ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, intl_section_subtitle: e.target.value }))
                  }
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {section === 'footer' ? (
          <div className="pdw-builder__stack">
            <BuilderTabs
              tabs={[
                { id: 'template', label: 'Πρότυπο' },
                { id: 'copy', label: 'Κείμενα' },
              ]}
              value={footerTab}
              onChange={setFooterTab}
            />
            {footerTab === 'template' ? (
              <TemplatePicker
                category="footer"
                templates={FOOTER_TEMPLATES}
                value={form.footer_template}
                onChange={(id) => setForm((p) => ({ ...p, footer_template: id }))}
                columns={2}
                compact
              />
            ) : (
              <div className="pdw-builder__stack">
                <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Λογότυπο & επωνυμία header → ενότητα «Μάρκα». Εδώ footer κείμενα και σύνδεσμοι.
                </p>
                <label className="pdw-builder__field">
                  <span className="pdw-builder__field-label">Επωνυμία γραφείου</span>
                  <input
                    className="pdw-builder__input"
                    value={form.footer_brand_name || ''}
                    onChange={(e) => setForm((p) => ({ ...p, footer_brand_name: e.target.value }))}
                  />
                </label>
                <label className="pdw-builder__field">
                  <span className="pdw-builder__field-label">Copyright</span>
                  <input
                    className="pdw-builder__input"
                    value={form.footer_copyright || ''}
                    onChange={(e) => setForm((p) => ({ ...p, footer_copyright: e.target.value }))}
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="pdw-builder__field">
                    <span className="pdw-builder__field-label">Privacy</span>
                    <input
                      className="pdw-builder__input"
                      value={form.footer_privacy_label || ''}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, footer_privacy_label: e.target.value }))
                      }
                    />
                  </label>
                  <label className="pdw-builder__field">
                    <span className="pdw-builder__field-label">Privacy URL</span>
                    <input
                      className="pdw-builder__input"
                      value={form.footer_privacy_url || ''}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, footer_privacy_url: e.target.value }))
                      }
                    />
                  </label>
                  <label className="pdw-builder__field">
                    <span className="pdw-builder__field-label">Όροι</span>
                    <input
                      className="pdw-builder__input"
                      value={form.footer_terms_label || ''}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, footer_terms_label: e.target.value }))
                      }
                    />
                  </label>
                  <label className="pdw-builder__field">
                    <span className="pdw-builder__field-label">Όροι URL</span>
                    <input
                      className="pdw-builder__input"
                      value={form.footer_terms_url || ''}
                      onChange={(e) => setForm((p) => ({ ...p, footer_terms_url: e.target.value }))}
                    />
                  </label>
                  <label className="pdw-builder__field">
                    <span className="pdw-builder__field-label">Email</span>
                    <input
                      type="email"
                      className="pdw-builder__input"
                      value={form.footer_contact_email || ''}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, footer_contact_email: e.target.value }))
                      }
                    />
                  </label>
                  <label className="pdw-builder__field">
                    <span className="pdw-builder__field-label">Τηλέφωνο</span>
                    <input
                      className="pdw-builder__input"
                      value={form.footer_contact_phone || ''}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, footer_contact_phone: e.target.value }))
                      }
                    />
                  </label>
                </div>
                <label className="pdw-builder__field">
                  <span className="pdw-builder__field-label">Διεύθυνση</span>
                  <input
                    className="pdw-builder__input"
                    value={form.footer_address || ''}
                    onChange={(e) => setForm((p) => ({ ...p, footer_address: e.target.value }))}
                  />
                </label>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
