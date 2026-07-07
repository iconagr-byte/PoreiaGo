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
