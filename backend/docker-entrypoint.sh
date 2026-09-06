#!/bin/sh
set -e
DATA_DIR="${POREIAGO_DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"
# Ensure driver account store is writable even when a fresh volume mounts as root.
chmod -R a+rwX "$DATA_DIR" 2>/dev/null || true

# Apply pending Alembic migrations before API starts (creates trip_coordinates, etc.).
# Skip for Celery workers / one-off commands unless RUN_MIGRATIONS=1 explicitly.
run_migrations() {
  if [ "${RUN_MIGRATIONS:-auto}" = "0" ]; then
    return 0
  fi
  case " $* " in
    *" uvicorn "*|*"main:app"*|*"wallet_main:app"*)
      ;;
    *)
      if [ "${RUN_MIGRATIONS:-auto}" != "1" ]; then
        return 0
      fi
      ;;
  esac
  echo "==> alembic upgrade head"
  if ! alembic upgrade head; then
    echo "WARNING: alembic upgrade head failed — API will still start; GPS schema may be incomplete"
  fi
}

run_migrations "$@"
exec "$@"
