export const HERO_FOCAL_OPTIONS = [
  { id: 'center', label: 'Κέντρο', css: 'center center' },
  { id: 'top', label: 'Πάνω', css: 'center top' },
  { id: 'bottom', label: 'Κάτω', css: 'center bottom' },
  { id: 'left', label: 'Αριστερά', css: 'left center' },
  { id: 'right', label: 'Δεξιά', css: 'right center' },
];

export function heroFocalCss(id) {
  return HERO_FOCAL_OPTIONS.find((o) => o.id === id)?.css || 'center 40%';
}
