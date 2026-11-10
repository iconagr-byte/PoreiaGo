#!/usr/bin/env bash
# Contabo: list Achillio drivers + probe /api/driver/session/login tenant binding.
set -euo pipefail
cd /opt/poreiago 2>/dev/null || cd "$(dirname "$0")/../.."

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
echo "==> api=$API_CID"

# Copy latest store modules if host is ahead of image (read-only diagnose still OK).
docker exec -i "$API_CID" python - <<'PY'
import asyncio
import json
import os
from pathlib import Path

print("FLEET_DRIVERS_STORE", os.getenv("FLEET_DRIVERS_STORE") or "<default>")
print("POREIAGO_DATA_DIR", os.getenv("POREIAGO_DATA_DIR") or "<default>")

from travel_platform.settings.drivers_store import (
    DEMO_TENANT_ID,
    STORE_PATH,
    authenticate_driver,
    is_seed_driver,
    list_drivers_for_office,
    _ensure,
    _driver_tenant_id,
)

print("store_path", STORE_PATH, "exists", Path(STORE_PATH).exists())
all_d = list(_ensure().values())
print("drivers_total", len(all_d))
by_tenant = {}
for d in all_d:
    tid = _driver_tenant_id(d)
    by_tenant.setdefault(tid, []).append(d)
print("tenants_with_drivers", len(by_tenant))

from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as session:
        rows = (
            await session.execute(
                text(
                    "SELECT id::text, slug, name, custom_domain FROM tenants "
                    "ORDER BY slug"
                )
            )
        ).mappings().all()
        print("tenants_db", len(rows))
        ach = None
        for r in rows:
            print("  tenant", r["slug"], r["custom_domain"], r["id"][:8])
            dom = (r["custom_domain"] or "").lower()
            if "achillio" in (r["slug"] or "") or "achillio" in dom:
                ach = r
        if not ach:
            print("ERROR: no Achillio tenant")
            return
        tid = ach["id"]
        print("ACHILLIO", json.dumps(dict(ach), ensure_ascii=False))

        office = list_drivers_for_office(tid)
        print(f"achillio_drivers_list_drivers={len(office)}")
        for d in office:
            print(
                "  OK",
                d.name,
                d.email,
                d.license_no,
                d.license_plate or "-",
                d.status,
                "hash=" + ("yes" if d.password_hash else "no"),
                "seed=" + str(is_seed_driver(d)),
            )

        # Drivers on DEMO that Achillio login could claim
        demo = [d for d in all_d if _driver_tenant_id(d) == DEMO_TENANT_ID and not is_seed_driver(d)]
        print(f"demo_orphan_non_seed={len(demo)}")
        for d in demo[:20]:
            print("  DEMO", d.name, d.email, d.status)

        # Wrong-office lookalikes (same email on other tenants)
        ach_emails = {d.email.lower() for d in office}
        for d in all_d:
            if is_seed_driver(d):
                continue
            if d.email.lower() in ach_emails and _driver_tenant_id(d) != tid:
                print(
                    "  CROSS",
                    d.email,
                    "home",
                    _driver_tenant_id(d)[:8],
                    "name",
                    d.name,
                )

        # Probe authenticate with DEFAULT password for each Achillio driver (no print of secrets)
        from travel_platform.settings.drivers_store import DEFAULT_DRIVER_PASSWORD

        ok_default = 0
        for d in office:
            if d.status not in ("active", "on_leave"):
                continue
            authed = authenticate_driver(
                d.email, DEFAULT_DRIVER_PASSWORD, tenant_id=tid, allow_demo_legacy=True
            )
            if authed:
                ok_default += 1
                print("  DEFAULT_PWD_OK", d.email)
            else:
                print("  DEFAULT_PWD_FAIL (custom password set?)", d.email)
        print(f"achillio_active_accept_default_password={ok_default}/{len(office)}")

asyncio.run(main())
PY

echo
echo "==> HTTP probe Host=www.achilliotravel.com (fake creds)"
curl -sS -m 10 -o /tmp/drv_probe.json -w "http %{http_code}\n" \
  -X POST "http://127.0.0.1:8004/api/driver/session/login" \
  -H "Content-Type: application/json" \
  -H "Host: www.achilliotravel.com" \
  -H "Origin: https://www.achilliotravel.com" \
  -d '{"username":"diag-missing@example.com","password":"nope"}' || echo err
head -c 300 /tmp/drv_probe.json 2>/dev/null; echo

echo
echo "==> recent driver login audits (api logs)"
"${COMPOSE[@]}" logs --tail=120 api-blue 2>/dev/null \
  | rg -i 'driver.*login|session/login|άλλο γραφείο|Λάθος όνομα|authenticate' \
  || "${COMPOSE[@]}" logs --tail=40 api-blue 2>/dev/null \
  || true
