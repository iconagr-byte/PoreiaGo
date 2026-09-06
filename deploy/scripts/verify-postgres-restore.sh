#!/usr/bin/env bash
# Verify the newest local Postgres dump can be listed / restored into a throwaway DB.
# Cron (weekly): 30 3 * * 0 /opt/poreiago/deploy/scripts/verify-postgres-restore.sh
set -euo pipefail

: "${BACKUP_DIR:=/opt/poreiago/backups/postgres}"
: "${POSTGRES_HOST:=127.0.0.1}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=app_user}"
: "${VERIFY_DB:=poreiago_restore_verify}"
ENV_FILE="${ENV_FILE:-/opt/poreiago/deploy/.env.prod}"

if [[ -f "$ENV_FILE" ]]; then
  POSTGRES_PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' || true)"
  POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' || echo "$POSTGRES_USER")"
fi
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}"

LATEST="$(ls -1t "$BACKUP_DIR"/*.dump.gz 2>/dev/null | head -1 || true)"
if [[ -z "$LATEST" ]]; then
  echo "[verify-restore] ERROR: no dumps in $BACKUP_DIR"
  exit 1
fi

echo "[verify-restore] Checking $LATEST"
TMP="$(mktemp /tmp/poreiago-restore-XXXXXX.dump)"
gunzip -c "$LATEST" > "$TMP"

export PGPASSWORD="$POSTGRES_PASSWORD"
echo "[verify-restore] pg_restore --list"
pg_restore -l "$TMP" >/dev/null

echo "[verify-restore] recreate throwaway DB $VERIFY_DB"
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${VERIFY_DB}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS ${VERIFY_DB};
CREATE DATABASE ${VERIFY_DB};
SQL

pg_restore \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$VERIFY_DB" \
  --no-owner \
  --no-acl \
  "$TMP" || true

psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$VERIFY_DB" -v ON_ERROR_STOP=1 -c "SELECT 1 AS ok;"

psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${VERIFY_DB};"
rm -f "$TMP"
echo "[verify-restore] OK — dump restorable"
