#!/usr/bin/env bash
# Diagnose GDPR /compliance/audit 500 on VPS.
set -euo pipefail
REPO_ROOT="${REPO_ROOT:-/opt/poreiago}"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/deploy/.env.prod}"
COMPOSE="${COMPOSE:-$REPO_ROOT/deploy/docker-compose.prod.yml}"
cd "$REPO_ROOT"

echo "==> compliance audit diagnose $(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

docker compose -f "$COMPOSE" exec -T api python - <<'PY'
import asyncio
import traceback

from sqlalchemy import text

async def main():
    try:
        from app.core.database import AsyncSessionLocal
    except Exception as exc:
        print("import_db_fail", exc)
        return

    async with AsyncSessionLocal() as s:
        checks = [
            ("regclass", "SELECT to_regclass('public.audit_logs')"),
            ("columns", "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='audit_logs' ORDER BY ordinal_position"),
            ("count", "SELECT count(*) FROM audit_logs"),
            ("sample", "SELECT id, action, created_at FROM audit_logs ORDER BY created_at DESC NULLS LAST LIMIT 3"),
        ]
        for name, q in checks:
            try:
                r = await s.execute(text(q))
                rows = [tuple(x) for x in r.fetchall()]
                print(f"OK {name}: {rows[:30]}")
            except Exception as e:
                print(f"ERR {name}: {type(e).__name__}: {e}")

        # Simulate service list for a tenant if any exists
        try:
            from uuid import UUID
            from app.services.audit_service import AuditService, audit_log_to_dict
            tid_row = (await s.execute(text("SELECT id FROM tenants LIMIT 1"))).first()
            if tid_row:
                tid = tid_row[0]
                print("tenant_sample", tid)
                entries, total = await AuditService(s).list_logs(UUID(str(tid)), limit=5)
                print("list_logs_ok", total, [audit_log_to_dict(e).get("action") for e in entries])
            else:
                print("no_tenants")
        except Exception:
            print("ERR list_logs")
            traceback.print_exc()

asyncio.run(main())
PY
