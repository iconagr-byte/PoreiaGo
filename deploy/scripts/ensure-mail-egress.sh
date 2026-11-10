#!/usr/bin/env bash
# Contabo / VPS: ensure this host may open OUTBOUND IMAP/SMTP (office mailbox sync).
# Ports: 993 (IMAP SSL), 465 (SMTPS), 587 (SMTP STARTTLS fallback).
# Does not change inbound firewall. Safe to re-run on every deploy.
set -euo pipefail

EGRESS_IP_HINT="${EGRESS_IP_HINT:-169.58.199.186}"
MAIL_HOST="${MAIL_HOST:-mail.achilliotravel.com}"
PORTS=(993 465 587)

echo "==> Mail egress ensure (outbound ${PORTS[*]} → ${MAIL_HOST})"
echo "  expected public IP: ${EGRESS_IP_HINT}"

PUBLIC_IP="$(curl -4 -sS --max-time 8 https://api.ipify.org 2>/dev/null || curl -4 -sS --max-time 8 https://ifconfig.me 2>/dev/null || true)"
echo "  current egress IP: ${PUBLIC_IP:-<unknown>}"
if [[ -n "$PUBLIC_IP" && "$PUBLIC_IP" != "$EGRESS_IP_HINT" ]]; then
  echo "  WARN: egress IP differs from ${EGRESS_IP_HINT} — update APP_MAIL_EGRESS_IP / whitelist text if permanent"
fi

# --- Host firewall: allow OUTBOUND mail ports if UFW is active ---
if command -v ufw >/dev/null 2>&1; then
  ufw_status="$(ufw status 2>/dev/null | head -1 || true)"
  echo "  ufw: ${ufw_status:-unavailable}"
  if echo "$ufw_status" | grep -qi 'Status: active'; then
    # Default UFW policy is usually allow outgoing; pin explicit allows anyway.
    for p in "${PORTS[@]}"; do
      ufw allow out "${p}/tcp" comment "poreiago-mail-egress" >/dev/null 2>&1 \
        || ufw allow out "${p}/tcp" >/dev/null 2>&1 \
        || true
      echo "  ufw allow out ${p}/tcp"
    done
  else
    echo "  ufw inactive — host OUTPUT not restricted by ufw"
  fi
else
  echo "  ufw not installed"
fi

# iptables OUTPUT policy (informational)
if command -v iptables >/dev/null 2>&1; then
  out_pol="$(iptables -L OUTPUT -n 2>/dev/null | head -1 || true)"
  echo "  iptables OUTPUT: ${out_pol:-<n/a>}"
fi

# --- TCP probe from host ---
host_ok=1
for p in 993 465; do
  echo "=== host TCP ${MAIL_HOST}:${p} ==="
  if command -v nc >/dev/null 2>&1; then
    if nc -z -w 8 "$MAIL_HOST" "$p"; then
      echo "  OK nc :${p}"
    else
      echo "  FAIL nc :${p}"
      host_ok=0
    fi
  elif timeout 8 bash -c "echo >/dev/tcp/${MAIL_HOST}/${p}" 2>/dev/null; then
    echo "  OK bash /dev/tcp :${p}"
  else
    echo "  FAIL connect :${p}"
    host_ok=0
  fi
done

# --- Same probe from api-blue (app egress path) ---
API_CID="$(docker ps --filter name=api-blue --format '{{.ID}}' 2>/dev/null | head -1 || true)"
if [[ -z "$API_CID" ]]; then
  API_CID="$(docker ps --filter publish=8004 --format '{{.ID}}' 2>/dev/null | head -1 || true)"
fi
api_ok=1
if [[ -n "$API_CID" ]]; then
  echo "=== api-container TCP ${MAIL_HOST}:993,465 ==="
  if docker exec "$API_CID" python - <<PY
import socket, sys
host = "${MAIL_HOST}"
ok = True
for port in (993, 465):
    s = socket.socket()
    s.settimeout(8)
    try:
        s.connect((host, port))
        print(f"  OK api-container {host}:{port}")
    except Exception as e:
        print(f"  FAIL api-container {host}:{port} -> {e}")
        ok = False
    finally:
        s.close()
sys.exit(0 if ok else 1)
PY
  then
    api_ok=1
  else
    api_ok=0
  fi
else
  echo "  WARN: no api-blue container — skip container probe"
  api_ok=1
fi

echo "=== mail egress summary ==="
echo "  host_tcp_ok=${host_ok} api_tcp_ok=${api_ok} egress_ip=${PUBLIC_IP:-unknown}"
if [[ "$host_ok" -eq 1 && "$api_ok" -eq 1 ]]; then
  echo "  RESULT=outbound_ok — Contabo can open 993/465 to ${MAIL_HOST}"
  echo "  If UI still returns 535, hosting must whitelist inbound AUTH from ${PUBLIC_IP:-$EGRESS_IP_HINT}"
  exit 0
fi
echo "  RESULT=outbound_blocked — check Contabo panel firewall / provider OUTPUT rules for 993/465/587"
exit 1
