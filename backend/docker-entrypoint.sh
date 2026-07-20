#!/bin/sh
set -e
DATA_DIR="${POREIAGO_DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"
# Ensure driver account store is writable even when a fresh volume mounts as root.
chmod -R a+rwX "$DATA_DIR" 2>/dev/null || true
exec "$@"
