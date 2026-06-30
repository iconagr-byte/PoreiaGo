import { STITCH_CAMPAIGN_TEMPLATES } from '../email/stitchTemplates.js';
import { STITCH_EUROPE_CITIES_CATEGORY } from '../email/stitchTemplatesEuropeCities.js';
import { STITCH_GREECE_PLACES_CATEGORY } from '../email/stitchTemplatesGreecePlaces.js';
import { STITCH_GR_EXTRA_CATEGORIES } from '../email/stitchTemplatesGr.js';

const CATEGORY_LABELS = {
  promotions: 'Προσφορές',
  destinations: 'Προορισμοί',
  packages: 'Πακέτα',
  lifecycle: 'Lifecycle',
  transactional: 'Transactional',
  [STITCH_EUROPE_CITIES_CATEGORY.id]: STITCH_EUROPE_CITIES_CATEGORY.label,
  [STITCH_GREECE_PLACES_CATEGORY.id]: STITCH_GREECE_PLACES_CATEGORY.label,
  ...Object.fromEntries(
    (STITCH_GR_EXTRA_CATEGORIES || []).map((c) => [c.id, c.label]),
  ),
};

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

function categoryLabel(categoryId) {
  return CATEGORY_LABELS[categoryId] || categoryId || '';
}

function matchesQuery(query, ...fields) {
  const q = normalize(query);
  if (!q) return false;
  return fields.some((field) => normalize(field).includes(q));
}

export function buildTemplateSearchIndex() {
  return STITCH_CAMPAIGN_TEMPLATES.map((tpl) => ({
    id: tpl.id,
    title: tpl.name,
    subtitle: tpl.subtitle || tpl.subject || '',
    category: categoryLabel(tpl.category),
    icon: 'dashboard_customize',
    payload: tpl,
  }));
}

export function filterTemplateSearch(index, query, limit = 14) {
  const q = normalize(query);
  if (!q) return [];
  return index
    .filter((item) => {
      const tpl = item.payload;
      return matchesQuery(
        q,
        item.title,
        item.subtitle,
        item.category,
        tpl?.subject,
        tpl?.preheader,
        tpl?.id,
      );
    })
    .slice(0, limit);
}
