#!/usr/bin/env bash
# Run on Contabo VPS: can this host reach customer mail IMAP/SMTP?
set -euo pipefail

HOST="${MAIL_HOST:-mail.achilliotravel.com}"
IMAP_PORT="${IMAP_PORT:-993}"
SMTP_PORT="${SMTP_PORT:-465}"

echo "=== egress IP (what Intechs must whitelist) ==="
curl -4 -sS --max-time 8 https://api.ipify.org || curl -4 -sS --max-time 8 https://ifconfig.me || true
echo
echo "=== DNS $HOST ==="
getent ahostsv4 "$HOST" 2>/dev/null | head -5 || dig +short "$HOST" A || true

probe() {
  local port="$1"
  echo "=== TCP $HOST:$port ==="
  if command -v nc >/dev/null 2>&1; then
    if nc -z -w 8 "$HOST" "$port"; then
      echo "OK nc :$port"
    else
      echo "FAIL nc :$port"
      return 1
    fi
  else
    if timeout 8 bash -c "echo >/dev/tcp/$HOST/$port"; then
      echo "OK bash /dev/tcp :$port"
    else
      echo "FAIL bash /dev/tcp :$port"
      return 1
    fi
  fi
}

imap_ok=0
smtp_ok=0
probe "$IMAP_PORT" && imap_ok=1 || true
probe "$SMTP_PORT" && smtp_ok=1 || true

echo "=== docker api egress (same as app) ==="
API_CID="$(docker ps --filter name=api-blue --format '{{.ID}}' | head -1 || true)"
if [[ -z "$API_CID" ]]; then
  API_CID="$(docker ps --filter publish=8004 --format '{{.ID}}' | head -1 || true)"
fi
if [[ -n "$API_CID" ]]; then
  docker exec "$API_CID" python - <<PY || true
import socket, sys
host = "${HOST}"
for port in (${IMAP_PORT}, ${SMTP_PORT}):
    s = socket.socket()
    s.settimeout(8)
    try:
        s.connect((host, port))
        print(f"OK api-container {host}:{port}")
    except Exception as e:
        print(f"FAIL api-container {host}:{port} -> {e}")
        sys.exitcode = 1
    finally:
        s.close()
PY
else
  echo "WARN: no api container found"
fi

echo "=== summary ==="
echo "imap_${IMAP_PORT}=$imap_ok smtp_${SMTP_PORT}=$smtp_ok"
if [[ "$imap_ok" -eq 1 && "$smtp_ok" -eq 1 ]]; then
  echo "RESULT=reachable — whitelist OK; if UI still fails, check password/auth"
  exit 0
fi
echo "RESULT=blocked — Intechs CSF/firewall still blocking 169.58.199.186 on 993/465"
echo "Ask Intechs to confirm CSF allow / smtpmail restrict / remote IMAP for this IP."
exit 1
