#!/usr/bin/env bash
# Look up (and optionally purge) a booking by reference / PNR / UUID on Contabo.
#
# Usage:
#   REF=BK-F15C6C28 bash deploy/scripts/diagnose-booking-by-ref.sh
#   REF=BK-F15C6C28 PURGE=1 bash deploy/scripts/diagnose-booking-by-ref.sh
set -euo pipefail
cd /opt/poreiago 2>/dev/null || cd "$(dirname "$0")/../.."

export REF="${REF:-BK-F15C6C28}"
export PURGE="${PURGE:-0}"
export TENANT_SLUG="${TENANT_SLUG:-}"

COMPOSE=(docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.npm.yml)
if [ -f deploy/.env.prod ]; then
  COMPOSE+=(--env-file deploy/.env.prod)
fi

API_CID="$("${COMPOSE[@]}" ps -q api-blue 2>/dev/null | head -1 || true)"
if [ -z "${API_CID:-}" ]; then
  API_CID="$(docker ps --filter name=api-blue --format '{{.ID}}' | head -1 || true)"
fi
if [ -z "${API_CID:-}" ]; then
  echo "ERROR: api-blue not found"
  exit 1
fi

echo "==> git HEAD $(git rev-parse --short HEAD 2>/dev/null || echo '?')"
echo "==> ref=$REF purge=$PURGE tenant_slug=${TENANT_SLUG:-*} api=$API_CID"

docker exec -i \
  -e REF -e PURGE -e TENANT_SLUG \
  "$API_CID" python - <<'PY'
import asyncio
import json
import os
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

ref = str(os.environ.get("REF") or "").strip()
purge = str(os.environ.get("PURGE") or "0").strip() in {"1", "true", "TRUE", "yes"}
slug = str(os.environ.get("TENANT_SLUG") or "").strip()

async def main():
    if not ref:
        print("ERROR: REF required")
        return
    core = ref
    for prefix in ("BK-", "B-"):
        if core.upper().startswith(prefix):
            core = core[len(prefix):]
            break
    like = f"%{ref}%"
    async with AsyncSessionLocal() as db:
        tenant_filter = ""
        params = {"ref": ref, "core": core, "like": like, "b_id": f"B-{core}", "bk": f"BK-{core}"}
        if slug:
            tenant_filter = """
              AND tenant_id IN (
                SELECT id FROM tenants
                WHERE slug = :slug OR subdomain = :slug OR custom_domain ILIKE :slug_like
              )
            """
            params["slug"] = slug
            params["slug_like"] = f"%{slug}%"
        rows = (
            await db.execute(
                text(
                    f"""
                    SELECT id::text AS id,
                           tenant_id::text AS tenant_id,
                           reference_code,
                           passenger_email,
                           passenger_name,
                           status::text AS status,
                           created_at,
                           metadata_json
                    FROM bookings
                    WHERE (
                      reference_code ILIKE :ref
                      OR reference_code ILIKE :bk
                      OR reference_code ILIKE :core
                      OR id::text = :ref
                      OR id::text ILIKE :like
                      OR metadata_json::text ILIKE :like
                      OR metadata_json->>'local_id' IN (:ref, :b_id, :bk, :core)
                    )
                    {tenant_filter}
                    ORDER BY created_at DESC
                    LIMIT 30
                    """
                ),
                params,
            )
        ).mappings().all()
        print(f"rows={len(rows)}")
        for r in rows:
            meta = r.get("metadata_json") or {}
            if isinstance(meta, str):
                try:
                    meta = json.loads(meta)
                except Exception:
                    meta = {}
            print(
                json.dumps(
                    {
                        "id": r["id"],
                        "tenant_id": r["tenant_id"],
                        "reference_code": r["reference_code"],
                        "passenger_email": r["passenger_email"],
                        "passenger_name": r["passenger_name"],
                        "status": r["status"],
                        "created_at": str(r["created_at"]),
                        "wallet_customer_email": (meta or {}).get("wallet_customer_email"),
                        "trip_title": (meta or {}).get("trip_title"),
                        "local_id": (meta or {}).get("local_id"),
                    },
                    ensure_ascii=False,
                )
            )
        if purge and rows:
            ids = [r["id"] for r in rows]
            for bid in ids:
                await db.execute(
                    text("DELETE FROM bookings WHERE id::text = :bid"),
                    {"bid": bid},
                )
            await db.commit()
            print(f"PURGED={len(ids)} ids={ids}")
            # Drop wallet SQLite cache aliases if helper exists.
            try:
                from ticketing.wallet_booking_reconcile import purge_wallet_booking_aliases

                aliases = []
                for r in rows:
                    aliases.extend(
                        [
                            r["id"],
                            r.get("reference_code") or "",
                            f"B-{core}",
                            f"BK-{core}",
                            core,
                        ]
                    )
                for email in {
                    str(r.get("passenger_email") or "").strip().lower()
                    for r in rows
                    if r.get("passenger_email")
                }:
                    await purge_wallet_booking_aliases(
                        aliases=aliases,
                        email=email,
                        tenant_id=str(rows[0]["tenant_id"]),
                    )
                print("wallet_cache_purged=1")
            except Exception as exc:
                print(f"wallet_cache_purge_skipped={exc}")

asyncio.run(main())
PY
