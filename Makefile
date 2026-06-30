.PHONY: up down logs shell migrate backup dev-api worker celery-worker celery-beat fiscal-smoke
.PHONY: dev dev-infra dev-down stack-full stack-logs logs-celery stack-health bootstrap seed health

COMPOSE ?= docker compose
COMPOSE_DEV := $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
export AUTH_JWT_SECRET ?= dev-jwt-secret-change-in-prod

# --- Full production-like stack (Traefik + all services) ---
up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

bootstrap: up
	@echo Waiting for Postgres...
	@powershell -Command "Start-Sleep -Seconds 8" 2>nul || sleep 8
	$(MAKE) migrate
	$(MAKE) seed

# --- Hybrid local dev: DB + Redis in Docker, API on host ---
dev-infra:
	$(COMPOSE) up -d db redis
	@echo Waiting for Postgres + Redis...
	@powershell -Command "Start-Sleep -Seconds 6" 2>nul || sleep 6
	@$(COMPOSE) exec -T redis redis-cli ping || true

dev-down:
	$(COMPOSE) stop db redis

dev: dev-infra migrate seed
	@echo.
	@echo === Local dev ready (hybrid) ===
	@echo   Terminal 1: make dev-api
	@echo   Terminal 2: make celery-worker
	@echo   Terminal 3: make celery-beat
	@echo   Frontend:   npm run dev
	@echo   Health:     make health
	@echo   Docs:       docs/LOCAL-DEV.md
	@echo.

# --- Full stack in Docker with API on :8000 (no Traefik) ---
stack-full:
	$(COMPOSE_DEV) up -d --build db redis web celery-worker celery-beat aade-worker
	@echo Waiting for services...
	@powershell -Command "Start-Sleep -Seconds 10" 2>nul || sleep 10
	$(MAKE) migrate
	$(MAKE) seed
	@echo API: http://localhost:8000  Health: http://localhost:8000/api/v1/health

stack-logs:
	$(COMPOSE) logs -f web celery-worker celery-beat

logs-celery:
	$(COMPOSE) logs -f celery-worker celery-beat

stack-health: health
	cd backend && python -m scripts.fiscal_pipeline_smoke --api-base http://127.0.0.1:8000

logs:
	$(COMPOSE) logs -f web

shell:
	$(COMPOSE) exec web bash

dev-api:
	cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000

worker:
	cd backend && python -m app.workers.aade_consumer

celery-worker:
	cd backend && celery -A workers.celery_app worker --loglevel=info --pool=solo

celery-beat:
	cd backend && celery -A workers.celery_app beat --loglevel=info

fiscal-smoke:
	cd backend && python -m scripts.fiscal_pipeline_smoke

fiscal-aade-e2e:
	cd backend && python -m scripts.fiscal_aade_e2e --mock

fiscal-aade-e2e-live:
	cd backend && python -m scripts.fiscal_aade_e2e --live

migrate:
	cd backend && alembic upgrade head

seed:
	cd backend && python -m scripts.seed_saas_dev

backup:
	cd backend && python -m app.services.backup_service

health:
	@curl -s http://localhost:8000/health 2>nul || curl -s http://127.0.0.1:8000/health || echo "API not reachable on :8000"
	@echo.
	@curl -s http://localhost:8000/api/v1/health 2>nul || curl -s http://127.0.0.1:8000/api/v1/health || true

predeploy:
	cd backend && python -m scripts.predeploy_check --strict --migrate

olympus-up:
	$(COMPOSE) --env-file deploy/.env.olympus.prod -f docker-compose.olympus.yml up -d --build

olympus-predeploy:
	bash deploy/scripts/predeploy.sh
