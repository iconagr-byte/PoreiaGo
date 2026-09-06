# PoreiaGo — one-command VM deploy

## Τι κάνει αυτόματα

Το `vm-deploy-all.sh`:

1. `git fetch` + `reset --hard origin/main` (όχι `git pull` — αποφεύγει conflicts από παλιές χειροκίνητες αλλαγές στο VM)
2. Ρυθμίζει `.env.prod` (domains, Redis/Celery, VAPID push keys, hybrid provider placeholders)
3. Επιλέγει edge proxy: **Traefik** (default) ή **Nginx Proxy Manager** (`USE_NPM=1` / auto-detect `nginx-proxy*`)
4. `npm run build` frontend
5. `docker build` API
6. `docker compose up` (API, frontend, Postgres, Redis — Traefik μόνο αν δεν τρέχει NPM)

### Contabo / Nginx Proxy Manager

Αν το VPS έχει ήδη **Nginx Proxy Manager** στα ports 80/443 (π.χ. Contabo `169.58.199.186`),
το deploy **δεν** ξεκινά Traefik — αλλιώς παίρνεις `Bind for 0.0.0.0:80 failed`.

1. Στο `deploy/.env.prod` (συνιστάται· αλλιώς auto-detect από container/image ή κατειλημμένο :80):
   ```
   USE_NPM=1
   EDGE_PROXY=npm
   ```

2. NPM proxy hosts (Forward to):
   | Domain | Forward |
   |--------|---------|
   | `api.poreiago.com` | `127.0.0.1:8004` |
   | `poreiago.com`, `www.poreiago.com` | `127.0.0.1:8003` |
   | `www.achilliotravel.com`, `achilliotravel.com` | `127.0.0.1:8003` |

3. Το `deploy/docker-compose.npm.yml` δημοσιεύει API→8004 και frontend→8003.
   Αν υπάρχει ήδη `poreiago-frontend` στο 8003, το κρατάει, ανανεώνει το `dist/`
   **και** εγκαθιστά το `deploy/nginx/frontend.conf` ώστε το `/api` να πηγαίνει στο api-blue
   (χωρίς αυτό το Contabo έδινε 405 στο login).

4. Μετά το merge στο `main`: **Actions → Deploy VPS → Run workflow**.

### Achillio Travel backoffice δεν ανοίγει

Γρήγορο repair στο Contabo (ασφαλές για poreiago.com):

```bash
cd /opt/poreiago
# Προαιρετικά — νέος/reset admin μόνο για Achillio Travel (μην το βάλεις στο git):
# export ACHILLIO_ADMIN_EMAIL='axilleas0@yahoo.gr'
# export ACHILLIO_ADMIN_PASSWORD='…'
bash deploy/scripts/repair-achillio-office.sh
```

Το script: δημιουργεί/διορθώνει το γραφείο `admin-achillio-gr` με
`custom_domain=achilliotravel.com`, καθαρίζει poisoned domain από το seed `achillio`,
και φτιάχνει το nginx `/api` proxy.

Live **Aviationstack / Twilio** keys: βάλε τα στο `deploy/.env.prod` (δες `deploy/HYBRID-PROVIDERS.md`).
Χωρίς keys το hybrid μένει σε stub mode.
## Βήμα 1 — GitHub Desktop

Κάνε **Push** στο repo `PoreiaGo` (όλα τα νέα αρχεία).

## Βήμα 1β — GitHub Actions (auto-deploy με SSH)

Το push στο `main` **δεν** ενημερώνει μόνο του το site — χρειάζονται **3 secrets** στο repo:

1. [github.com/iconagr-byte/PoreiaGo/settings/secrets/actions](https://github.com/iconagr-byte/PoreiaGo/settings/secrets/actions)
2. **New repository secret** για καθένα:

| Secret | Τιμή |
|--------|------|
| `SSH_HOST` | IP του server (π.χ. `95.x.x.x`) |
| `SSH_USER` | `root` (ή ο user SSH σου) |
| `SSH_PRIVATE_KEY` | Ολόκληρο το private key (`.pem`), συμπεριλαμβανομένων `-----BEGIN...` |

3. Στο VM πρέπει να υπάρχει ήδη clone:
   ```bash
   git clone https://github.com/iconagr-byte/PoreiaGo.git /opt/poreiago
   ```

4. Έλεγχος: [Actions → Deploy VPS](https://github.com/iconagr-byte/PoreiaGo/actions/workflows/deploy-vps.yml) — πρέπει να είναι **πράσινο**.

Αν το deploy job αποτυγχάνει σε **1 δευτερόλεπτο**, συνήθως λείπουν τα secrets ή το SSH key είναι λάθος.

## Συμβόλαια & Stripe

Βλ. **[deploy/STRIPE-SETUP.md](./STRIPE-SETUP.md)** — χωρίς Stripe keys το checkout δεν ανοίγει (διαθέσιμη δωρεάν δοκιμή 14 ημερών).

## Βήμα 2 — SSH στο VM (μία εντολή)

```bash
cd /opt/poreiago && bash deploy/scripts/vm-deploy-all.sh
```

(Το script κάνει `git fetch` + `reset --hard origin/main` — **δεν** χρειάζεται ξεχωριστό `git pull`.)

### Σφάλμα: «Please commit your changes or stash them before you merge»

Στο VM υπάρχουν παλιές χειροκίνητες αλλαγές σε `deploy/docker-compose.prod.yml` ή `deploy/traefik/traefik.yml`.
Τα domains/secrets είναι στο `deploy/.env.prod` (δεν χάνονται).

```bash
cd /opt/poreiago
cp deploy/docker-compose.prod.yml /tmp/docker-compose.prod.yml.bak 2>/dev/null || true
cp deploy/traefik/traefik.yml /tmp/traefik.yml.bak 2>/dev/null || true
git fetch origin main
git reset --hard origin/main
bash deploy/scripts/vm-deploy-all.sh
```

Πρώτη φορά με demo admin:

```bash
cd /opt/poreiago && RUN_SEED=1 bash deploy/scripts/vm-deploy-all.sh
```

## Μετά το deploy

| Τι | URL |
|----|-----|
| Back Office | https://www.poreiago.com/admin/login |
| Driver PWA | https://www.poreiago.com/driver |
| API | https://api.poreiago.com/docs |

**Push οδηγού:** Driver → Αρχική → Ενεργοποίηση push → Back Office → Master QR → Push οδηγού

## Custom domain SSL (π.χ. Achillio)

Το `https://www.achilliotravel.com` πρέπει να δείχνει στο **Contabo** (`169.58.199.186`)
μέσω CNAME στο `www.poreiago.com` (ή A record στο ίδιο IP). Αν ο browser δείχνει
**«Μη ασφαλής σύνδεση»** στο `https://achilliotravel.com` (χωρίς www), το apex A record
ακόμα δείχνει στο παλιό hosting (GCP / intechs), όχι στο VPS.

Στο DNS του domain (intechs / όπου είναι τα NS):

| Τύπος | Όνομα | Τιμή |
|-------|--------|------|
| A | `@` (achilliotravel.com) | `169.58.199.186` |
| CNAME | `www` | `www.poreiago.com` |

Μετά το DNS (συνήθως λίγα λεπτά–ώρες), στο NPM πρόσθεσε Proxy Host για το apex
(ή redirect → www) με SSL Let’s Encrypt. Στο Postgres το `tenants.custom_domain`
πρέπει να είναι `achilliotravel.com` **μόνο** στο γραφείο Achillio Travel
(`admin-achillio-gr`) — τρέξε `repair-achillio-office.sh` αν λείπει.

Παλιό GCP IP `34.141.98.145` **μην** το αφήνεις στο apex — το HTTPS αποτυγχάνει.

## Secrets

- `deploy/.env.prod` — δεν ανεβαίνει στο GitHub
- `deploy/.vapid_private.pem` — δημιουργείται αυτόματα στο VM

## Google Sign-In (My Wallet)

Βλ. **[deploy/GOOGLE-SIGNIN.md](./GOOGLE-SIGNIN.md)**.

Χωρίς `GOOGLE_CLIENT_ID` στο `.env.prod` (ή Actions secret `GOOGLE_CLIENT_ID`)
το κουμπί Google στο login παραμένει ανενεργό.
