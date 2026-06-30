export const LOST_ITEM_CATEGORIES = [
  { value: 'Ηλεκτρονικά', label: 'Ηλεκτρονικά (κινητό, laptop κ.λπ.)' },
  { value: 'Προσωπικά Έγγραφα', label: 'Προσωπικά έγγραφα / πορτοφόλι' },
  { value: 'Ρούχα', label: 'Ρούχα / αξεσουάρ' },
  { value: 'Άλλο', label: 'Άλλο' },
];

export function lostItemStatusLabel(status) {
  if (status === 'FOUND') return 'Βρέθηκε';
  if (status === 'CLOSED') return 'Επεστράφη';
  return 'Σε αναζήτηση';
}
