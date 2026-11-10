#!/usr/bin/env bash
# Capture recent guest-booking failures from api-blue on Contabo.
set -euo pipefail
cd /opt/poreiago 2>/dev/null || cd "$(dirname "$0")/../.."

COMPOSE=(docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.npm.yml)
if [ -f deploy/.env.prod ]; then
  COMPOSE+=(--env-file deploy/.env.prod)
fi

echo "==> git HEAD"
git rev-parse --short HEAD 2>/dev/null || true
git log -1 --oneline 2>/dev/null || true

echo "==> confirm create_task path in image"
API_CID="$("${COMPOSE[@]}" ps -q api-blue 2>/dev/null | head -1 || true)"
if [ -n "${API_CID:-}" ]; then
  docker exec "$API_CID" sh -c \
    'grep -n "_schedule_guest_booking_side_effects\|create_task\|BackgroundTasks\|JSONResponse" /app/app/api/bookings.py | head -40' \
    || docker exec "$API_CID" sh -c \
    'grep -n "_schedule_guest_booking_side_effects\|create_task\|BackgroundTasks\|JSONResponse" /app/backend/app/api/bookings.py | head -40' \
    || true
fi

echo "==> last guest / bookings errors from api-blue (200 lines)"
"${COMPOSE[@]}" logs --tail=200 api-blue 2>/dev/null \
  | rg -i 'guest|bookings/guest|Traceback|Error|Exception|side-effect|500' \
  || "${COMPOSE[@]}" logs --tail=80 api-blue 2>/dev/null \
  || true

echo "==> live probe POST /api/v1/bookings/guest"
SEAT="DG$(date +%s | tail -c 6)"
CODE=$(curl -sS -o /tmp/guest_diag.body -w "%{http_code}" --max-time 15 \
  -X POST "http://127.0.0.1:8004/api/v1/bookings/guest" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Host: www.achilliotravel.com" \
  -H "Origin: https://www.achilliotravel.com" \
  -d "{\"passenger_name\":\"Diag\",\"passenger_email\":\"diag-guest@example.com\",\"amount_eur\":1,\"total_eur\":1,\"external_trip_id\":91001,\"trip_title\":\"Ημερήσια στα Μετέωρα\",\"seats\":[\"$SEAT\"],\"seat_label\":\"$SEAT\",\"source\":\"wallet_checkout\",\"payment_method\":\"card\",\"departure_at\":\"2026-06-15T07:00:00\"}" \
  || echo err)
echo "seat=$SEAT http=$CODE"
head -c 500 /tmp/guest_diag.body 2>/dev/null; echo

echo "==> api logs after probe"
"${COMPOSE[@]}" logs --tail=60 api-blue 2>/dev/null \
  | rg -i 'guest|Traceback|Error|Exception|Diag|side-effect|POST.*bookings' \
  || "${COMPOSE[@]}" logs --tail=40 api-blue 2>/dev/null \
  || true
