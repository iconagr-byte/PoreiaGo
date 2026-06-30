#!/usr/bin/env bash
# Nightly logical backup — cron: 0 2 * * * /opt/aerostride/deploy/scripts/backup-postgres-to-s3.sh
set -euo pipefail

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_USER:?}"
: "${POSTGRES_DB:?}"
: "${S3_BUCKET:?}"
: "${AWS_DEFAULT_REGION:=eu-central-1}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="/tmp/aerostride-${POSTGRES_DB}-${STAMP}.dump"

echo "[backup] Starting pg_dump ${POSTGRES_DB}..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST}" \
  -U "${POSTGRES_USER}" \
  -Fc \
  --no-owner \
  --no-acl \
  "${POSTGRES_DB}" > "${FILE}"

gzip -f "${FILE}"
ARCHIVE="${FILE}.gz"

echo "[backup] Uploading to s3://${S3_BUCKET}/postgres/..."
aws s3 cp "${ARCHIVE}" "s3://${S3_BUCKET}/postgres/${POSTGRES_DB}/${STAMP}.dump.gz" \
  --storage-class STANDARD_IA

rm -f "${ARCHIVE}"
echo "[backup] Done ${STAMP}"
