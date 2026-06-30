# Dynamic Pricing

Τιμές προσαρμόζονται ανά **πληρότητα θέσεων** (ρυθμίσεις πλατφόρμας).

## Κανόνες (Admin → Ρυθμίσεις → Dynamic pricing)

| Συνθήκη | Προεπιλογή | Ενέργεια |
|---------|------------|----------|
| Πληρότητα ≥ 80% | `pricing_high_occupancy_threshold` | +10% markup |
| Πληρότητα ≤ 30% | `pricing_low_occupancy_threshold` | −5% έκπτωση |

## API

`GET /api/admin/platform/pricing/quote?trip_id=1&base_price=45&total_seats=50&sold_seats=40`

Χωρίς JWT — χρησιμοποιείται από το frontend στο checkout.

## Frontend

- `src/lib/revenue/dynamicPricing.js` — υπολογισμός από κρατήσεις + seat map
- `TripPriceDisplay` — τιμή + badge «Υψηλή ζήτηση» / «Προσφορά»
- Εμφανίζεται: αρχική, λεπτομέρειες εκδρομής, επιλογή θέσεων

## Δοκιμή

1. Admin → Ρυθμίσεις: threshold 80% / markup 10%
2. Κάντε μερικές κρατήσεις σε εκδρομή (ή αφήστε το seat map με πολλά BOOKED)
3. Δείτε badge **+10%** όταν η πληρότητα είναι υψηλή
