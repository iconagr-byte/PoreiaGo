#!/usr/bin/env bash
# OLYMPUS production pre-deploy — run on the server before/after compose up.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/deploy/.env.olympus.prod}"
API_BASE="${API_BASE:-}"

cd "$REPO_ROOT/backend"

ARGS=(python -m scripts.predeploy_check --strict)
if [[ -f "$ENV_FILE" ]]; then
  ARGS+=(--env-file "$ENV_FILE")
else
  echo "WARN: $ENV_FILE not found — using current shell environment"
fi

if [[ "${RUN_MIGRATE:-1}" == "1" ]]; then
  ARGS+=(--migrate)
fi

if [[ -n "$API_BASE" ]]; then
  ARGS+=(--api-base "$API_BASE")
fi

echo "Running: ${ARGS[*]}"
"${ARGS[@]}"
