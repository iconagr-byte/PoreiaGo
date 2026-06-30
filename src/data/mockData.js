export const mockTrips = [
  {
    id: 1,
    market: 'domestic',
    title: 'Ημερήσια στα Μετέωρα',
    departureTime: '2026-06-15T08:00:00Z',
    arrivalTime: '2026-06-15T12:30:00Z',
    price: 45.0,
    vehicleType: 'Luxury Coach',
    availableSeats: 12,
    driverId: '',
    driverName: 'Νίκος Παπαδόπουλος',
    vehiclePlate: 'XAH-4021',
    vehicleCode: 'XAH-4021',
    image: '/images/meteora.png',
    hook: 'Ανακαλύψτε τη μαγεία των βράχων',
    description: 'Μια μαγευτική διαδρομή από την πρωτεύουσα προς τα επιβλητικά Μετέωρα. Απολαύστε το ταξίδι σας με την άνεση του Luxury Coach μας, με δωρεάν Wi-Fi και αναπαυτικά καθίσματα.',
    stops: [
      { id: 101, name: 'Πλατεία Συντάγματος (Αφετηρία)', lat: 37.9753, lng: 23.7361, time: '08:00', image: '/images/athens.png', description: 'Σημείο συνάντησης στο κέντρο της Αθήνας. Επιβίβαση και αναχώρηση.' },
      { id: 102, name: 'Θερμοπύλες (Μνημείο Λεωνίδα)', lat: 38.7967, lng: 22.5355, time: '10:15', description: 'Σύντομη στάση 30 λεπτών για καφέ, φωτογραφίες και περιήγηση στο ιστορικό μνημείο.' },
      { id: 104, name: 'Καλαμπάκα (Divani Meteora Hotel)', lat: 39.7044, lng: 21.6267, time: '12:30', image: '/images/meteora.png', description: 'Άφιξη στο πολυτελές ξενοδοχείο για τακτοποίηση και ελεύθερο χρόνο.' }
    ]
  },
  {
    id: 2,
    market: 'domestic',
    title: 'Απόδραση στην Πρωτεύουσα',
    departureTime: '2026-06-16T10:00:00Z',
    arrivalTime: '2026-06-15T16:00:00Z',
    price: 35.0,
    vehicleType: 'Premium Express',
    availableSeats: 5,
    driverName: 'Γιώργος Γεωργίου',
    vehiclePlate: 'YZA-9901',
    vehicleCode: 'YZA-9901',
    image: '/images/athens.png',
    hook: 'Ταξίδι Express στην πρωτεύουσα',
    description: 'Express δρομολόγιο που συνδέει τη Θεσσαλονίκη με την Αθήνα. Γρήγορο, ασφαλές και ξεκούραστο ταξίδι με το Premium Express στόλο μας.',
    stops: [
      { id: 201, name: 'Πλατεία Αριστοτέλους (Αφετηρία)', lat: 40.6322, lng: 22.9405, time: '10:00', description: 'Συγκέντρωση και επιβίβαση με θέα τον Θερμαϊκό.' },
      { id: 202, name: 'Λιτόχωρο (Στάση για καφέ)', lat: 40.1011, lng: 22.5020, time: '11:15', description: 'Στάση στους πρόποδες του Ολύμπου για έναν ξεκούραστο καφέ.' },
      { id: 204, name: 'Πλατεία Συντάγματος (Τερματικός)', lat: 37.9753, lng: 23.7361, time: '16:00', image: '/images/athens.png', description: 'Τερματισμός εκδρομής στο κέντρο της Αθήνας.' }
    ]
  },
  {
    id: 3,
    market: 'domestic',
    title: 'Μαγευτικά Ιωάννινα',
    departureTime: '2026-06-17T09:00:00Z',
    arrivalTime: '2026-06-16T11:45:00Z',
    price: 28.0,
    vehicleType: 'Luxury Coach',
    availableSeats: 22,
    driverName: 'Ανδρέας Ανδρέου',
    vehiclePlate: 'XAH-4022',
    vehicleCode: 'XAH-4022',
    image: '/images/ioannina.png',
    hook: 'Απόδραση στη μαγευτική λίμνη',
    description: 'Ταξιδέψτε από τη δυτική πύλη της Ελλάδας, την Πάτρα, προς την Ήπειρο. Απολαύστε τη διαδρομή μέσω της Ιόνιας Οδού.',
    stops: [
      { id: 301, name: 'Μαρίνα Πάτρας (Αφετηρία)', lat: 38.2466, lng: 21.7346, time: '09:00' },
      { id: 302, name: 'Γέφυρα Ρίου-Αντιρρίου (Φωτογραφική Στάση)', lat: 38.3180, lng: 21.7735, time: '09:30' },
      { id: 303, name: 'Λίμνη Ιωαννίνων', lat: 39.6645, lng: 20.8521, time: '11:45', image: '/images/ioannina.png' }
    ]
  },
  {
    id: 4,
    market: 'international',
    category: 'international',
    title: 'Παρίσι — City of Light',
    destination: 'Παρίσι, Γαλλία',
    departureTime: '2026-07-10T06:00:00Z',
    arrivalTime: '2026-07-10T22:00:00Z',
    price: 89.0,
    vehicleType: 'Premium Express',
    availableSeats: 18,
    driverName: 'Γιώργος Γεωργίου',
    vehiclePlate: 'YZA-9901',
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80',
    hook: 'Άφιξη στην πιο γοητευτική πρωτεύουσα της Ευρώπης',
    description:
      'Διεθνές δρομολόγιο από την Ελλάδα προς το Παρίσι. Άνεση Premium Express, στάσεις ανάπαυσης και άφιξη κέντρου.',
    stops: [
      { id: 401, name: 'Θεσσαλονίκη (Αφετηρία)', lat: 40.6322, lng: 22.9405, time: '06:00' },
      { id: 402, name: 'Σκόπια (Στάση)', lat: 41.9973, lng: 21.428, time: '09:30' },
      { id: 403, name: 'Βελιγράδι (Στάση)', lat: 44.7866, lng: 20.4489, time: '14:00' },
      { id: 404, name: 'Παρίσι — Gare de Lyon', lat: 48.8443, lng: 2.373, time: '22:00' },
    ],
  },
  {
    id: 5,
    market: 'international',
    category: 'international',
    title: 'Ρώμη — La Dolce Vita',
    destination: 'Ρώμη, Ιταλία',
    departureTime: '2026-07-12T07:00:00Z',
    arrivalTime: '2026-07-12T23:30:00Z',
    price: 79.0,
    vehicleType: 'Luxury Coach',
    availableSeats: 24,
    driverName: 'Νίκος Παπαδόπουλος',
    vehiclePlate: 'XAH-4021',
    image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1200&q=80',
    hook: 'Ιστορία, κουζίνα & άνεση σε ένα ταξίδι',
    description:
      'Ταξίδι προς την Αιώνια Πόλη με Luxury Coach. Διαδρομή μέσω Αδριατικής με ελεγχόμενες στάσεις και VIP θέσεις.',
    stops: [
      { id: 501, name: 'Πάτρα (Αφετηρία)', lat: 38.2466, lng: 21.7346, time: '07:00' },
      { id: 502, name: 'Μπρίντεζι (Ferry link)', lat: 41.1253, lng: 16.8667, time: '14:00' },
      { id: 503, name: 'Ρώμη — Tiburtina', lat: 41.9098, lng: 12.5281, time: '23:30' },
    ],
  },
  {
    id: 6,
    market: 'international',
    category: 'international',
    title: 'Πράγα & Βιέννη',
    destination: 'Τσεχία · Αυστρία',
    departureTime: '2026-07-18T05:30:00Z',
    arrivalTime: '2026-07-18T21:00:00Z',
    price: 95.0,
    vehicleType: 'Luxury Coach',
    availableSeats: 20,
    driverName: 'Ανδρέας Ανδρέου',
    vehiclePlate: 'XAH-4022',
    image: 'https://images.unsplash.com/photo-1541849543477-7ddc1d1e8f4e?w=1200&q=80',
    hook: 'Δύο κορυφαίες ευρωπαϊκές πρωτεύουσες, ένα ταξίδι',
    description:
      'Οργανωμένη εκδρομή προς Κεντρική Ευρώπη. Πράγα και Βιέννη με ίδιο άνετο coach και επιλογή θέσης.',
    stops: [
      { id: 601, name: 'Αθήνα (Αφετηρία)', lat: 37.9753, lng: 23.7361, time: '05:30' },
      { id: 602, name: 'Σόφια (Στάση)', lat: 42.6977, lng: 23.3219, time: '12:00' },
      { id: 603, name: 'Πράγα — Florenc', lat: 50.0835, lng: 14.4359, time: '18:00' },
      { id: 604, name: 'Βιέννη — Erdberg', lat: 48.1908, lng: 16.4162, time: '21:00' },
    ],
  },
];

export const mockSeatLayout = [];

for (let r = 1; r <= 10; r++) {
  for (let c of ['A', 'B', 'C', 'D']) {
    const isBooked = Math.random() < 0.3;
    mockSeatLayout.push({
      id: `${r}${c}`,
      isBooked,
      isVip: r <= 2
    });
  }
}

export const mockCustomers = [
  {
    id: 'CUST-001',
    name: 'John Doe',
    email: 'john@example.com',
    points: 1250,
    tier: 'Gold',
    joinDate: '2025-01-15'
  },
  {
    id: 'CUST-002',
    name: 'Maria Papadopoulou',
    email: 'maria@example.com',
    points: 450,
    tier: 'Silver',
    joinDate: '2025-06-22'
  },
  {
    id: 'CUST-003',
    name: 'George K.',
    email: 'george@example.com',
    points: 8900,
    tier: 'Platinum',
    joinDate: '2024-11-05'
  }
];

export const mockBookings = [
  { 
    id: 'B-1029', customerId: 'CUST-001', customerName: 'John Doe', tripTitle: 'Ημερήσια στα Μετέωρα', tripId: 1,
    date: '2026-06-15', time: '08:00', seats: ['4A'], seat: '4A', price: 45.00, status: 'Επιβεβαιωμένη', checkInStatus: 'NONE',
    phone: '+30 694 123 4567', email: 'john@example.com', dietary: 'Καμία', luggage: '1 Μικρή Αποσκευή',
    paymentStatus: 'PAID (Credit Card)', paymentDate: '2026-06-01 10:15:00', notes: 'Παρακαλώ θέση κοντά στο παράθυρο.',
    boardingPassIssued: true,
    pnr: 'MET26JDOE8A', transactionId: 'TXN-9876543210', invoiceNumber: 'INV-2026-00125', basePrice: 36.29, taxes: 8.71,
    bookingSource: 'Website (B2C)', agentName: 'Online Auto'
  },
  { 
    id: 'B-1030', customerId: 'CUST-002', customerName: 'Maria Papadopoulou', tripTitle: 'Απόδραση στην Πρωτεύουσα', tripId: 2,
    date: '2026-06-16', time: '09:30', seats: ['2B', '2C'], seat: '2B, 2C', price: 90.00, status: 'Επιβεβαιωμένη', checkInStatus: 'NONE',
    phone: '+30 697 987 6543', email: 'maria@example.com', dietary: 'Vegetarian', luggage: '2 Μεγάλες Βαλίτσες',
    paymentStatus: 'PAID (PayPal)', paymentDate: '2026-06-02 08:30:00', notes: '',
    boardingPassIssued: true,
    pnr: 'ATH26MPAP2C', transactionId: 'TXN-1122334455', invoiceNumber: 'INV-2026-00126', basePrice: 72.58, taxes: 17.42,
    bookingSource: 'Phone Call', agentName: 'Γιώργος Admin'
  },
  { 
    id: 'B-1031', customerId: 'CUST-003', customerName: 'George K.', tripTitle: 'Μαγευτικά Ιωάννινα', tripId: 3,
    date: '2026-06-17', time: '11:00', seats: ['1A'], seat: '1A', price: 65.00, status: 'Εκκρεμής', checkInStatus: 'NONE',
    phone: '+30 693 444 5555', email: 'george@example.com', dietary: 'Vegan', luggage: '1 Μεσαία Βαλίτσα',
    paymentStatus: 'PENDING', paymentDate: null, notes: 'Ενδιαφέρεται για δραστηριότητες (hiking).',
    boardingPassIssued: false,
    pnr: 'IOA26GEO1A', transactionId: '-', invoiceNumber: '-', basePrice: 52.42, taxes: 12.58,
    bookingSource: 'B2B Partner', agentName: 'TUI Hellas'
  },
  { 
    id: 'B-0995', customerId: 'CUST-001', customerName: 'John Doe', tripTitle: '3ήμερο Ναύπλιο', tripId: 1,
    date: '2026-05-10', time: '07:30', seats: ['6C'], seat: '6C', price: 120.00, status: 'Ολοκληρώθηκε', checkInStatus: 'CHECKED_IN',
    phone: '+30 694 123 4567', email: 'john@example.com', dietary: 'Καμία', luggage: '1 Μικρή Αποσκευή',
    paymentStatus: 'PAID (Cash)', paymentDate: '2026-04-20 12:00:00', notes: '',
    boardingPassIssued: true,
    pnr: 'NAF26JDOE6C', transactionId: 'TXN-5544332211', invoiceNumber: 'INV-2026-00089', basePrice: 96.77, taxes: 23.23,
    bookingSource: 'Office Walk-in', agentName: 'Μαρία Reception'
  }
];

export const mockStats = {
  totalRevenue: '€12,450',
  activeBookings: 342,
  fleetStatus: '32/36 Ενεργά',
  todayDepartures: 14
};

export const mockFleet = [
  {
    id: 'FL-001',
    name: 'Aero VIP 1',
    licensePlate: 'XAH-4021',
    type: 'Luxury Coach',
    seats: 50,
    status: 'Ενεργό',
    kilometers: 145000,
    lastService: '2026-03-15',
    nextServiceKm: 150000,
    insuranceExpiry: '2027-01-15',
    engineType: 'Mercedes OM 470 Euro VI',
    fuelConsumption: '26 L/100km',
    driver: 'Νίκος Παπαδόπουλος',
    financials: { revenue: 145000, expenses: 22000 },
    serviceHistory: [
      { id: 1, date: '2026-03-15', type: 'Πλήρες Service', cost: 1200, description: 'Αλλαγή λαδιών, φίλτρων, τακάκια φρένων και έλεγχος A/C.' },
      { id: 2, date: '2025-11-02', type: 'Ελαστικά', cost: 2400, description: 'Αντικατάσταση και των 6 ελαστικών (Michelin).' },
      { id: 3, date: '2025-06-10', type: 'Μικρό Service', cost: 450, description: 'Έλεγχος ρουτίνας πριν την καλοκαιρινή σεζόν.' }
    ]
  },
  {
    id: 'FL-002',
    name: 'Premium Express A',
    licensePlate: 'YZA-9901',
    type: 'Premium Express',
    seats: 32,
    status: 'Ενεργό',
    kilometers: 280500,
    lastService: '2025-11-20',
    nextServiceKm: 282000,
    insuranceExpiry: '2026-08-10',
    engineType: 'Scania 9-litre Euro 6',
    fuelConsumption: '22 L/100km',
    driver: 'Γιώργος Γεωργίου',
    financials: { revenue: 210000, expenses: 45000 },
    serviceHistory: [
      { id: 4, date: '2025-11-20', type: 'Service Κινητήρα', cost: 3500, description: 'Επισκευή τουρμπίνας και αλλαγή ιμάντα χρονισμού.' },
      { id: 5, date: '2025-04-12', type: 'Πλήρες Service', cost: 1100, description: 'Προγραμματισμένο γενικό service.' }
    ]
  },
  {
    id: 'FL-003',
    name: 'City Cruiser 3',
    licensePlate: 'IMB-1055',
    type: 'Standard',
    seats: 55,
    status: 'Σε Service',
    kilometers: 410200,
    lastService: '2026-05-30',
    nextServiceKm: 460000,
    insuranceExpiry: '2026-11-22',
    engineType: 'Volvo D8K Euro 6',
    fuelConsumption: '28 L/100km',
    driver: 'Κώστας Κωνσταντίνου',
    financials: { revenue: 320000, expenses: 95000 },
    serviceHistory: [
      { id: 6, date: '2026-05-30', type: 'Βλάβη Κλιματισμού', cost: 850, description: 'Αντικατάσταση συμπιεστή A/C (Βρίσκεται στο συνεργείο).' },
      { id: 7, date: '2026-01-15', type: 'Πλήρες Service', cost: 1300, description: 'Αλλαγή λαδιών, φίλτρων αέρα, καμπίνας.' }
    ]
  },
  {
    id: 'FL-004',
    name: 'Aero VIP 2',
    licensePlate: 'XAH-4022',
    type: 'Luxury Coach',
    seats: 50,
    status: 'Ενεργό',
    kilometers: 42000,
    lastService: '2026-01-10',
    nextServiceKm: 50000,
    insuranceExpiry: '2027-02-28',
    engineType: 'Mercedes OM 470 Euro VI',
    fuelConsumption: '25 L/100km',
    driver: 'Ανδρέας Ανδρέου',
    financials: { revenue: 85000, expenses: 8000 },
    serviceHistory: [
      { id: 8, date: '2026-01-10', type: 'Μικρό Service', cost: 600, description: 'Πρώτο service (λάδια, φίλτρα) στα 40.000km.' }
    ]
  }
];

export const mockLostItems = [
  {
    id: 'LF-1001',
    customerName: 'Γιώργος Παπαδόπουλος',
    itemCategory: 'Ηλεκτρονικά',
    description: 'Μαύρο iPhone 13 με μπλε θήκη. Το άφησα στη θέση μου (12Α) στο δρομολόγιο για Μετέωρα.',
    lastSeenLocation: 'Aero VIP 1 (Δρομολόγιο Μετέωρα)',
    status: 'OPEN',
    dateReported: '2026-06-01T09:30:00'
  },
  {
    id: 'LF-1002',
    customerName: 'Μαρία Αντωνίου',
    itemCategory: 'Προσωπικά Έγγραφα',
    description: 'Πράσινο πορτοφόλι με ταυτότητα και κάρτες.',
    lastSeenLocation: 'Στάση: Δελφοί',
    status: 'FOUND',
    dateReported: '2026-05-28T14:15:00'
  },
  {
    id: 'LF-1003',
    customerName: 'Νίκος Κώστα',
    itemCategory: 'Ρούχα',
    description: 'Γκρι ζακέτα φόρμας (Nike).',
    lastSeenLocation: 'City Cruiser 3',
    status: 'CLOSED',
    dateReported: '2026-05-10T18:45:00'
  }
];

export const mockLiveFeedback = [
  {
    id: 'FB-101',
    tripId: 1,
    stopId: 101,
    customerName: 'Μαρία Αντωνίου',
    emojiRating: '🤩',
    timestamp: '2026-06-01T10:15:00',
    stopName: 'Αναχώρηση'
  },
  {
    id: 'FB-102',
    tripId: 1,
    stopId: 102,
    customerName: 'Γιώργος Παπαδόπουλος',
    emojiRating: '😐',
    timestamp: '2026-06-01T11:45:00',
    stopName: 'Τρίκαλα (Στάση για καφέ)'
  }
];

export const mockPackingLists = {
  // For 'Μαγευτικά Μετέωρα' (trip 1) -> Nature, Walking
  1: [
    { id: 'p1', category: 'Ένδυση & Υπόδηση', name: 'Ορειβατικά παπούτσια ή αθλητικά', isPacked: false },
    { id: 'p2', category: 'Ένδυση & Υπόδηση', name: 'Αντιανεμικό / Ελαφρύ μπουφάν', isPacked: false },
    { id: 'p3', category: 'Ένδυση & Υπόδηση', name: 'Καπέλο & Γυαλιά ηλίου', isPacked: false },
    { id: 'p4', category: 'Ηλεκτρονικά', name: 'Φωτογραφική μηχανή', isPacked: false },
    { id: 'p5', category: 'Ηλεκτρονικά', name: 'Powerbank', isPacked: false },
    { id: 'p6', category: 'Προσωπικά Είδη', name: 'Μπουκάλι νερό (Παγούρι)', isPacked: false },
    { id: 'p7', category: 'Προσωπικά Είδη', name: 'Ταυτότητα / Διαβατήριο', isPacked: false },
    { id: 'p8', category: 'Προσωπικά Είδη', name: 'Εισιτήριο (QR Code)', isPacked: true } // Auto-packed via app
  ],
  // For 'Απόδραση στην Πρωτεύουσα' (trip 2) -> City break
  2: [
    { id: 'c1', category: 'Ένδυση & Υπόδηση', name: 'Άνετα παπούτσια πόλης', isPacked: false },
    { id: 'c2', category: 'Ένδυση & Υπόδηση', name: 'Βραδινό ντύσιμο', isPacked: false },
    { id: 'c3', category: 'Ηλεκτρονικά', name: 'Powerbank', isPacked: false },
    { id: 'c4', category: 'Ηλεκτρονικά', name: 'Ακουστικά για τη διαδρομή', isPacked: false },
    { id: 'c5', category: 'Προσωπικά Είδη', name: 'Ταυτότητα / Διαβατήριο', isPacked: false },
    { id: 'c6', category: 'Προσωπικά Είδη', name: 'Χρήματα & Κάρτες', isPacked: false },
    { id: 'c7', category: 'Προσωπικά Είδη', name: 'Εισιτήριο (QR Code)', isPacked: true }
  ]
};

export const mockGroupLobby = {
  1: [ // Passengers on Trip 1 (Μαγευτικά Μετέωρα)
    { id: 'u1', name: 'Αλέξανδρος', initials: 'Α', color: 'bg-blue-100 text-blue-700', interests: ['📷 Φωτογραφία', '⛰️ Πεζοπορία'] },
    { id: 'u2', name: 'Ελένη', initials: 'Ε', color: 'bg-rose-100 text-rose-700', interests: ['🍽️ Foodie', '☕ Καφές'] },
    { id: 'u3', name: 'Γιάννης', initials: 'Γ', color: 'bg-emerald-100 text-emerald-700', interests: ['🏛️ Ιστορία', '🚶‍♂️ Εξερεύνηση'] },
    { id: 'u4', name: 'Σοφία', initials: 'Σ', color: 'bg-purple-100 text-purple-700', interests: ['🧘‍♀️ Wellness', '📷 Φωτογραφία'] },
    { id: 'u5', name: 'Κώστας', initials: 'Κ', color: 'bg-amber-100 text-amber-700', interests: ['🎵 Μουσική', '🍻 Μπύρα'] }
  ],
  2: [ // Passengers on Trip 2
    { id: 'u6', name: 'Μαρία', initials: 'Μ', color: 'bg-pink-100 text-pink-700', interests: ['🛍️ Shopping', '🖼️ Μουσεία'] },
    { id: 'u7', name: 'Δημήτρης', initials: 'Δ', color: 'bg-indigo-100 text-indigo-700', interests: ['🍔 Street Food', '🌃 Nightlife'] }
  ]
};

export const mockLocalEvents = {
  1: [ // Meteora events
    { id: 'e1', title: 'Φεστιβάλ Τοπικής Γαστρονομίας', location: 'Κεντρική Πλατεία Καλαμπάκας', date: '15 Ιουλίου, 20:00', type: 'Φαγητό & Ποτό', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=400', price: 'Δωρεάν' },
    { id: 'e2', title: 'Βραδινή Πεζοπορία στους Βράχους', location: 'Σημείο Συνάντησης: Καστράκι', date: '16 Ιουλίου, 19:30', type: 'Δραστηριότητα', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&q=80&w=400', price: '15€' }
  ],
  2: [ // Athens events
    { id: 'e3', title: 'Συναυλία στο Ηρώδειο', location: 'Ωδείο Ηρώδου Αττικού', date: '15 Ιουνίου, 21:00', type: 'Τέχνες & Πολιτισμός', image: 'https://images.unsplash.com/photo-1540039155732-d674d40af310?auto=format&fit=crop&q=80&w=400', price: 'Από 25€' },
    { id: 'e4', title: 'Athens Street Food Festival', location: 'Παλιό Αμαξοστάσιο ΟΣΥ', date: '16 Ιουνίου, 17:00 - 00:00', type: 'Φαγητό & Ποτό', image: 'https://images.unsplash.com/photo-1509315811345-672d83ef2fbc?auto=format&fit=crop&q=80&w=400', price: '3€ Είσοδος' }
  ],
  3: [ // Ioannina events
    { id: 'e5', title: 'Έκθεση Φωτογραφίας: "Ήπειρος"', location: 'Κάστρο Ιωαννίνων (Ιτς Καλέ)', date: '16 Ιουνίου, 10:00 - 18:00', type: 'Τέχνες & Πολιτισμός', image: 'https://images.unsplash.com/photo-1469594292607-7bd90f8d3ba4?auto=format&fit=crop&q=80&w=400', price: 'Δωρεάν' },
    { id: 'e6', title: 'Γευσιγνωσία Κρασιού Ζίτσας', location: 'Οινοποιείο Ζίτσας', date: '17 Ιουνίου, 12:00', type: 'Φαγητό & Ποτό', image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=400', price: '20€' }
  ]
};
