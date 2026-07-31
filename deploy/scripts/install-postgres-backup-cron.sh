#!/usr/bin/env bash
# Install nightly local Postgres backup cron on the VPS (idempotent).
# Called from vm-deploy-all.sh. Safe when Postgres is remote — uses .env.prod.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deploy"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/.env.prod}"
SCRIPT="$DEPLOY_DIR/scripts/backup-postgres-local.sh"
CRON_MARKER="poreiago-postgres-backup"
BACKUP_DIR="${BACKUP_DIR:-/opt/poreiago/backups/postgres}"
LOG_FILE="${BACKUP_LOG:-/var/log/poreiago-postgres-backup.log}"

chmod +x "$SCRIPT" || true
mkdir -p "$BACKUP_DIR"

# Resolve DB host for host-cron (docker postgres published or remote).
PG_HOST="${POSTGRES_HOST:-}"
if [[ -z "$PG_HOST" && -f "$ENV_FILE" ]]; then
  # Prefer explicit POSTGRES_HOST; else try parsing DATABASE_URL host.
  if grep -q '^POSTGRES_HOST=.\+' "$ENV_FILE" 2>/dev/null; then
    PG_HOST="$(grep '^POSTGRES_HOST=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r')"
  fi
fi
PG_HOST="${PG_HOST:-127.0.0.1}"

CRON_LINE="0 2 * * * ENV_FILE=${ENV_FILE} POSTGRES_HOST=${PG_HOST} BACKUP_DIR=${BACKUP_DIR} bash ${SCRIPT} >> ${LOG_FILE} 2>&1"

if command -v crontab >/dev/null 2>&1; then
  existing="$(crontab -l 2>/dev/null || true)"
  filtered="$(printf '%s\n' "$existing" | grep -v "$CRON_MARKER" | grep -v "backup-postgres-local.sh" || true)"
  {
    printf '%s\n' "$filtered"
    echo "# ${CRON_MARKER}"
    echo "$CRON_LINE"
  } | crontab -
  echo "==> Installed nightly postgres backup cron (02:00 UTC) → $BACKUP_DIR"
else
  echo "WARN: crontab not available — skip backup schedule (run $SCRIPT manually)"
fi
