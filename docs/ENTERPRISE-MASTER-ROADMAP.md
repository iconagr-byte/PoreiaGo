# PoreiaGo Enterprise Master Roadmap

Aligned with the comprehensive enterprise SaaS brief (Fleet, Rentals, Flights, Loyalty, Wallet, AADE).

**Stack reality (do not rewrite):** FastAPI + React/Vite + Tailwind. PostgreSQL + PostGIS already in Docker. No Next.js / GraphQL / Shadcn today — add only if a sales SOW requires them.

---

## Current coverage

| Module | Status | Notes |
|--------|--------|-------|
| Fleet rental CRUD + calendar + guest `/rent` | **Live** | Runtime = JSON `rental_store`; Postgres schema 011–013 ready but not wired |
| Vehicle inspections (pickup/return, photos, signature) | **Live** | Admin UI + file uploads |
| Hybrid flights + trip segments | **Live** | Postgres + admin UI; trip shell still dual-writes localStorage |
| AADE / myDATA fiscal | **Live** | Native + Prosvasis + Epsilon providers |
| Agency email (Gmail OAuth / SMTP) | **Live** | SQLite `email_settings`, not Postgres `agency_email_settings` |
| Web Rent / Digital Wallet PWA | **Live** | Apple/Google pass builders = 501 stubs |
| Miles+Bonus loyalty | **UI shell only** | No ledger tables / earn-redeem API |
| SaaS billing / rent plan | **Live** | Stripe + tenant modules |

---

## Phased delivery

### Phase A — Schema foundation (this PR)
- Align rental enums/fields with master prompt (`SUV`, `CLEANING`, `year`, `RESERVED`)
- Postgres `loyalty_accounts` + `miles_transactions` + RLS
- Compatibility view `rental_contracts` over `rental_bookings`
- Minimal loyalty REST stub

### Phase B — Promote rental JSON → Postgres
- Wire `fleet_rental_router` / customer rental APIs to ORM
- One-shot JSON → Postgres import for existing tenants
- Keep guest `/rent` UX unchanged

### Phase C — Loyalty engine
- Earn on completed trips/rentals (km + flight multipliers)
- Tier calc Standard → Platinum
- Wallet UI binds to server balances

### Phase D — Native wallet passes
- Finish Apple `.pkpass` + Google Wallet Objects for tickets & rentals
- Keep web PWA as fallback

### Phase E — Storage consolidation
- Migrate email settings SQLite → tenant Postgres
- Make hybrid Postgres the trip source of truth

---

## Naming map (master prompt ↔ PoreiaGo)

| Master prompt | PoreiaGo |
|---------------|----------|
| `rental_contracts` | `rental_bookings` (+ view `rental_contracts`) |
| `contract_status` | `rental_status` |
| `start_datetime` / `end_datetime` | `start_time` / `end_time` |
| `total_price` | `total_cost` |
| `PICKUP` / `RETURN` inspections | `PICKUP_CHECK` / `RETURN_CHECK` |
| `agency_email_settings` | `email_settings` (SQLite) |
| `invoiceService.js` | `travel_platform/compliance/*` + fiscal workers |
