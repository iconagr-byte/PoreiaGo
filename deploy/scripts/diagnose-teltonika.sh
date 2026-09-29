#!/usr/bin/env bash
# Diagnose Teltonika Codec 8 TCP ingest + Achillio Travel device bindings.
# Run on the VPS from /opt/poreiago (or via GitHub Actions SSH).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
ENV_FILE="${ENV_FILE:-deploy/.env.prod}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f deploy/docker-compose.prod.yml)

echo "=== git ==="
git rev-parse --short HEAD 2>/dev/null || true
git log -1 --oneline 2>/dev/null || true

echo
echo "=== env (Teltonika) ==="
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi
echo "TELTONIKA_TCP_ENABLED=${TELTONIKA_TCP_ENABLED:-<unset>}"
echo "TELTONIKA_TCP_PORT=${TELTONIKA_TCP_PORT:-5027}"
echo "PLATFORM_INGRESS_IP=${PLATFORM_INGRESS_IP:-<unset>}"

PORT="${TELTONIKA_TCP_PORT:-5027}"
echo
echo "=== host listen :${PORT} ==="
ss -lnt "sport = :${PORT}" 2>/dev/null || netstat -lnt 2>/dev/null | grep ":${PORT}" || true
if command -v ufw >/dev/null 2>&1; then
  echo "ufw:"
  ufw status 2>/dev/null | rg -i "${PORT}|Status" || true
fi

echo
echo "=== docker port map ==="
"${COMPOSE[@]}" ps api-blue 2>/dev/null || true
docker port "$("${COMPOSE[@]}" ps -q api-blue 2>/dev/null | head -1)" 2>/dev/null || true

echo
echo "=== API in-process Teltonika status ==="
"${COMPOSE[@]}" exec -T api-blue python - <<'PY'
from travel_platform.telemetry.teltonika import get_teltonika_status, list_devices
import json
st = get_teltonika_status()
print(json.dumps(st, indent=2, default=str))
rows = list_devices()
print("device_count=", len(rows))
for r in rows:
    print(
        "device",
        "imei=", r.get("imei"),
        "plate=", r.get("vehicle_code"),
        "tenant=", r.get("tenant_id"),
        "enabled=", r.get("enabled"),
        "last_seen=", r.get("last_seen_at"),
        "lat=", r.get("last_lat"),
        "lng=", r.get("last_lng"),
        "speed=", r.get("last_speed_kmh"),
        "points=", r.get("points_accepted"),
        "label=", r.get("label"),
    )
PY

echo
echo "=== Achillio Travel tenant match ==="
"${COMPOSE[@]}" exec -T api-blue python - <<'PY'
import asyncio, json
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.tenant import Tenant
from app.services.tenant_modules import is_achillio_travel_office
from travel_platform.telemetry.teltonika import list_devices

async def main():
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(Tenant))).scalars().all()
    ach = [t for t in rows if is_achillio_travel_office(t)]
    print("achillio_office_count=", len(ach))
    for t in ach:
        print(json.dumps({
            "id": str(t.id),
            "slug": t.slug,
            "subdomain": getattr(t, "subdomain", None),
            "custom_domain": getattr(t, "custom_domain", None),
            "legal_name": getattr(t, "legal_name", None),
        }, default=str))
    devices = list_devices()
    ach_ids = {str(t.id) for t in ach}
    bound = [d for d in devices if str(d.get("tenant_id")) in ach_ids]
    print("achillio_bound_devices=", len(bound))
    for d in bound:
        seen = d.get("last_seen_at")
        has_fix = d.get("last_lat") is not None and d.get("last_lng") is not None
        status = "OK" if seen and has_fix else ("SEEN_NO_FIX" if seen else "WAITING")
        print(
            "ACHILLIO_GPS",
            status,
            "imei=", d.get("imei"),
            "plate=", d.get("vehicle_code"),
            "enabled=", d.get("enabled"),
            "last_seen=", seen,
            "lat=", d.get("last_lat"),
            "lng=", d.get("last_lng"),
            "points=", d.get("points_accepted"),
        )
    if not bound:
        print("ACHILLIO_GPS NONE — no IMEI bound to Achillio Travel office")

asyncio.run(main())
PY

echo
echo "=== live fleet memory (tracker-like) ==="
"${COMPOSE[@]}" exec -T api-blue python - <<'PY'
import asyncio
from travel_platform.telemetry.processor import get_live_fleet

async def main():
    live = get_live_fleet()
    vehicles = getattr(live, "_vehicles", {}) or {}
    print("memory_vehicle_count=", len(vehicles))
    for vid, meta in list(vehicles.items())[:30]:
        print(
            "mem",
            vid,
            "tenant=", meta.get("tenant_id"),
            "plate=", meta.get("bus_plate") or meta.get("vehicle_code"),
            "lat=", meta.get("lat"),
            "lng=", meta.get("lng"),
            "updated=", meta.get("updated_at"),
            "source=", meta.get("source") or meta.get("provider"),
        )

asyncio.run(main())
PY

echo
echo "=== recent api logs (teltonika/codec/imei) ==="
"${COMPOSE[@]}" logs --tail=300 api-blue 2>&1 \
  | rg -i 'teltonika|codec.?8|imei|5027|gps tracker' \
  | tail -60 || true

echo
echo "=== done ==="
