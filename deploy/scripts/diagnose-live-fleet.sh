#!/usr/bin/env bash
# Dump live-fleet state on the VPS (memory + Redis + recent logs).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deploy"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/.env.prod}"
COMPOSE="docker compose --env-file $ENV_FILE -f $DEPLOY_DIR/docker-compose.prod.yml"

cd "$REPO_ROOT"
echo "=== git ==="
git rev-parse --short HEAD || true

echo "=== platform tenant ==="
$COMPOSE exec -T api-blue python - <<'PY'
import asyncio, os
async def main():
    from travel_platform.operations.master_qr_bridge import resolve_platform_tenant_id
    from travel_platform.operations.master_qr_local import DEFAULT_TENANT
    tid = await resolve_platform_tenant_id()
    print("platform_tenant_id=", tid)
    print("DEFAULT_TENANT=", DEFAULT_TENANT)
    print("SAAS_DEFAULT_TENANT_ID=", os.getenv("SAAS_DEFAULT_TENANT_ID"))
    print("DEFAULT_TENANT_ID=", os.getenv("DEFAULT_TENANT_ID"))
    print("DEFAULT_TENANT_SLUG=", os.getenv("DEFAULT_TENANT_SLUG"))
asyncio.run(main())
PY

echo "=== in-memory live fleet ==="
$COMPOSE exec -T api-blue python - <<'PY'
import asyncio
from uuid import UUID
async def main():
    from travel_platform.operations.master_qr_bridge import resolve_platform_tenant_id
    from travel_platform.operations.master_qr_local import DEFAULT_TENANT
    from travel_platform.telemetry.processor import get_live_fleet
    live = get_live_fleet()
    print("memory_vehicle_count=", len(getattr(live, "_vehicles", {})))
    for vid, meta in list(getattr(live, "_vehicles", {}).items())[:30]:
        print(
            "mem", vid,
            "tenant=", meta.get("tenant_id"),
            "lat=", meta.get("lat"),
            "lng=", meta.get("lng"),
            "updated=", meta.get("updated_at"),
            "plate=", meta.get("bus_plate") or meta.get("vehicle_code"),
            "driver=", meta.get("driver_name"),
        )
    platform = await resolve_platform_tenant_id()
    for label, tid in [("platform", platform), ("demo", DEFAULT_TENANT)]:
        try:
            rows = await live.list_active_for_admin_async(UUID(str(tid)))
        except Exception as exc:
            print(label, "list_error", exc)
            continue
        print(label, "active=", len(rows), "tenant=", tid)
        for r in rows[:15]:
            print(" ", r.vehicle_id, r.vehicle_code, r.lat, r.lng, r.updated_at)
asyncio.run(main())
PY

echo "=== redis live keys ==="
$COMPOSE exec -T redis redis-cli --scan --pattern 'fleet:live:*' | head -80 || true

echo "=== recent api logs ==="
$COMPOSE logs --tail=300 api-blue 2>&1 | rg -i 'telemetry|gps|ingest|fleet_live|rate_limit|driver.*location|Redis save|fleet:live' | tail -100 || true

echo "=== done ==="
