#!/usr/bin/env bash
# Diagnose Teltonika Codec 8 TCP ingest + Achillio Travel device bindings.
# Safe to run via Actions from /tmp — pass REPO_ROOT=/opt/poreiago.
set -euo pipefail

ROOT="${REPO_ROOT:-}"
if [[ -z "$ROOT" || ! -d "$ROOT/deploy" ]]; then
  # Fallback only when script lives in-repo (…/deploy/scripts/…).
  ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
fi
cd "$ROOT"
ENV_FILE="${ENV_FILE:-$ROOT/deploy/.env.prod}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$ROOT/deploy/docker-compose.prod.yml")

echo "=== paths ==="
echo "ROOT=$ROOT"
echo "ENV_FILE=$ENV_FILE"
echo "cwd=$(pwd)"

echo
echo "=== git ==="
git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || true
git -C "$ROOT" log -1 --oneline 2>/dev/null || true

echo
echo "=== env (Teltonika) ==="
# Never `source` .env.prod — PEM / spaced values break bash.
env_get() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 0
  awk -F= -v k="$key" '
    $0 ~ "^[[:space:]]*#" { next }
    index($0, k "=") == 1 || $0 ~ "^[[:space:]]*" k "=" {
      sub(/^[^=]*=/, "", $0)
      gsub(/\r$/, "", $0)
      gsub(/^["'\'']|["'\'']$/, "", $0)
      val=$0
    }
    END { if (val != "") print val }
  ' "$ENV_FILE"
}
TELTONIKA_TCP_ENABLED="$(env_get TELTONIKA_TCP_ENABLED)"
TELTONIKA_TCP_PORT="$(env_get TELTONIKA_TCP_PORT)"
PLATFORM_INGRESS_IP="$(env_get PLATFORM_INGRESS_IP)"
echo "TELTONIKA_TCP_ENABLED=${TELTONIKA_TCP_ENABLED:-<unset>}"
echo "TELTONIKA_TCP_PORT=${TELTONIKA_TCP_PORT:-5027}"
echo "PLATFORM_INGRESS_IP=${PLATFORM_INGRESS_IP:-<unset>}"

PORT="${TELTONIKA_TCP_PORT:-5027}"
echo
echo "=== host listen :${PORT} ==="
ss -lnt "sport = :${PORT}" 2>/dev/null || netstat -lnt 2>/dev/null | grep ":${PORT}" || true
if command -v ufw >/dev/null 2>&1; then
  echo "ufw:"
  ufw status 2>/dev/null | grep -Ei "${PORT}|Status" || true
fi

echo
echo "=== docker port map ==="
"${COMPOSE[@]}" ps api-blue 2>/dev/null || true
API_CID="$("${COMPOSE[@]}" ps -q api-blue 2>/dev/null | head -1 || true)"
if [[ -n "${API_CID}" ]]; then
  docker port "$API_CID" 2>/dev/null || true
fi

echo
echo "=== device store (durable last_seen / points) ==="
echo "(Note: docker-exec get_teltonika_status counters are always 0 — fresh process.)"
echo "(Tracker pins without driver_id are allowed when IMEI/plate is bound here.)"
"${COMPOSE[@]}" exec -T api-blue python - <<'PY'
from travel_platform.telemetry.teltonika import list_devices
import json
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
echo "=== TCP IMEI probe (localhost :${PORT}) ==="
"${COMPOSE[@]}" exec -T api-blue python - <<'PY'
import json, socket, struct
from travel_platform.telemetry.teltonika import list_devices

rows = list_devices()
imei = None
for r in rows:
    if r.get("enabled") and r.get("imei"):
        imei = str(r["imei"])
        break
if not imei:
    print("PROBE_SKIP no enabled IMEI")
else:
    payload = struct.pack(">H", len(imei)) + imei.encode("ascii")
    try:
        s = socket.create_connection(("127.0.0.1", 5027), timeout=5)
        s.sendall(payload)
        resp = s.recv(1)
        s.close()
        code = resp.hex() if resp else "empty"
        print("PROBE_IMEI", imei, "reply=0x" + code, "OK" if resp == b"\x01" else "REJECT")
    except Exception as exc:
        print("PROBE_FAIL", type(exc).__name__, str(exc)[:200])
PY

echo
echo "=== Achillio Travel tenant match ==="
"${COMPOSE[@]}" exec -T api-blue python - <<'PY'
import asyncio, json
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.tenant import Tenant
from app.services.tenant_modules import is_achillio_travel_office, is_poreiago_platform_office
from travel_platform.telemetry.teltonika import list_devices
from travel_platform.telemetry.processor import get_live_fleet
from uuid import UUID

async def main():
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(Tenant))).scalars().all()
    ach = [t for t in rows if is_achillio_travel_office(t)]
    plat = [t for t in rows if is_poreiago_platform_office(t)]
    print("achillio_office_count=", len(ach))
    for t in ach:
        print(json.dumps({
            "id": str(t.id),
            "slug": t.slug,
            "subdomain": getattr(t, "subdomain", None),
            "custom_domain": getattr(t, "custom_domain", None),
            "legal_name": getattr(t, "legal_name", None),
        }, default=str))
    print("platform_office_count=", len(plat))
    for t in plat[:3]:
        print("platform", str(t.id), t.slug, getattr(t, "custom_domain", None))

    devices = list_devices()
    ach_ids = {str(t.id) for t in ach}
    plat_ids = {str(t.id) for t in plat}
    bound = [d for d in devices if str(d.get("tenant_id")) in ach_ids]
    wrong = [d for d in devices if str(d.get("tenant_id")) in plat_ids]
    other = [
        d for d in devices
        if str(d.get("tenant_id")) not in ach_ids and str(d.get("tenant_id")) not in plat_ids
    ]
    print("achillio_bound_devices=", len(bound))
    print("platform_bound_devices=", len(wrong))
    print("other_bound_devices=", len(other))
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
    for d in wrong:
        print(
            "PLATFORM_GPS_MISBIND",
            "imei=", d.get("imei"),
            "plate=", d.get("vehicle_code"),
            "tenant=", d.get("tenant_id"),
            "last_seen=", d.get("last_seen_at"),
            "HINT=bound under PoreiaGo platform — re-add IMEI while logged into achilliotravel.com",
        )
    if not bound and not wrong and not other:
        print("ACHILLIO_GPS NONE — no IMEI in store at all")
    elif not bound:
        print("ACHILLIO_GPS NONE — no IMEI bound to Achillio Travel office")

    live = get_live_fleet()
    vehicles = getattr(live, "_vehicles", {}) or {}
    print("memory_vehicle_count=", len(vehicles))
    for tid in ach_ids:
        try:
            rows = await live.list_active_for_admin_async(UUID(tid))
        except Exception as exc:
            print("achillio_live_list_error", tid, exc)
            continue
        print("achillio_live_active=", len(rows), "tenant=", tid)
        for r in rows[:20]:
            print(
                "ACHILLIO_LIVE",
                getattr(r, "vehicle_id", None),
                getattr(r, "vehicle_code", None),
                getattr(r, "lat", None),
                getattr(r, "lng", None),
                getattr(r, "updated_at", None),
            )

asyncio.run(main())
PY

echo
echo "=== recent api logs (teltonika/codec/imei) ==="
"${COMPOSE[@]}" logs --tail=400 api-blue 2>&1 \
  | grep -Ei 'teltonika|codec.?8|imei|5027|gps tracker' \
  | tail -80 || true

echo
echo "=== done ==="

# diagnose bump 20260930T113843Z
