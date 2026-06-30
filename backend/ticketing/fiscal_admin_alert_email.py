"""Admin email alerts for fiscal pipeline issues (failed / stuck / gaps)."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from ticketing.email_dispatch import send_email
from ticketing.payment_confirmation_email import _admin_recipient, _wrap_html

logger = logging.getLogger(__name__)

_STATE_FILE = Path(__file__).resolve().parents[1] / "data" / "fiscal_alert_state.json"
AlertKind = Literal["digest", "immediate"]


def _alerts_enabled() -> bool:
    from app.services.fiscal_alert_service import fiscal_alert_settings

    if not fiscal_alert_settings()["enabled"]:
        return False
    try:
        from travel_platform.settings.payment_settings_store import read_payment_settings

        security = read_payment_settings().get("security") or {}
        if security.get("notify_admin_on_fiscal_issues") is False:
            return False
        if security.get("notify_admin_on_payment") is False:
            return False
    except Exception:
        pass
    return True


def _load_state() -> dict[str, str]:
    if not _STATE_FILE.is_file():
        return {}
    try:
        data = json.loads(_STATE_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _save_state(state: dict[str, str]) -> None:
    _STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    _STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")


def _cooldown_allows(kind: AlertKind) -> bool:
    from app.services.fiscal_alert_service import fiscal_alert_settings

    state = _load_state()
    key = f"last_{kind}_at"
    last_raw = state.get(key)
    if not last_raw:
        return True
    try:
        last = datetime.fromisoformat(last_raw.replace("Z", "+00:00"))
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
    except ValueError:
        return True

    now = datetime.now(timezone.utc)
    if kind == "digest":
        return (now - last).total_seconds() >= 20 * 3600
    cooldown_min = int(fiscal_alert_settings()["immediate_cooldown_minutes"])
    return (now - last).total_seconds() >= cooldown_min * 60


def _mark_sent(kind: AlertKind) -> None:
    state = _load_state()
    state[f"last_{kind}_at"] = datetime.now(timezone.utc).isoformat()
    _save_state(state)


def _tenant_rows_html(tenants: list[dict[str, Any]]) -> str:
    if not tenants:
        return "<p>Δεν εντοπίστηκαν ανοιχτά θέματα ανά tenant.</p>"
    rows = []
    for t in tenants:
        rows.append(
            "<tr>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;'><strong>{t.get('slug', '—')}</strong>"
            f"<br><span style='font-size:12px;color:#64748b;'>{t.get('name', '')}</span></td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;'>{t.get('health', '—')}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;'>{t.get('failed', 0)}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;'>{t.get('open', 0)}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;'>{t.get('stuck_candidates', 0)}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e2e8f0;'>{t.get('reconciliation_gaps', 0)}</td>"
            "</tr>",
        )
    return (
        "<table width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;font-size:13px;'>"
        "<thead><tr style='background:#f1f5f9;text-align:left;'>"
        "<th style='padding:8px;'>Tenant</th>"
        "<th style='padding:8px;'>Health</th>"
        "<th style='padding:8px;'>Failed</th>"
        "<th style='padding:8px;'>Open</th>"
        "<th style='padding:8px;'>Stuck</th>"
        "<th style='padding:8px;'>Recon gaps</th>"
        "</tr></thead><tbody>"
        + "".join(rows)
        + "</tbody></table>"
    )


def build_fiscal_alert_html(snapshot: dict[str, Any], *, kind: AlertKind) -> str:
    totals = snapshot.get("totals") or {}
    title = "Ημερήσιο digest fiscal" if kind == "digest" else "Άμεση ειδοποίηση fiscal"
    intro = (
        "Σύνοψη ανοιχτών θεμάτων στο fiscal pipeline (myDATA / αποδείξεις)."
        if kind == "digest"
        else "Εντοπίστηκε πρόβλημα στο fiscal pipeline — απαιτείται έλεγχος στο admin."
    )
    body = f"""
      <p>{intro}</p>
      <ul style="padding-left:18px;line-height:1.8;">
        <li><strong>Αποτυχίες:</strong> {totals.get('failed', 0)}</li>
        <li><strong>Ανοιχτά (pending/queued/failed):</strong> {totals.get('open', 0)}</li>
        <li><strong>Stuck candidates:</strong> {totals.get('stuck_candidates', 0)}</li>
        <li><strong>Reconciliation gaps:</strong> {totals.get('reconciliation_gaps', 0)}</li>
      </ul>
      <p style="margin-top:16px;font-weight:600;">Ανά tenant</p>
      {_tenant_rows_html(snapshot.get('tenants') or [])}
      <p style="margin-top:20px;font-size:12px;color:#64748b;">
        Admin → Ρυθμίσεις → Πληρωμές → Φορολογικές εκκολήσεις / Reconciliation.
        Runbook: <code>docs/FISCAL-PIPELINE-RUNBOOK.md</code>
      </p>
    """
    return _wrap_html(title, body)


async def send_fiscal_pipeline_alert(
    snapshot: dict[str, Any],
    *,
    kind: AlertKind = "digest",
    force: bool = False,
) -> dict[str, Any]:
    if not snapshot.get("has_issues"):
        return {"sent": False, "reason": "no_issues"}
    if not _alerts_enabled():
        return {"sent": False, "reason": "disabled"}
    if not force and not _cooldown_allows(kind):
        return {"sent": False, "reason": "cooldown"}

    admin_to = _admin_recipient()
    if not admin_to:
        return {"sent": False, "reason": "no_admin_email"}

    subject_prefix = "[Fiscal digest]" if kind == "digest" else "[Fiscal alert]"
    totals = snapshot.get("totals") or {}
    subject = (
        f"{subject_prefix} {totals.get('failed', 0)} failed · "
        f"{totals.get('stuck_candidates', 0)} stuck · "
        f"{totals.get('reconciliation_gaps', 0)} gaps"
    )
    html = build_fiscal_alert_html(snapshot, kind=kind)

    try:
        ref = await send_email(admin_to, subject, html)
        _mark_sent(kind)
        return {"sent": True, "to": admin_to, "ref": ref, "kind": kind}
    except Exception as exc:
        logger.exception("Fiscal admin alert email failed")
        return {"sent": False, "reason": str(exc)}


def schedule_fiscal_immediate_alert() -> None:
    """Fire-and-forget Celery alert after a fiscal failure (cooldown applies)."""
    if not _alerts_enabled():
        return
    try:
        from workers.tasks import send_fiscal_pipeline_alert_task

        send_fiscal_pipeline_alert_task.delay("immediate")
    except Exception:
        logger.debug("Could not schedule fiscal immediate alert", exc_info=True)
