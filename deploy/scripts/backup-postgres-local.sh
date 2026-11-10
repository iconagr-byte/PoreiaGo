#!/usr/bin/env bash
# Local logical Postgres backup (no S3 required).
# Cron: 0 2 * * * /opt/poreiago/deploy/scripts/backup-postgres-local.sh
# Or compose profile: docker compose --profile backup up -d postgres-backup
set -euo pipefail

: "${POSTGRES_HOST:=127.0.0.1}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=app_user}"
: "${POSTGRES_DB:=aerostride}"
: "${BACKUP_DIR:=/opt/poreiago/backups/postgres}"
: "${RETENTION_DAYS:=14}"

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
  # Prefer loading from deploy/.env.prod when run on the VPS host.
  ENV_FILE="${ENV_FILE:-/opt/poreiago/deploy/.env.prod}"
  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a
    # Only export keys we need (avoid sourcing arbitrary shell).
    POSTGRES_PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r')"
    POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' || true)"
    POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r' || true)"
    POSTGRES_USER="${POSTGRES_USER:-app_user}"
    POSTGRES_DB="${POSTGRES_DB:-aerostride}"
    set +a
  fi
fi
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="${BACKUP_DIR}/${POSTGRES_DB}-${STAMP}.dump"

echo "[backup] pg_dump ${POSTGRES_DB} → ${FILE}.gz"
export PGPASSWORD="$POSTGRES_PASSWORD"
pg_dump \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -Fc \
  --no-owner \
  --no-acl \
  "$POSTGRES_DB" > "$FILE"

gzip -f "$FILE"
ARCHIVE="${FILE}.gz"

# Optional S3 upload when configured
if [[ -n "${BACKUP_S3_BUCKET:-${S3_BUCKET:-}}" ]]; then
  BUCKET="${BACKUP_S3_BUCKET:-$S3_BUCKET}"
  REGION="${AWS_DEFAULT_REGION:-eu-central-1}"
  if command -v aws >/dev/null 2>&1; then
    echo "[backup] Uploading to s3://${BUCKET}/postgres/..."
    aws s3 cp "$ARCHIVE" "s3://${BUCKET}/postgres/${POSTGRES_DB}/${STAMP}.dump.gz" \
      --region "$REGION" \
      --storage-class STANDARD_IA || echo "[backup] S3 upload failed (local copy kept)"
  fi
fi

# Retention
find "$BACKUP_DIR" -type f -name '*.dump.gz' -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true
echo "[backup] Done ${STAMP}"
