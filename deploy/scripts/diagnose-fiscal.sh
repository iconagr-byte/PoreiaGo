#!/usr/bin/env bash
# Diagnose Redis / Celery / fiscal pipeline on the VPS.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/.env.prod}"
COMPOSE="docker compose --env-file $ENV_FILE -f $DEPLOY_DIR/docker-compose.prod.yml"

cd "$REPO_ROOT"

echo "=== compose services (redis/worker/beat/api) ==="
$COMPOSE ps redis worker celery-beat api-blue 2>/dev/null || $COMPOSE ps

echo
echo "=== redis ping ==="
$COMPOSE exec -T redis redis-cli ping || true

echo
echo "=== celery inspect ping ==="
$COMPOSE exec -T worker celery -A workers.celery_app inspect ping -t 5 2>&1 || true

echo
echo "=== fiscal-related env keys (presence only) ==="
$COMPOSE exec -T api-blue python - <<'PY'
import os
keys = [
    "CELERY_BROKER_URL",
    "CELERY_RESULT_BACKEND",
    "FISCAL_ENCRYPTION_KEY",
    "AADE_MODE",
    "AADE_USER_ID",
    "AADE_SUBSCRIPTION_KEY",
    "AADE_VAT_NUMBER",
    "AADE_API_URL",
    "AADE_SECRETS_BACKEND",
]
for k in keys:
    v = os.getenv(k, "")
    if not v:
        print(f"{k}=<missing>")
    elif k.endswith("_KEY") or k.endswith("_ID") or "SECRET" in k or "TOKEN" in k or k.endswith("PASSWORD"):
        print(f"{k}=<set len={len(v)}>")
    else:
        print(f"{k}={v}")
PY

echo
echo "=== /health (from api container) ==="
$COMPOSE exec -T api-blue python - <<'PY'
import json, urllib.request
for url in ("http://127.0.0.1:8000/health", "http://127.0.0.1:8000/api/v1/health"):
    try:
        with urllib.request.urlopen(url, timeout=8) as r:
            body = json.loads(r.read().decode())
        print("URL", url)
        print(json.dumps({
            "status": body.get("status"),
            "redis": body.get("redis"),
            "celery": body.get("celery"),
            "fiscal": body.get("fiscal"),
            "database": body.get("database"),
        }, indent=2, ensure_ascii=False))
        break
    except Exception as exc:
        print(url, "->", exc)
PY

echo
echo "=== recent worker fiscal logs ==="
$COMPOSE logs --tail=80 worker 2>&1 | rg -i 'fiscal|aade|prosvasis|epsilon|process_fiscal|MARK' | tail -40 || true

echo
echo "=== done ==="
