"""Transactional notifications from SaaS core (email/SMS stubs)."""

from __future__ import annotations

import logging

from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def send_gdpr_erasure_emails(
    *,
    tenant_legal_name: str,
    subject_email: str,
    actor_email: str | None,
    bookings_anonymized: int,
    user_anonymized: bool,
) -> dict[str, str | None]:
    """Notify data subject + admin after GDPR erasure. Returns delivery refs."""
    from travel_platform.notifications.dispatcher import send_email

    settings = get_settings()
    if not settings.gdpr_erasure_email_enabled:
        return {"subject": None, "admin": None}

    ts = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime(
        "%d/%m/%Y %H:%M UTC",
    )
    org = tenant_legal_name or "Project Travel"

    subject_html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#1e293b">Επιβεβαίωση διαγραφής δεδομένων</h2>
      <p>Αγαπητέ/ή πελάτη,</p>
      <p>
        Σύμφωνα με το αίτημά σας (GDPR άρθρο 17), η <strong>{org}</strong>
        ολοκλήρωσε την ανωνυμοποίηση των προσωπικών σας δεδομένων από τα συστήματά μας.
      </p>
      <ul>
        <li>Κρατήσεις που επηρεάστηκαν: {bookings_anonymized}</li>
        <li>Λογαριασμός χρήστη: {"ναι" if user_anonymized else "όχι"}</li>
      </ul>
      <p style="color:#64748b;font-size:13px">Ημερομηνία: {ts}</p>
      <p style="color:#64748b;font-size:13px">
        Αυτό το email αποστέλλεται μία φορά πριν την ανωνυμοποίηση της διεύθυνσής σας στα αρχεία μας.
      </p>
    </div>
    """

    admin_html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#1e293b">GDPR Erasure — εσωτερική επιβεβαίωση</h2>
      <p>Ολοκληρώθηκε διαγραφή/ανωνυμοποίηση για:</p>
      <p><strong>{subject_email}</strong></p>
      <ul>
        <li>Tenant: {org}</li>
        <li>Κρατήσεις: {bookings_anonymized}</li>
        <li>User account: {"ναι" if user_anonymized else "όχι"}</li>
      </ul>
      <p style="color:#64748b;font-size:13px">{ts}</p>
    </div>
    """

    refs: dict[str, str | None] = {"subject": None, "admin": None}
    try:
        refs["subject"] = await send_email(
            subject_email,
            f"[{org}] Επιβεβαίωση διαγραφής δεδομένων (GDPR)",
            subject_html,
        )
    except Exception as exc:
        logger.warning("GDPR subject email failed: %s", exc)

    if actor_email and actor_email.lower() != subject_email.lower():
        try:
            refs["admin"] = await send_email(
                actor_email,
                f"[GDPR] Erasure completed — {subject_email}",
                admin_html,
            )
        except Exception as exc:
            logger.warning("GDPR admin email failed: %s", exc)

    return refs
