# PoreiaGo — one-command VM deploy

## Τι κάνει αυτόματα

Το `vm-deploy-all.sh`:

1. `git fetch` + `reset --hard origin/main` (όχι `git pull` — αποφεύγει conflicts από παλιές χειροκίνητες αλλαγές στο VM)
2. Ρυθμίζει `.env.prod` (domains, Redis/Celery, VAPID push keys)
3. Διορθώνει Traefik (ACME email, απενεργοποίηση λάθος dynamic configs)
4. `npm run build` frontend
5. `docker build` API
6. `docker compose up` (Traefik, API, frontend, Postgres, Redis)

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

## Secrets

- `deploy/.env.prod` — δεν ανεβαίνει στο GitHub
- `deploy/.vapid_private.pem` — δημιουργείται αυτόματα στο VM
