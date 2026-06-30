# Local development — Docker + hybrid workflow

Γρήγορος οδηγός για Postgres, Redis, Celery και fiscal pipeline τοπικά.

---

## Επιλογή A — Hybrid (συνιστάται)

API + frontend στο host, μόνο **Postgres + Redis** σε Docker.

```bash
make dev
```

**Windows (χωρίς `make`):**

```powershell
docker compose up -d db redis
cd backend; alembic upgrade head
cd backend; python -m scripts.seed_saas_dev
```

Αυτό κάνει: `db` + `redis` → `migrate` → `seed` και εμφανίζει τα επόμενα βήματα.

**3 terminals (fiscal pipeline):**

```bash
make dev-api          # Terminal 1 — API :8000
make celery-worker    # Terminal 2
make celery-beat      # Terminal 3
```

**Frontend:**

```bash
npm run dev           # Vite :5173 → proxy στο API (βλ. VITE_DEV_API_PROXY)
```

**Έλεγχος:**

```bash
make health
make fiscal-smoke
```

**Σταμάτημα infra:**

```bash
make dev-down
```

---

## Επιλογή B — Full stack σε Docker

Όλα σε containers (API + workers + beat + DB + Redis).

```bash
make stack-full
```

Ή χειροκίνητα:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
make migrate
make seed
```

API: [http://localhost:8000](http://localhost:8000)  
Health: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

**Logs:**

```bash
make stack-logs          # web + celery
make logs-celery         # μόνο celery worker/beat
```

**Σταμάτημα:**

```bash
make down
```

---

## Μεταβλητές (backend/.env)

Αντέγραψε `backend/.env.example` → `backend/.env` ή χρησιμοποίησε:

```env
DATABASE_URL=postgresql+asyncpg://aerostride_user:securepassword@localhost:5432/aerostride_db
CELERY_BROKER_URL=redis://localhost:6379/0
REDIS_URL=redis://localhost:6379/0
```

Στο **hybrid mode** τα URLs δείχνουν στο `localhost` (ports από Docker).

---

## Makefile — σύνοψη

| Target | Τι κάνει |
|--------|----------|
| `make dev` | Infra + migrate + seed + οδηγίες |
| `make dev-infra` | Μόνο Postgres + Redis |
| `make dev-down` | Σταματά db + redis |
| `make dev-api` | Uvicorn local :8000 |
| `make celery-worker` | Celery worker (fiscal, SMS, …) |
| `make celery-beat` | Beat (auto-retry, digest, …) |
| `make stack-full` | Full Docker stack + migrate + seed |
| `make bootstrap` | `make up` + migrate + seed (με Traefik) |
| `make health` | `/health` + `/api/v1/health` |
| `make fiscal-smoke` | Redis, env, DB, optional API |

---

## Συχνά προβλήματα

| Σύμπτωμα | Λύση |
|----------|------|
| `fiscal-smoke` Redis FAIL | `make dev-infra` ή `docker compose up -d redis` |
| Πληρωμή OK, χωρίς MARK | `make celery-worker` τρέχει; |
| Port 5432/6379 busy | Άλλαξε ports στο `docker-compose.yml` + `.env` |
| Frontend δεν βρίσκει API | `VITE_DEV_API_PROXY=http://127.0.0.1:8000` στο `.env.local` |

---

## Σχετικά

- [FISCAL-PIPELINE-RUNBOOK.md](./FISCAL-PIPELINE-RUNBOOK.md) — fiscal / myDATA / reconciliation
- [GROWTH-AND-CELERY.md](./GROWTH-AND-CELERY.md) — Celery beat tasks
