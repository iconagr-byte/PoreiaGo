import { describe, expect, test } from 'vitest';
import { itinerarySlotIcon, parseTripItinerary } from './parseTripItinerary.js';

const KONST = `ΚΩΝΣΤΑΝΤΙΝΟΥΠΟΛΗ: Η ΒΑΣΙΛΙΔΑ ΤΩΝ ΠΟΛΕΩΝ Ζήστε μια μοναδική εμπειρία στην πόλη των δύο ηπείρων! 1η Ημέρα: Αναχώρηση το μεσημέρι από προκαθορισμένα σημεία επιβίβασης. Απόγευμα: Άφιξη στο ξενοδοχείο μας, check-in και ελεύθερος χρόνος. Βράδυ: Ελεύθερος χρόνος για βόλτα. 2η Ημέρα: Πρωί: Ξενάγηση στην Παλιά Πόλη. Μεσημέρι: Ελεύθερος χρόνος για φαγητό. Απόγευμα: Κρουαζιέρα στον Βόσπορο. Βράδυ: Ελεύθερος χρόνος. 3η Ημέρα: Πρωί: Επίσκεψη στο Παλάτι Τοπ Καπί. Μεσημέρι: Επιστροφή.`;

describe('parseTripItinerary', () => {
  test('splits Constantinople wall-of-text into days and slots', () => {
    const parsed = parseTripItinerary(KONST, {
      title: 'ΚΩΝΣΤΑΝΤΙΝΟΥΠΟΛΗ: Η ΒΑΣΙΛΙΔΑ ΤΩΝ ΠΟΛΕΩΝ',
    });
    expect(parsed.structured).toBe(true);
    expect(parsed.intro).toMatch(/Ζήστε μια μοναδική/);
    expect(parsed.intro).not.toMatch(/ΚΩΝΣΤΑΝΤΙΝΟΥΠΟΛΗ/);
    expect(parsed.days).toHaveLength(3);
    expect(parsed.days[0].label).toBe('1η Ημέρα');
    expect(parsed.days[0].slots[0].kind).toBe('body');
    expect(parsed.days[0].slots[0].text).toMatch(/Αναχώρηση το μεσημέρι/);
    expect(parsed.days[0].slots.map((s) => s.kind)).toEqual(['body', 'Απόγευμα', 'Βράδυ']);
    expect(parsed.days[1].slots.map((s) => s.kind)).toEqual([
      'Πρωί',
      'Μεσημέρι',
      'Απόγευμα',
      'Βράδυ',
    ]);
    expect(parsed.days[1].slots[0].text).toMatch(/Παλιά Πόλη/);
    expect(parsed.days[2].slots[0].kind).toBe('Πρωί');
  });

  test('plain description stays unstructured paragraphs', () => {
    const parsed = parseTripItinerary('Μια ήσυχη ημερήσια εκδρομή στην Αίγινα με μπάνιο και φαγητό.');
    expect(parsed.structured).toBe(false);
    expect(parsed.days).toHaveLength(0);
    expect(parsed.paragraphs[0]).toMatch(/Αίγινα/);
  });

  test('slot icons map to Material symbols', () => {
    expect(itinerarySlotIcon('Πρωί')).toBe('wb_sunny');
    expect(itinerarySlotIcon('Βράδυ')).toBe('dark_mode');
    expect(itinerarySlotIcon('body')).toBe('route');
  });
});
