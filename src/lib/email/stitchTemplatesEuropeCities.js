/**
 * Έτοιμα marketing πρότυπα — βασικές ευρωπαϊκές πόλεις (city break / πακέτα).
 */

import { newBlock } from './campaignBlocks.js';

const THUMB = '/email-templates/gr_4.png';

const HORIZON_CTA = { bg: '#ffb702', textColor: '#1D1D1F' };
const TRAVEL_BLUE_CTA = { bg: '#0077b6', textColor: '#ffffff' };

const H1 = 'margin:0 0 12px 0;font-size:24px;font-weight:700;color:#005d90;';
const P = 'margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#404850;';
const PRICE = 'margin:0;font-size:18px;font-weight:700;color:#005d90;';
const BADGE = 'margin:0 0 8px 0;font-size:12px;font-weight:700;color:#266449;';

function cta(label, href = 'http://localhost:5173/trips', style = HORIZON_CTA) {
  return { ...newBlock('cta'), label, href, ...style };
}
function header(url, alt = 'Voyage Travel') {
  return { ...newBlock('header'), url, alt, theme: 'horizon' };
}
function text(html) {
  return { ...newBlock('text'), content: html };
}

/** Unsplash hero — σταθερά IDs, w=1200 για email */
function cityImg(photoId) {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=1200&q=85`;
}

export const STITCH_EUROPE_CITIES_CATEGORY = {
  id: 'europe_cities',
  label: 'Ευρωπαϊκές πόλεις',
  icon: 'location_city',
};

/**
 * slug, name, subtitle, subject, preheader, photoId, title, intro, badge, price
 */
const EUROPE_CITY_ROWS = [
  ['paris', 'Παρίσι', 'City break · 5 ημέρες', 'Παρίσι — Ρομαντική απόδραση', 'Άιφελ · Λούβρο · Σηκουάνας', '1502602898657-3e91760cbb34', 'Παρίσι, Γαλλία', 'Ρομαντικές βόλτες στον Σηκουάνα, Λούβρο και θέα στον Άιφελ.', '★ 4.9 · Premium', 'Από 850€'],
  ['rome', 'Ρώμη', 'Αιώνια Πόλη · 4 ημέρες', 'Ρώμη — Ιστορία & γαστρονομία', 'Κολοσσαίο · Βατικανό · Trevi', '1552832230-c0197dd311b5', 'Ρώμη, Ιταλία', 'Κολοσσαίο, Βατικανό, γραφικές πλατείες και αυθεντική ιταλική κουζίνα.', '🇮🇹 Bucket list', 'Από 620€'],
  ['london', 'Λονδίνο', 'City break · 5 ημέρες', 'Λονδίνο — Βρετανική πρωτεύουσα', 'West End · British Museum', '1512453979798-5ea6924a6c27', 'Λονδίνο, ΗΒ', 'Big Ben, British Museum, West End και αγορές στο Oxford Street.', '🇬🇧 Classic', 'Από 790€'],
  ['barcelona', 'Βαρκελώνη', 'Gaudí · παραλία', 'Βαρκελώνη — Τέχνη & Μεσόγειος', 'Sagrada Familia · Las Ramblas', '1583422409516-2835a58abf94', 'Βαρκελώνη, Ισπανία', 'Gaudí, Las Ramblas, γειτονιές με τέχνη και παραλίες κοντά στην πόλη.', '★ 4.8 · City & sea', 'Από 520€'],
  ['madrid', 'Μαδρίτη', 'Tapas · Prado', 'Μαδρίτη — Τέχνη & γαστρονομία', 'Royal Palace · Retiro', '1539037114452-88d19d4ccd98', 'Μαδρίτη, Ισπανία', 'Prado, tapas bars, βασιλικό παλάτι και ζωντανές πλατείες.', '🇪🇸 Ισπανία', 'Από 480€'],
  ['lisbon', 'Λισαβόνα', 'Τραμ · Ατλαντικός', 'Λισαβόνα — Ατλαντική πόλη', 'Belém · Sintra', '1555881400-74d7d86ac18f', 'Λισαβόνα, Πορτογαλία', 'Τραμ, Belém, Sintra και θέα στον Ατλαντικό.', '★ 4.7', 'Από 460€'],
  ['porto', 'Πόρτο', 'Κρασί · Douro', 'Πόρτο — Πορτογαλική γοητεία', 'Ribeira · γέφυρα Dom Luís', '1555881400-74d7d86ac18f', 'Πόρτο, Πορτογαλία', 'Ribeira, κελάρια κρασιού και κρουαζιέρα στον ποταμό Douro.', '🍷 Wine & culture', 'Από 420€'],
  ['seville', 'Σεβίλλη', 'Flamenco · Alcázar', 'Σεβίλλη — Ανδαλουσία', '4 ημέρες · παλιά πόλη', '1543783207-ec64e4d95325', 'Σεβίλλη, Ισπανία', 'Alcázar, καθεδρικός, flamenco show και γεύσεις της Ανδαλουσίας.', '🌞 Νότιος', 'Από 440€'],
  ['valencia', 'Βαλένθια', 'Paella · City of Arts', 'Βαλένθια — Μεσόγειος & design', '5 ημέρες · παραλία', '1566472483869-9d013362cb5d', 'Βαλένθια, Ισπανία', 'City of Arts, ιστορικό κέντρο, παραλίες και αυθεντική paella.', '🏖 City break', 'Από 410€'],
  ['venice', 'Βενετία', 'Κανάλια · gondola', 'Βενετία — Η πόλη των καναλιών', '4 ημέρες · Doge\'s Palace', '1523906834658-6e747ef25870', 'Βενετία, Ιταλία', 'Gondola, Piazza San Marco, μουσεία και μοναδική ατμόσφαιρα.', '🇮🇹 Ρομαντικό', 'Από 590€'],
  ['florence', 'Φλωρεντία', 'Renaissance · Uffizi', 'Φλωρεντία — Αναγέννηση', '5 ημέρες · Tuscany day trip', '1499856871958-697a790e0c24', 'Φλωρεντία, Ιταλία', 'Uffizi, Duomo, Ponte Vecchio και εκδρομή στην Τοσκάνη.', '🎨 Τέχνη', 'Από 640€'],
  ['milan', 'Μιλάνο', 'Μόδα · Duomo', 'Μιλάνο — Design & shopping', '4 ημέρες · Lake Como optional', '1513587160478-086c39ab3ebd', 'Μιλάνο, Ιταλία', 'Duomo, Navigli, Quadrilatero della Moda και προαιρετική Λίμνη Κώμου.', '👗 Fashion', 'Από 560€'],
  ['naples', 'Νάπολη', 'Pompeii · pizza', 'Νάπολη — Νότια Ιταλία', '5 ημέρες · Amalfi extension', '1523906834658-6e747ef25870', 'Νάπολη, Ιταλία', 'Πομπηία, ιστορικό κέντρο, αυθεντική πίτσα και Amalfi Coast.', '🍕 Gastronomy', 'Από 490€'],
  ['amsterdam', 'Άμστερνταμ', 'Κανάλια · μουσεία', 'Άμστερνταμ — Κανάλια & Van Gogh', '4 ημέρες · ποδήλατο', '1534351590666-fbef6ef1f461', 'Άμστερνταμ, Ολλανδία', 'Κανάλια, Rijksmuseum, Anne Frank House και χαλαρή ατμόσφαιρα.', '🚲 City break', 'Από 510€'],
  ['brussels', 'Βρυξέλλες', 'EU · σοκολάτα', 'Βρυξέλλες — Βέλγιο & Bruges', '4 ημέρες · Grand Place', '1513635269975-59663e0ac1ad', 'Βρυξέλλες, Βέλγιο', 'Grand Place, Atomium, σοκολάτα και ημερήσια εκδρομή Bruges.', '🇧🇪 Gourmet', 'Από 450€'],
  ['berlin', 'Βερολίνο', 'Ιστορία · street art', 'Βερολίνο — Σύγχρονη πρωτεύουσα', '5 ημέρες · Brandenburg', '1560967944-126baad9a7e5', 'Βερολίνο, Γερμανία', 'Brandenburg Gate, East Side Gallery, μουσεία και nightlife.', '🏙 Urban', 'Από 540€'],
  ['munich', 'Μόναχο', 'Oktoberfest · BMW', 'Μόναχο — Βαυαρία', '4 ημέρες · Neuschwanstein', '1595867812129-70e4f36e8fe0', 'Μόναχο, Γερμανία', 'Marienplatz, μπύρα, BMW Welt και εκδρομή στο Neuschwanstein.', '🇩🇪 Βαυαρία', 'Από 580€'],
  ['hamburg', 'Αμβούργο', 'Λιμάνι · Elbphilharmonie', 'Αμβούργο — Βόρεια Γερμανία', '4 ημέρες · Speicherstadt', '1571115764595-1cf07eae1d88', 'Αμβούργο, Γερμανία', 'Elbphilharmonie, ιστορικό λιμάνι, Reeperbahn και κανάλια.', '⚓ Harbor', 'Από 520€'],
  ['cologne', 'Κολωνία', 'Καθεδρικός · Ρήνος', 'Κολωνία — City break', '3 ημέρες · Rhine cruise', '1585320806937-37833bcb14ee', 'Κολωνία, Γερμανία', 'Καθεδρικός, μουσεία, ποτάμι Ρήνος και χριστουγεννιάτικες αγορές.', '🎄 Seasonal', 'Από 390€'],
  ['vienna', 'Βιέννη', 'Μουσική · αυτοκρατορία', 'Βιέννη — Αυτοκρατορική πολιτεία', '5 ημέρες · Σάλτσμπουργκ', '1516557616962-0926d112eca9', 'Βιέννη, Αυστρία', 'Σχενμπρούν, Όπερα, καφέ πολιτισμός και προαιρετική Σάλτσμπουργκ.', '🇦🇹 Κλασική', 'Από 580€'],
  ['prague', 'Πράγα', 'City break · 4 ημέρες', 'Πράγα — Τσεχία', 'Κάρλοβι Βάρι · Κάστρο', '1541840226184-68270f79a825', 'Πράγα, Τσεχία', 'Γοτθική αρχιτεκτονική, γέφυρα Καρλόβου και ζωντανή νυχτερινή ζωή.', '★ 4.9', 'Από 390€'],
  ['budapest', 'Βουδαπέστη', 'Θερμά λουτρά · Δούναβης', 'Βουδαπέστη — Δύο πόλεις σε μία', '4 ημέρες · spa & ruin bars', '1541343674514-47d84f1e2ec4', 'Βουδαπέστη, Ουγγαρία', 'Parliament, thermal baths, ruin bars και κρουαζιέρα στον Δούναβη.', '♨ Spa city', 'Από 370€'],
  ['warsaw', 'Βαρσοβία', 'Ιστορία · αναγέννηση', 'Βαρσοβία — Πολωνία', '4 ημέρες · Old Town', '1519197924294-4aa812dc0939', 'Βαρσοβία, Πολωνία', 'Ανακατασκευασμένο ιστορικό κέντρο, μουσεία και σύγχρονη ενέργεια.', '🇵🇱 Value', 'Από 340€'],
  ['krakow', 'Κρακοβία', 'Πολιτισμός · Auschwitz tour', 'Κρακοβία — Μεσαιωνική Πολωνία', '4 ημέρες · Wieliczka', '1511253866297-641eecb50bd6', 'Κρακοβία, Πολωνία', 'Main Square, Wawel, αλατωρυχείο Wieliczka και ιστορική μνήμη.', '🏰 UNESCO', 'Από 360€'],
  ['copenhagen', 'Κοπεγχάγη', 'Hyggelig · design', 'Κοπεγχάγη — Σκανδιναβικό design', '4 ημέρες · Nyhavn', '1513622470852-4fff11242ece', 'Κοπεγχάγη, Δανία', 'Nyhavn, Tivoli, ποδήλατα και σκανδιναβικό design.', '🇩🇰 Hygge', 'Από 620€'],
  ['stockholm', 'Στοκχόλμη', 'Νησιά · ABBA', 'Στοκχόλμη — Αρχιπέλαγος', '5 ημέρες · Gamla Stan', '1509356848151-9de1cef480c0', 'Στοκχόλμη, Σουηδία', 'Gamla Stan, Vasa Museum, νησιωτικό τοπίο και σκανδιναβική κουζίνα.', '🇸🇪 Nordic', 'Από 680€'],
  ['oslo', 'Όσλο', 'Φιορδ · μουσεία', 'Όσλο — Νορβηγία', '5 ημέρες · fjord day trip', '1511732351563-7989bd94133e', 'Όσλο, Νορβηγία', 'Opera House, Vigeland, μουσεία και ημερήσια εκδρομή στα φιορδ.', '🌊 Fjords', 'Από 890€'],
  ['helsinki', 'Ελσίνκι', 'Sauna · design', 'Ελσίνκι — Βαλτική', '4 ημέρες · Suomenlinna', '1538332573308-f710ca40c9be', 'Ελσίνκι, Φινλανδία', 'Suomenlinna, design district, σάουνα και αγορές στο Market Square.', '🇫🇮 Design', 'Από 590€'],
  ['reykjavik', 'Ρέικιαβικ', 'Βόρειο Σέλας · geysers', 'Ρέικιαβικ — Ισλανδία', '6 ημέρες · Golden Circle', '1504829857747-bfaf36cdc953', 'Ρέικιαβικ, Ισλανδία', 'Golden Circle, Blue Lagoon, geysers και πιθανό Northern Lights.', '🌌 Adventure', 'Από 1.120€'],
  ['dublin', 'Δουβλίνο', 'Pub culture · Trinity', 'Δουβλίνο — Ιρλανδία', '4 ημέρες · Guinness Storehouse', '1548196844-3a0ac351a4a2', 'Δουβλίνο, Ιρλανδία', 'Trinity College, Temple Bar, Guinness και ημερήσια εκδρομή Cliffs of Moher.', '🇮🇪 Pub & culture', 'Από 550€'],
  ['edinburgh', 'Εδιμβούργο', 'Σκωτία · κάστρα', 'Εδιμβούργο — Μεσαιωνική Σκωτία', '4 ημέρες · Edinburgh Castle', '1506373809799-cc544c0012c', 'Εδιμβούργο, Σκωτία', 'Κάστρο, Royal Mile, Highlands day trip και ουiski εμπειρία.', '🏰 Σκωτία', 'Από 620€'],
  ['zurich', 'Ζυρίχη', 'Λίμνη · Alps', 'Ζυρίχη — Ελβετία', '4 ημέρες · Lucerne optional', '1564095218943-d975457e5de7', 'Ζυρίχη, Ελβετία', 'Λίμνη, παλιά πόλη, σοκολάτα και ημερήσια εκδρομή στα Άλπεια.', '🇨🇭 Premium', 'Από 780€'],
  ['geneva', 'Γενεύη', 'Ελβετία · Ηνωμένα Έθνη', 'Γενεύη — Λίμνη & άλπεις', '4 ημέρες · Mont Blanc view', '1551632435-c2cfa7b35a54', 'Γενεύη, Ελβετία', 'Jet d\'Eau, Old Town, λίμνη και θέα στα Άλπεια.', '⛰ Alpine', 'Από 720€'],
  ['nice', 'Νίκαια', 'Riviera · Monaco', 'Νίκαια — Côte d\'Azur', '5 ημέρες · Monaco & Cannes', '1499856871958-697a790e0c24', 'Νίκαια, Γαλλία', 'Promenade des Anglais, παλιά πόλη, Monaco και Cannes.', '🌊 Riviera', 'Από 690€'],
  ['athens', 'Αθήνα', 'Ακρόπολη · παράλια', 'Αθήνα — Κλασική Ελλάδα', '4 ημέρες · Sounio optional', '1555992323-67d4227cd877', 'Αθήνα, Ελλάδα', 'Ακρόπολη, Πλάκα, μουσεία και ημερήσια εκδρομή στο Σούνιο.', '🇬🇷 Classic', 'Από 280€'],
  ['thessaloniki', 'Θεσσαλονίκη', 'Gastronomy · waterfront', 'Θεσσαλονίκη — Βόρεια Ελλάδα', '3 ημέρες · Ladadika', '1603575444363-95668b9472fa', 'Θεσσαλονίκη, Ελλάδα', 'Παραλία, Λευκός Πύργος, Ladadika και κουζίνα της Μακεδονίας.', '🍽 Food city', 'Από 195€'],
  ['dubrovnik', 'Ντουμπρόβνικ', 'Τείχη · Αδριατική', 'Ντουμπρόβνικ — Κροατία', '4 ημέρες · Game of Thrones', '1555990796-b92254c25f28', 'Ντουμπρόβνικ, Κροατία', 'Medieval walls, Stradun, παραλίες και κρουαζιέρα στα νησιά.', '🇭🇷 Adriatic', 'Από 520€'],
  ['split', 'Σπλιτ', 'Diocletian · islands', 'Σπλιτ — Δαλματία', '4 ημέρες · Hvar ferry', '1555990796-b92254c25f28', 'Σπλιτ, Κροατία', 'Παλάτι Διοκλητιανού, Riva, ferry προς Hvar και μπλε σπηλιές.', '⛵ Islands', 'Από 460€'],
  ['ljubljana', 'Λιουμπλιάνα', 'Πράσινη πρωτεύουσα', 'Λιουμπλιάνα — Σλοβενία', '3 ημέρες · Lake Bled', '1558642452-9d2a7efa3916', 'Λιουμπλιάνα, Σλοβενία', 'Πεζόδρομος, κάστρο, καφέ σκηνή και ημερήσια εκδρομή Lake Bled.', '🌿 Green city', 'Από 380€'],
  ['zagreb', 'Ζάγκρεμπ', 'Κροατία · εναλλακτικό', 'Ζάγκρεμπ — City break', '3 ημέρες · Upper Town', '1555990530-f832eac3c3f6', 'Ζάγκρεμπ, Κροατία', 'Upper Town, μουσεία, αγορές και εύκολη βάση για εκδρομές.', '🇭🇷 Value', 'Από 350€'],
  ['bratislava', 'Μπρατισλάβα', 'Danube · κάστρο', 'Μπρατισλάβα — Σλοβακία', '3 ημέρες · Vienna combo', '1605649487212-47bdab064df7', 'Μπρατισλάβα, Σλοβακία', 'Κάστρο, παλιά πόλη, Danube και συνδυασμός με Βιέννη.', '🇪🇺 Combo', 'Από 320€'],
  ['bucharest', 'Βουκουρέστι', 'Παρίσι της Ανατολής', 'Βουκουρέστι — Ρουμανία', '4 ημέρες · Transylvania tour', '1596773545588-78e959683ee8', 'Βουκουρέστι, Ρουμανία', 'Παλάτι Parlament, παλιά πόλη και εκδρομή Transylvania.', '🏛 Heritage', 'Από 310€'],
  ['sofia', 'Σόφια', 'Βαλκάνια · Vitosha', 'Σόφια — Βουλγαρία', '3 ημέρες · Rila Monastery', '1558618666-fcd25c85cd64', 'Σόφια, Βουλγαρία', 'Καθεδρικός, Vitosha, μονή Rila και προσιτές τιμές.', '🇧🇬 Balkans', 'Από 290€'],
  ['belgrade', 'Βελιγράδι', 'Νυχτερινή ζωή · ποταμός', 'Βελιγράδι — Σερβία', '3 ημέρες · Kalemegdan', '1583393785937-4acb9fb37f67', 'Βελιγράδι, Σερβία', 'Kalemegdan, Skadarlija, ποταμός Sava και ζωντανή nightlife.', '🎉 Nightlife', 'Από 270€'],
  ['istanbul', 'Κωνσταντινούπολη', 'Βόσπορος · παζάρια', 'Κωνσταντινούπολη — Ανατολή & Δύση', '5 ημέρες · Hagia Sophia', '1524231757912-21f4fe3a7200', 'Κωνσταντινούπολη, Τουρκία', 'Hagia Sophia, Grand Bazaar, Βόσπορος cruise και τουρκική κουζίνα.', '🕌 Crossroads', 'Από 480€'],
  ['valletta', 'Βαλέτα · Μάλτα', 'Μεσόγειος · ιστορία', 'Μάλτα — Νησί-φρούριο', '4 ημέρες · Mdina & Blue Grotto', '1555990796-b92254c25f28', 'Μάλτα', 'Βαλέτα UNESCO, Mdina, Blue Grotto και καθαρά νερά Μεσογείου.', '🇲🇹 Island', 'Από 440€'],
  ['tallinn', 'Ταλίν', 'Μεσαιωνικό · tech hub', 'Ταλίν — Εσθονία', '3 ημέρες · Old Town', '1548345600-9f565ed04dfa', 'Ταλίν, Εσθονία', 'Medieval walls, καφέ σκηνή, digital culture και κοντινό Helsinki ferry.', '🇪🇪 Baltic', 'Από 360€'],
  ['riga', 'Ρίγα', 'Art Nouveau · Βαλτική', 'Ρίγα — Λετονία', '3 ημέρες · Central Market', '1558003810-eab5f0d80493', 'Ρίγα, Λετονία', 'Art Nouveau, παλιά πόλη, αγορές και ζωντανή μουσική σκηνή.', '🇱🇻 Baltic', 'Από 340€'],
  ['vilnius', 'Βίλνιους', 'Ιστορία · Užupis', 'Βίλνιους — Λιθουανία', '3 ημέρες · Gediminas Tower', '1604079617075-5ecf228f32d1', 'Βίλνιους, Λιθουανία', 'Gediminas Tower, Užupis, καφέ και περπάτημα στην παλιά πόλη.', '🇱🇹 Baltic', 'Από 330€'],
];

function cityTemplate(row) {
  const [slug, name, subtitle, subject, preheader, photoId, title, intro, badge, price] = row;
  const hero = cityImg(photoId);
  return {
    id: `stitch-eu-city-${slug}`,
    category: 'europe_cities',
    name,
    subtitle,
    thumb: THUMB,
    subject,
    preheader,
    campaignName: `Marketing — ${name}`,
    blocks: () => [
      header(hero, name),
      text(
        `<h1 style="${H1}">${title}</h1><p style="${P}">${intro}</p><p style="${BADGE}">${badge}</p><p style="${PRICE}">${price}</p>`,
      ),
      cta('Κράτηση τώρα', 'http://localhost:5173/trips', TRAVEL_BLUE_CTA),
      text(
        `<p style="margin:16px 0 0 0;font-size:14px;line-height:1.6;color:#707881;">Περιλαμβάνει επιλογή ημερομηνιών, προτεινόμενα ξενοδοχεία 3–4* και υποστήριξη γραφείου πριν την αναχώρηση.</p>`,
      ),
    ],
  };
}

export const STITCH_EUROPE_CITY_TEMPLATES = EUROPE_CITY_ROWS.map(cityTemplate);
