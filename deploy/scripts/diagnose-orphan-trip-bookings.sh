#!/usr/bin/env bash
# List (and optionally purge) Achillio bookings whose trip was deleted from the catalog.
# Contabo VPS — run via GitHub Actions diagnose workflow or SSH.
#
# Usage:
#   bash deploy/scripts/diagnose-orphan-trip-bookings.sh
#   PURGE=1 TITLE='test1' bash deploy/scripts/diagnose-orphan-trip-bookings.sh
set -euo pipefail
cd /opt/poreiago 2>/dev/null || cd "$(dirname "$0")/../.."

export TITLE="${TITLE:-test1}"
export PURGE="${PURGE:-0}"
export TENANT_SLUG="${TENANT_SLUG:-admin-achillio-gr}"

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
echo "==> tenant=$TENANT_SLUG title=$TITLE purge=$PURGE api=$API_CID"

docker exec -i \
  -e TITLE -e PURGE -e TENANT_SLUG \
  "$API_CID" python - <<'PY'
import asyncio
import json
import os
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

TITLE = (os.environ.get("TITLE") or "test1").strip()
PURGE = (os.environ.get("PURGE") or "0").strip() == "1"
TENANT_SLUG = (os.environ.get("TENANT_SLUG") or "admin-achillio-gr").strip()

async def main():
    async with AsyncSessionLocal() as session:
        tid_row = (
            await session.execute(
                text(
                    "SELECT id::text, slug, name, custom_domain FROM tenants "
                    "WHERE slug = :s LIMIT 1"
                ),
                {"s": TENANT_SLUG},
            )
        ).mappings().first()
        if not tid_row:
            tid_row = (
                await session.execute(
                    text(
                        "SELECT id::text, slug, name, custom_domain FROM tenants "
                        "WHERE custom_domain ILIKE '%achilliotravel%' LIMIT 1"
                    )
                )
            ).mappings().first()
        if not tid_row:
            print("ERROR: Achillio tenant not found")
            return
        tid = tid_row["id"]
        print("tenant:", json.dumps(dict(tid_row), ensure_ascii=False))

        # Legacy office_trips table (may not exist on all deploys)
        try:
            cat = (
                await session.execute(
                    text(
                        """
                        SELECT id, title, departure_at::text AS departure, status::text
                        FROM office_trips
                        WHERE tenant_id::text = :tid
                          AND lower(title) = lower(:title)
                        ORDER BY id
                        """
                    ),
                    {"tid": tid, "title": TITLE},
                )
            ).mappings().all()
            print(f"office_trips named {TITLE!r}:", len(cat))
            for r in cat:
                print("  trip", dict(r))
        except Exception as exc:
            await session.rollback()
            print("office_trips: skip", type(exc).__name__, str(exc)[:160])

        try:
            jcat = (
                await session.execute(
                    text(
                        """
                        SELECT trip_id::text AS id,
                               payload->>'title' AS title,
                               payload->>'departureTime' AS departure
                        FROM tenant_trip_catalog
                        WHERE tenant_id::text = :tid
                          AND lower(coalesce(payload->>'title','')) = lower(:title)
                        """
                    ),
                    {"tid": tid, "title": TITLE},
                )
            ).mappings().all()
            print(f"tenant_trip_catalog named {TITLE!r}:", len(jcat))
            for r in jcat:
                print("  cat", dict(r))
        except Exception as exc:
            await session.rollback()
            print("tenant_trip_catalog: skip", type(exc).__name__, str(exc)[:160])

        rows = (
            await session.execute(
                text(
                    """
                    SELECT id::text,
                           reference_code,
                           status::text,
                           payment_status::text,
                           total_price::float AS total,
                           coalesce(
                             metadata_json->>'trip_title',
                             metadata_json->>'tripTitle',
                             ''
                           ) AS trip_title,
                           coalesce(
                             metadata_json->>'external_trip_id',
                             trip_id::text,
                             ''
                           ) AS trip_id,
                           coalesce(
                             metadata_json->>'date',
                             left(coalesce(metadata_json->>'departure_at',''), 10),
                             ''
                           ) AS date
                    FROM bookings
                    WHERE tenant_id::text = :tid
                      AND (
                        lower(coalesce(metadata_json->>'trip_title','')) = lower(:title)
                        OR lower(coalesce(metadata_json->>'tripTitle','')) = lower(:title)
                        OR metadata_json::text ILIKE :pat
                      )
                    ORDER BY created_at DESC NULLS LAST
                    LIMIT 100
                    """
                ),
                {"tid": tid, "title": TITLE, "pat": f"%{TITLE}%"},
            )
        ).mappings().all()

        # Prefer exact title matches; fall back to ILIKE hits
        exact = [
            r
            for r in rows
            if (r["trip_title"] or "").strip().lower() == TITLE.lower()
        ]
        use = exact or list(rows)
        print(f"bookings matching {TITLE!r}:", len(use), "(exact)" if exact else "(ilike)")
        total = 0.0
        for r in use:
            total += float(r["total"] or 0)
            print(
                "  booking",
                (r["id"] or "")[:8],
                r["reference_code"],
                r["status"],
                r["payment_status"],
                f"€{r['total']}",
                r["date"],
                (r["trip_title"] or "")[:48],
            )
        print(f"revenue_sum_eur: {total:.2f}")

        if PURGE and use:
            ids = [r["id"] for r in use]
            print(f"PURGE deleting {len(ids)} bookings…")
            deleted = 0
            for bid in ids:
                res = await session.execute(
                    text(
                        "DELETE FROM bookings "
                        "WHERE tenant_id::text = :tid AND id::text = :bid"
                    ),
                    {"tid": tid, "bid": bid},
                )
                deleted += int(res.rowcount or 0)
            await session.commit()
            print(f"PURGE done deleted={deleted}")
        elif PURGE:
            print("PURGE: nothing to delete")
        else:
            print("dry-run only — set PURGE=1 to delete these bookings")

asyncio.run(main())
PY
