# Project Travel SaaS — Backend Blueprint

Multi-tenant cloud-native API on **FastAPI**, **PostgreSQL + PostGIS**, **Redis**, **Docker**, **Traefik**.

## Layout

```
backend/app/
├── api/           # HTTP routers (auth, bookings, aade, telemetry)
├── core/          # config, database, JWT, tenant RLS dependencies
├── models/        # SQLAlchemy — Tenant, User, Booking, Stop, AuditLog, AadeSubmission
├── services/      # business logic (MFA, AADE queue, telemetry, audit, backup)
├── workers/       # Redis consumers (AADE)
└── main.py        # `saas_app` factory
```

Legacy ticketing and platform modules remain under `backend/api`, `backend/platform`, etc. The SaaS core mounts at **`/api/v1/*`** via `backend/main.py`.

## Quick start

```bash
# From repo root
cp backend/.env.example .env   # set AUTH_JWT_SECRET
make bootstrap                 # docker up + alembic + seed
# or locally:
make migrate && make seed && make dev-api
```

**Demo credentials** (after `make seed`):

- `tenant_id` — printed by seed script
- Email: `admin@achillio.gr` / Password: `Admin123!`
- Telemetry: `X-API-Key` header (printed once at seed)

API docs: http://localhost:8000/docs

Traefik dashboard (local): http://localhost:8080

## Multi-tenancy

1. Every tenant-scoped row has `tenant_id` (FK → `tenants`).
2. JWT access token must include `tenant_id`, `sub` (user), `roles`, `mfa_verified`.
3. `get_tenant_db` sets `app.current_tenant` for Postgres **RLS** (`app/core/rls.py`).
4. `tenant_scoped_select()` adds defense-in-depth ORM filters.

Public routes (no JWT): `/api/v1/auth/login`, `/api/v1/aade/webhook`, `/api/v1/telemetry/update` (uses **X-API-Key** or Bearer), `/health`.

## RBAC roles

| Role | Typical use |
|------|-------------|
| `superadmin` | Platform operator |
| `tenant_admin` | Agency owner — MFA required |
| `dispatcher` | Operations / bookings |
| `driver` | Manifest / scan |
| `customer` | Self-service booking |
| `auditor` | Read-only compliance |

## Key endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Email/password (+ optional MFA) → JWT |
| POST | `/api/v1/auth/mfa/enroll` | TOTP setup (authenticated) |
| POST | `/api/v1/bookings` | Create booking (audited) |
| POST | `/api/v1/aade/enqueue` | Queue myDATA invoice (202) |
| GET | `/api/v1/aade/status/{id}` | Poll submission status |
| POST | `/api/v1/telemetry/update` | GPS ingest + geofence (202) |

## Background workers

```bash
make worker
# or docker compose service `aade-worker`
```

Processes Redis list `saas:aade:queue` and calls `platform.compliance.aade_gateway.AadeGateway`.

## Backup / DR

```bash
export BACKUP_S3_BUCKET=your-bucket
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
make backup
```

Runs `pg_dump` → gzip → S3 (`app/services/backup_service.py`).

## Production checklist

- [ ] Strong `AUTH_JWT_SECRET` (32+ bytes)
- [ ] Alembic migrations instead of `init_models()` in dev lifespan
- [ ] Vault for AADE certificates (not `DevSecretsProvider`)
- [ ] HMAC on `/api/v1/aade/webhook`
- [ ] Device API keys for `/telemetry/update` (optional middleware)
- [ ] Envelope encryption for `mfa_secret_encrypted`
- [ ] Connection pool sizing for 1000+ concurrent bookings

## Environment variables

See `app/core/config.py` — main vars: `DATABASE_URL`, `REDIS_URL`, `AUTH_JWT_SECRET`, `BACKUP_S3_BUCKET`, `AWS_*`.
