#!/usr/bin/env bash
# Diagnose Contabo failures for POST /platform/tenants (Νέο γραφείο).
set -euo pipefail
cd /opt/poreiago
ENV_FILE="${ENV_FILE:-deploy/.env.prod}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f deploy/docker-compose.prod.yml)
if [[ -f deploy/docker-compose.npm.yml ]]; then
  COMPOSE+=(-f deploy/docker-compose.npm.yml)
fi

echo "==> api-blue recent provision / create-tenant errors"
API_CID="$("${COMPOSE[@]}" ps -q api-blue 2>/dev/null | head -1 || true)"
if [[ -n "${API_CID}" ]]; then
  docker logs --tail=400 "$API_CID" 2>&1 \
    | grep -iE 'provision_tenant|create_tenant|IntegrityError|NOT NULL|tenant_plan|slug=|Failed|Error|Exception|icona' \
    | tail -80 || true
else
  echo "api-blue container not found"
  "${COMPOSE[@]}" logs --tail=120 api-blue 2>&1 | tail -80 || true
fi

echo
echo "==> tenants / subscriptions plan + name columns"
"${COMPOSE[@]}" exec -T api-blue python - <<'PY'
import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(text("""
            SELECT table_name, column_name, is_nullable, data_type, column_default
            FROM information_schema.columns
            WHERE table_schema='public'
              AND table_name IN ('tenants','subscriptions','users')
              AND column_name IN ('name','legal_name','plan','slug','subdomain','roles','password_hash')
            ORDER BY table_name, column_name
        """))).mappings().all()
        for r in rows:
            print(dict(r))
        print("--- constraints mentioning plan/name ---")
        cons = (await session.execute(text("""
            SELECT t.relname AS table, c.conname, pg_get_constraintdef(c.oid) AS def
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname='public'
              AND t.relname IN ('tenants','subscriptions')
              AND (
                pg_get_constraintdef(c.oid) ILIKE '%plan%'
                OR pg_get_constraintdef(c.oid) ILIKE '%name%'
                OR c.contype IN ('u','p','c')
              )
            ORDER BY 1,2
        """))).mappings().all()
        for r in cons:
            print(dict(r))
        print("--- recent tenants ---")
        recent = (await session.execute(text("""
            SELECT slug, subdomain, plan::text, legal_name,
                   CASE WHEN EXISTS (
                     SELECT 1 FROM information_schema.columns
                     WHERE table_schema='public' AND table_name='tenants' AND column_name='name'
                   ) THEN 'has_name_col' ELSE 'no_name_col' END AS name_col
            FROM tenants
            ORDER BY created_at DESC NULLS LAST
            LIMIT 8
        """))).mappings().all()
        for r in recent:
            print(dict(r))

asyncio.run(main())
PY
