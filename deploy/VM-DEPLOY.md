# PoreiaGo — one-command VM deploy

## Τι κάνει αυτόματα

Το `vm-deploy-all.sh`:

1. `git pull`
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

## Βήμα 2 — SSH στο VM (μία εντολή)

```bash
cd /opt/poreiago && git pull && bash deploy/scripts/vm-deploy-all.sh
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
