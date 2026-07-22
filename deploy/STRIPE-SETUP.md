# Stripe — συμβόλαια γραφείου (PoreiaGo)

Χωρίς τα παρακάτω, το κουμπί **«Ενεργοποίηση / αναβάθμιση»** αποτυγχάνει ή προσφέρει μόνο **δωρεάν δοκιμή 14 ημερών**.

## 1. Δημιουργία τιμών στο Stripe

Στον υπολογιστή σου (με test ή live key):

```bash
cd backend
STRIPE_SECRET_KEY=sk_test_... python -m scripts.setup_stripe_catalog
```

Αντίγραψε τις γραμμές `STRIPE_PRICE_*` στο **`deploy/.env.prod`** στο VM.

## 2. Webhook

Στο [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks):

- **Endpoint:** `https://api.poreiago.com/api/v1/billing/webhook`
- **Events:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
- Αντίγραψε το **Signing secret** → `STRIPE_WEBHOOK_SECRET=whsec_...` στο `.env.prod`

## 3. Εφαρμογή στο VM

```bash
nano /opt/poreiago/deploy/.env.prod   # πρόσθεσε Stripe vars
cd /opt/poreiago && bash deploy/scripts/vm-deploy-all.sh
```

## 4. Έλεγχος

```bash
curl -s https://api.poreiago.com/health | grep billing
curl -s https://api.poreiago.com/api/v1/billing/config
```

`checkout_ready: true` → το Stripe Checkout δουλεύει.

## Δωρεάν δοκιμή / Demo πληρωμή (χωρίς Stripe)

- Αν **δεν** είναι ρυθμισμένο το Stripe, το signup στο `/grafeia/signup` ανοίγει αυτόματα σε **demo mode** (χωρίς χρέωση, trial 14 ημερών).
- Αν το Stripe είναι ρυθμισμένο αλλά θέλετε demo για δοκιμή νέου γραφείου:

```bash
BILLING_DEMO_MODE=1
```

στο `deploy/.env.prod`, μετά redeploy.

Μέχρι να ρυθμιστεί το Stripe, στο admin → **Συμβόλαιο** εμφανίζεται **«Ξεκινήστε δωρεάν δοκιμή 14 ημερών»** — ενεργοποιεί trial στο panel χωρίς πληρωμή.
