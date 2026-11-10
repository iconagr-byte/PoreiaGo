# Hybrid providers — Aviationstack + Twilio

## Super Admin UI (προτιμώμενο)

Μετά το deploy: **Ρυθμίσεις → Integrations** (μόνο super admin).

- Αποθήκευση encrypted στον server (`/app/data/integrations_secrets.json`)
- Δεν εμφανίζονται τα keys μετά το save
- Το Hybrid SLA δείχνει Live / Stub + source (`ui` ή `env`)

## VPS env (fallback)

Live flight status και SMS/WhatsApp delay alerts διαβάζουν keys από **UI store** ή, αν λείπουν, από **`deploy/.env.prod`** στο VPS.
Χωρίς keys → stub mode.

## Μεταβλητές

| Key | Provider | Παράδειγμα |
|-----|----------|------------|
| `AVIATIONSTACK_API_KEY` | [Aviationstack](https://aviationstack.com/dashboard) | `xxxxxxxx` |
| `TWILIO_ACCOUNT_SID` | [Twilio Console](https://console.twilio.com/) | `ACxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio | `xxxxxxxx` |
| `TWILIO_FROM_NUMBER` | Twilio Phone Numbers | `+12025550123` |
| `TWILIO_WHATSAPP_FROM` | Twilio WhatsApp | `whatsapp:+14155238886` |

## VPS setup

```bash
ssh root@YOUR_VPS
nano /opt/poreiago/deploy/.env.prod
```

Πρόσθεσε / συμπλήρωσε:

```env
AVIATIONSTACK_API_KEY=your_aviationstack_key
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+30xxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Restart API (ή full deploy):

```bash
cd /opt/poreiago
docker compose --env-file deploy/.env.prod -f deploy/docker-compose.prod.yml \
  --profile bundled-db up -d --force-recreate --no-deps api-blue
```

Ή τρέξε το κανονικό `deploy/scripts/vm-deploy-all.sh`.

## Έλεγχος

Admin → Hybrid SLA δείχνει Live / Stub για κάθε provider.

Ή API (με SaaS token):

```http
GET /api/v1/operations/hybrid/providers
```

Παράδειγμα απάντησης (χωρίς secrets):

```json
{
  "aviationstack": { "configured": true, "mode": "live" },
  "twilio_sms": { "configured": true, "mode": "live" },
  "twilio_whatsapp": { "configured": false, "mode": "stub" }
}
```

## Σημειώσεις

- Μην ανεβάζεις keys στο GitHub — μόνο στο VPS `.env.prod` (gitignored).
- Aviationstack free tier έχει rate limits· σε λάθος/timeout το poll πέφτει σε stub fallback.
- Twilio WhatsApp χρειάζεται approved sender ή sandbox (`whatsapp:+14155238886`).
- Local dev: βάλε τις ίδιες γραμμές στο `backend/.env` (δες `backend/.env.example`).
