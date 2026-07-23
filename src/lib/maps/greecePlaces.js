/**
 * Ελληνικές πόλεις, δήμοι & περιφέρειες για labels στον ζωντανό χάρτη.
 * Zoom bands + collision ώστε να μην επικαλύπτονται ονόματα.
 */

/** @typedef {{ id: string, name: string, lat: number, lng: number, kind: 'region' | 'city' | 'town' | 'municipality', minZoom?: number, maxZoom?: number }} GreecePlace */

/**
 * Περιφέρειες — μόνο σε χαμηλό zoom.
 * @type {GreecePlace[]}
 */
export const GREECE_REGIONS = [
  { id: 'attiki', name: 'Αττική', lat: 38.12, lng: 23.55, kind: 'region', minZoom: 5, maxZoom: 6.6 },
  { id: 'kentriki-makedonia', name: 'Κεντρική Μακεδονία', lat: 40.95, lng: 22.45, kind: 'region', minZoom: 5, maxZoom: 6.6 },
  { id: 'anat-makedonia-thraki', name: 'Αν. Μακεδονία & Θράκη', lat: 41.25, lng: 25.55, kind: 'region', minZoom: 5, maxZoom: 6.6 },
  { id: 'dytiki-makedonia', name: 'Δυτική Μακεδονία', lat: 40.45, lng: 21.55, kind: 'region', minZoom: 5, maxZoom: 6.6 },
  { id: 'ipeiros', name: 'Ήπειρος', lat: 39.85, lng: 20.55, kind: 'region', minZoom: 5, maxZoom: 6.6 },
  { id: 'thessalia', name: 'Θεσσαλία', lat: 39.45, lng: 21.95, kind: 'region', minZoom: 5, maxZoom: 6.6 },
  { id: 'sterea', name: 'Στερεά Ελλάδα', lat: 38.75, lng: 22.85, kind: 'region', minZoom: 5, maxZoom: 6.6 },
  { id: 'dytiki-ellada', name: 'Δυτική Ελλάδα', lat: 38.55, lng: 21.35, kind: 'region', minZoom: 5, maxZoom: 6.6 },
  { id: 'peloponnisos', name: 'Πελοπόννησος', lat: 37.35, lng: 22.15, kind: 'region', minZoom: 5, maxZoom: 6.6 },
  { id: 'ionia', name: 'Ιόνια Νησιά', lat: 38.65, lng: 20.35, kind: 'region', minZoom: 5, maxZoom: 6.6 },
  { id: 'voreio-aigaio', name: 'Βόρειο Αιγαίο', lat: 39.25, lng: 26.2, kind: 'region', minZoom: 5, maxZoom: 6.6 },
  { id: 'notio-aigaio', name: 'Νότιο Αιγαίο', lat: 36.7, lng: 25.7, kind: 'region', minZoom: 5, maxZoom: 6.6 },
  { id: 'kriti', name: 'Κρήτη', lat: 35.15, lng: 24.9, kind: 'region', minZoom: 5, maxZoom: 6.6 },
];

/** Μεγάλες πόλεις — ορατές και όταν ο στόλος είναι zoomed-in. @type {GreecePlace[]} */
export const GREECE_CITIES = [
  { id: 'athina', name: 'Αθήνα', lat: 37.9838, lng: 23.7275, kind: 'city', minZoom: 6.5, maxZoom: 11.0 },
  { id: 'thessaloniki', name: 'Θεσσαλονίκη', lat: 40.6401, lng: 22.9444, kind: 'city', minZoom: 6.5, maxZoom: 11.0 },
  { id: 'patra', name: 'Πάτρα', lat: 38.2466, lng: 21.7346, kind: 'city', minZoom: 6.8, maxZoom: 11.0 },
  { id: 'irakleio', name: 'Ηράκλειο', lat: 35.3387, lng: 25.1442, kind: 'city', minZoom: 6.8, maxZoom: 11.0 },
  { id: 'larisa', name: 'Λάρισα', lat: 39.639, lng: 22.4191, kind: 'city', minZoom: 6.8, maxZoom: 11.0 },
  { id: 'volos', name: 'Βόλος', lat: 39.3666, lng: 22.9507, kind: 'city', minZoom: 7, maxZoom: 11.0 },
  { id: 'ioannina', name: 'Ιωάννινα', lat: 39.665, lng: 20.8537, kind: 'city', minZoom: 7, maxZoom: 11.0 },
  { id: 'chania', name: 'Χανιά', lat: 35.5138, lng: 24.018, kind: 'city', minZoom: 7, maxZoom: 11.0 },
  { id: 'rodos', name: 'Ρόδος', lat: 36.4349, lng: 28.2176, kind: 'city', minZoom: 7, maxZoom: 11.0 },
  { id: 'kavala', name: 'Καβάλα', lat: 40.9393, lng: 24.4013, kind: 'city', minZoom: 7, maxZoom: 11.0 },
  { id: 'kerkyra', name: 'Κέρκυρα', lat: 39.6243, lng: 19.9217, kind: 'city', minZoom: 7, maxZoom: 11.0 },
  { id: 'kalamata', name: 'Καλαμάτα', lat: 37.0389, lng: 22.1142, kind: 'city', minZoom: 7, maxZoom: 11.0 },
  { id: 'alexandroupoli', name: 'Αλεξανδρούπολη', lat: 40.8457, lng: 25.8744, kind: 'city', minZoom: 7, maxZoom: 11.0 },
  { id: 'xanthi', name: 'Ξάνθη', lat: 41.1348, lng: 24.888, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'komotini', name: 'Κομοτηνή', lat: 41.1224, lng: 25.406, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'serres', name: 'Σέρρες', lat: 41.0909, lng: 23.5476, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'kozani', name: 'Κοζάνη', lat: 40.3007, lng: 21.7889, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'katerini', name: 'Κατερίνη', lat: 40.2719, lng: 22.5025, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'trikala', name: 'Τρίκαλα', lat: 39.5556, lng: 21.7679, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'lamia', name: 'Λαμία', lat: 38.8995, lng: 22.4339, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'agrinio', name: 'Αγρίνιο', lat: 38.6214, lng: 21.4078, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'chalkida', name: 'Χαλκίδα', lat: 38.4636, lng: 23.5985, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'mytilini', name: 'Μυτιλήνη', lat: 39.1047, lng: 26.5573, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'rethimno', name: 'Ρέθυμνο', lat: 35.3663, lng: 24.4823, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'drama', name: 'Δράμα', lat: 41.1515, lng: 24.1473, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'veria', name: 'Βέροια', lat: 40.523, lng: 22.2024, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'karditsa', name: 'Καρδίτσα', lat: 39.3656, lng: 21.9217, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'preveza', name: 'Πρέβεζα', lat: 38.9595, lng: 20.751, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'argos', name: 'Άργος', lat: 37.6333, lng: 22.7333, kind: 'city', minZoom: 8.2, maxZoom: 11.0 },
  { id: 'sparti', name: 'Σπάρτη', lat: 37.0745, lng: 22.4303, kind: 'city', minZoom: 8.2, maxZoom: 11.0 },
  { id: 'nafplio', name: 'Ναύπλιο', lat: 37.567, lng: 22.8053, kind: 'city', minZoom: 8.2, maxZoom: 11.0 },
  { id: 'syros', name: 'Ερμούπολη', lat: 37.443, lng: 24.942, kind: 'city', minZoom: 7.5, maxZoom: 11.0 },
  { id: 'kos', name: 'Κως', lat: 36.893, lng: 27.288, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
  { id: 'zakynthos', name: 'Ζάκυνθος', lat: 37.787, lng: 20.898, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
  { id: 'lefkada', name: 'Λευκάδα', lat: 38.833, lng: 20.707, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
  { id: 'samos', name: 'Σάμος', lat: 37.757, lng: 26.976, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
  { id: 'chios', name: 'Χίος', lat: 38.368, lng: 26.136, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
  { id: 'mykonos', name: 'Μύκονος', lat: 37.4467, lng: 25.3289, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
  { id: 'santorini', name: 'Θήρα', lat: 36.3932, lng: 25.4615, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
  { id: 'igoumenitsa', name: 'Ηγουμενίτσα', lat: 39.503, lng: 20.264, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
  { id: 'pyrgos', name: 'Πύργος', lat: 37.675, lng: 21.441, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
  { id: 'korinthos', name: 'Κόρινθος', lat: 37.938, lng: 22.932, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
  { id: 'grevena', name: 'Γρεβενά', lat: 40.084, lng: 21.427, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
  { id: 'florina', name: 'Φλώρινα', lat: 40.782, lng: 21.41, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
  { id: 'kastoria', name: 'Καστοριά', lat: 40.521, lng: 21.263, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
  { id: 'edessa', name: 'Έδεσσα', lat: 40.802, lng: 22.044, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
  { id: 'giannitsa', name: 'Γιαννιτσά', lat: 40.782, lng: 22.415, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
  { id: 'orestiada', name: 'Ορεστιάδα', lat: 41.503, lng: 26.53, kind: 'town', minZoom: 8.2, maxZoom: 11.2 },
];

/** Δήμοι — κυρίως Αττική & Θεσσαλονίκη, όπου κινείται ο στόλος. @type {GreecePlace[]} */
export const GREECE_MUNICIPALITIES = [
  // Αττική
  { id: 'peiraias', name: 'Πειραιάς', lat: 37.942, lng: 23.646, kind: 'municipality', minZoom: 9.2, maxZoom: 14.2 },
  { id: 'peristeri', name: 'Περιστέρι', lat: 38.013, lng: 23.691, kind: 'municipality', minZoom: 9.5, maxZoom: 14.2 },
  { id: 'kallithea', name: 'Καλλιθέα', lat: 37.955, lng: 23.697, kind: 'municipality', minZoom: 9.8, maxZoom: 14.2 },
  { id: 'nikaia', name: 'Νίκαια', lat: 37.966, lng: 23.641, kind: 'municipality', minZoom: 9.8, maxZoom: 14.2 },
  { id: 'glyfada', name: 'Γλυφάδα', lat: 37.862, lng: 23.754, kind: 'municipality', minZoom: 9.5, maxZoom: 14.2 },
  { id: 'marousi', name: 'Μαρούσι', lat: 38.05, lng: 23.81, kind: 'municipality', minZoom: 9.5, maxZoom: 14.2 },
  { id: 'chaladri', name: 'Χαλάνδρι', lat: 38.021, lng: 23.798, kind: 'municipality', minZoom: 9.8, maxZoom: 14.2 },
  { id: 'aigaleo', name: 'Αιγάλεω', lat: 37.992, lng: 23.682, kind: 'municipality', minZoom: 9.8, maxZoom: 14.2 },
  { id: 'ilion', name: 'Ίλιον', lat: 38.033, lng: 23.703, kind: 'municipality', minZoom: 10, maxZoom: 14.2 },
  { id: 'kifisia', name: 'Κηφισιά', lat: 38.074, lng: 23.811, kind: 'municipality', minZoom: 9.5, maxZoom: 14.2 },
  { id: 'nea-smyrni', name: 'Νέα Σμύρνη', lat: 37.945, lng: 23.714, kind: 'municipality', minZoom: 10, maxZoom: 14.2 },
  { id: 'zografou', name: 'Ζωγράφου', lat: 37.975, lng: 23.769, kind: 'municipality', minZoom: 10, maxZoom: 14.2 },
  { id: 'galatsi', name: 'Γαλάτσι', lat: 38.017, lng: 23.753, kind: 'municipality', minZoom: 10, maxZoom: 14.2 },
  { id: 'ilioupoli', name: 'Ηλιούπολη', lat: 37.932, lng: 23.755, kind: 'municipality', minZoom: 10, maxZoom: 14.2 },
  { id: 'agia-paraskevi', name: 'Αγία Παρασκευή', lat: 38.011, lng: 23.82, kind: 'municipality', minZoom: 10, maxZoom: 14.2 },
  { id: 'vyronas', name: 'Βύρωνας', lat: 37.958, lng: 23.753, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
  { id: 'palaio-faliro', name: 'Παλαιό Φάληρο', lat: 37.928, lng: 23.701, kind: 'municipality', minZoom: 10, maxZoom: 14.2 },
  { id: 'alimos', name: 'Άλιμος', lat: 37.91, lng: 23.723, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
  { id: 'elliniko', name: 'Ελληνικό', lat: 37.887, lng: 23.744, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
  { id: 'koridallos', name: 'Κορυδαλλός', lat: 37.984, lng: 23.652, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
  { id: 'chaidari', name: 'Χαϊδάρι', lat: 38.012, lng: 23.666, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
  { id: 'petroupoli', name: 'Πετρούπολη', lat: 38.042, lng: 23.685, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
  { id: 'acharnes', name: 'Αχαρνές', lat: 38.083, lng: 23.736, kind: 'municipality', minZoom: 9.5, maxZoom: 14.2 },
  { id: 'nea-ionia', name: 'Νέα Ιωνία', lat: 38.038, lng: 23.755, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
  { id: 'irakleio-att', name: 'Ηράκλειο Αττικής', lat: 38.053, lng: 23.766, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
  { id: 'vrilissia', name: 'Βριλήσσια', lat: 38.039, lng: 23.83, kind: 'municipality', minZoom: 10.4, maxZoom: 14.2 },
  { id: 'filothei', name: 'Φιλοθέη', lat: 38.021, lng: 23.78, kind: 'municipality', minZoom: 10.5, maxZoom: 14.2 },
  { id: 'vari-voula', name: 'Βουλιαγμένη', lat: 37.81, lng: 23.776, kind: 'municipality', minZoom: 10, maxZoom: 14.2 },
  { id: 'elefsina', name: 'Ελευσίνα', lat: 38.043, lng: 23.542, kind: 'municipality', minZoom: 9.5, maxZoom: 14.2 },
  { id: 'aspropyrgos', name: 'Ασπρόπυργος', lat: 38.06, lng: 23.589, kind: 'municipality', minZoom: 9.8, maxZoom: 14.2 },
  { id: 'megara', name: 'Μέγαρα', lat: 37.995, lng: 23.343, kind: 'municipality', minZoom: 9.5, maxZoom: 14.2 },
  { id: 'salamina', name: 'Σαλαμίνα', lat: 37.964, lng: 23.497, kind: 'municipality', minZoom: 9.8, maxZoom: 14.2 },
  { id: 'rafina', name: 'Ραφήνα', lat: 38.022, lng: 24.006, kind: 'municipality', minZoom: 9.8, maxZoom: 14.2 },
  { id: 'lavrio', name: 'Λαύριο', lat: 37.715, lng: 24.056, kind: 'municipality', minZoom: 9.8, maxZoom: 14.2 },
  { id: 'koropi', name: 'Κορωπί', lat: 37.912, lng: 23.872, kind: 'municipality', minZoom: 10, maxZoom: 14.2 },
  { id: 'paiania', name: 'Παιανία', lat: 37.955, lng: 23.855, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
  { id: 'spata', name: 'Σπάτα', lat: 37.962, lng: 23.915, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
  { id: 'artemida', name: 'Αρτέμιδα', lat: 37.97, lng: 24.004, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
  { id: 'nea-makri', name: 'Νέα Μάκρη', lat: 38.087, lng: 23.976, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
  { id: 'ano-liosia', name: 'Άνω Λιόσια', lat: 38.083, lng: 23.7, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
  { id: 'agios-dimitrios', name: 'Άγιος Δημήτριος', lat: 37.934, lng: 23.73, kind: 'municipality', minZoom: 10.4, maxZoom: 14.2 },
  { id: 'moschato', name: 'Μοσχάτο', lat: 37.954, lng: 23.682, kind: 'municipality', minZoom: 10.5, maxZoom: 14.2 },
  // Θεσσαλονίκη
  { id: 'kalamaria', name: 'Καλαμαριά', lat: 40.582, lng: 22.95, kind: 'municipality', minZoom: 9.8, maxZoom: 14.2 },
  { id: 'evosmos', name: 'Εύοσμος', lat: 40.669, lng: 22.909, kind: 'municipality', minZoom: 10, maxZoom: 14.2 },
  { id: 'stavroupoli', name: 'Σταυρούπολη', lat: 40.668, lng: 22.935, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
  { id: 'sykies', name: 'Συκιές', lat: 40.649, lng: 22.954, kind: 'municipality', minZoom: 10.4, maxZoom: 14.2 },
  { id: 'neapoli-thess', name: 'Νεάπολη', lat: 40.655, lng: 22.938, kind: 'municipality', minZoom: 10.5, maxZoom: 14.2 },
  { id: 'pylaia', name: 'Πυλαία', lat: 40.599, lng: 22.986, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
  { id: 'thermi', name: 'Θέρμη', lat: 40.547, lng: 23.02, kind: 'municipality', minZoom: 10, maxZoom: 14.2 },
  { id: 'oreokastro', name: 'Ωραιόκαστρο', lat: 40.73, lng: 22.917, kind: 'municipality', minZoom: 10.2, maxZoom: 14.2 },
];

/** Όλες οι ετικέτες (περιφέρειες + πόλεις + δήμοι). */
export const GREECE_PLACES = [...GREECE_REGIONS, ...GREECE_CITIES, ...GREECE_MUNICIPALITIES];

const KIND_RANK = { city: 0, town: 1, municipality: 2, region: 3 };

function approxDegDistance(a, b) {
  const dLat = a.lat - b.lat;
  const dLng = (a.lng - b.lng) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/** Ελάχιστη απόσταση σε μοίρες — μεγαλώνει όταν zoom-out. */
function minSeparationForZoom(zoom) {
  const z = Number(zoom) || 6;
  if (z < 6.5) return 1.15;
  if (z < 7.5) return 0.72;
  if (z < 8.5) return 0.42;
  if (z < 9.5) return 0.28;
  if (z < 10.5) return 0.16;
  if (z < 12) return 0.1;
  return 0.06;
}

function defaultMaxZoom(place) {
  if (place.kind === 'region') return 6.6;
  if (place.kind === 'municipality') return 14.2;
  if (place.kind === 'town') return 11.2;
  return 11.0;
}

/**
 * Ετικέτες για το τρέχον zoom, χωρίς επικαλύψεις.
 * Προτεραιότητα: πόλη > κωμόπολη > δήμος > περιφέρεια.
 * Σε πολύ κοντινό zoom (>14.2) μένουν μόνο τα labels του basemap (δρόμοι).
 */
export function placesVisibleAtZoom(zoom) {
  const z = Number(zoom) || 6;
  if (z >= 14.3) return [];

  const candidates = GREECE_PLACES.filter((p) => {
    const minZ = p.minZoom ?? 6;
    const maxZ = p.maxZoom ?? defaultMaxZoom(p);
    return z >= minZ && z < maxZ;
  });

  candidates.sort((a, b) => {
    const rank = (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9);
    if (rank !== 0) return rank;
    return a.name.localeCompare(b.name, 'el');
  });

  const minSep = minSeparationForZoom(z);
  const kept = [];
  for (const place of candidates) {
    const clashes = kept.some((other) => approxDegDistance(place, other) < minSep);
    if (!clashes) kept.push(place);
  }
  return kept;
}
