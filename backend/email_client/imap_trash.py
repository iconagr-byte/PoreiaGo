"""IMAP move-to-trash — keep server mailbox in sync with UI Κάδος."""

from __future__ import annotations

import imaplib
import logging
from typing import Any

from .constants import FOLDER_INBOX, FOLDER_SENT, FOLDER_SPAM, FOLDER_TRASH
from .imap_sync import (
    _list_mailboxes,
    _pick_special_mailbox,
    _resolve_folder_names,
)
from .imap_utf8 import connect_imap, format_imap_connect_error

logger = logging.getLogger(__name__)

_TRASH_FALLBACKS = (
    "INBOX.Trash",
    "Trash",
    "Deleted Messages",
    "Deleted Items",
    "INBOX.Deleted Messages",
)


def _resolve_trash_mailbox(client: imaplib.IMAP4, cfg: dict) -> str:
    preferred = (cfg.get("imap_folder_trash") or "Trash").strip() or "Trash"
    listed = _list_mailboxes(client)
    if not listed:
        return preferred
    return _pick_special_mailbox(
        listed,
        flag="\\Trash",
        preferred=preferred,
        fallbacks=_TRASH_FALLBACKS,
    )


def _source_imap_box(client: imaplib.IMAP4, cfg: dict, local_folder: str) -> str | None:
    if local_folder == FOLDER_TRASH:
        return None
    resolved = dict(_resolve_folder_names(client, cfg))
    # resolved maps imap_box -> local_folder; invert for lookup
    by_local = {local: box for box, local in resolved.items()}
    if local_folder in by_local:
        return by_local[local_folder]
    if local_folder == FOLDER_INBOX:
        return cfg.get("imap_mailbox") or "INBOX"
    if local_folder == FOLDER_SENT:
        return cfg.get("imap_folder_sent") or "Sent"
    if local_folder == FOLDER_SPAM:
        return cfg.get("imap_folder_spam") or "Spam"
    return cfg.get("imap_mailbox") or "INBOX"


def _message_id_candidates(message_id: str) -> list[str]:
    mid = (message_id or "").strip()
    if not mid:
        return []
    out = [mid]
    if mid.startswith("<") and mid.endswith(">"):
        bare = mid[1:-1].strip()
        if bare and bare not in out:
            out.append(bare)
    else:
        angled = f"<{mid}>"
        if angled not in out:
            out.append(angled)
    return out


def _search_by_message_id(client: imaplib.IMAP4, message_id: str) -> list[bytes]:
    found: list[bytes] = []
    for cand in _message_id_candidates(message_id):
        try:
            status, data = client.search(None, "HEADER", "Message-ID", cand)
        except Exception:
            continue
        if status != "OK" or not data or not data[0]:
            continue
        for num in data[0].split():
            if num and num not in found:
                found.append(num)
    return found


def _try_move(client: imaplib.IMAP4, msg_set: str, trash_box: str) -> bool:
    """Prefer IMAP MOVE (RFC 6851); fall back to COPY + \\Deleted + EXPUNGE."""
    try:
        typ, _ = client._simple_command("MOVE", msg_set, client._quote(trash_box))
        if typ == "OK":
            try:
                client._untagged_response(typ, _, "MOVE")
            except Exception:
                pass
            return True
    except Exception as exc:
        logger.debug("IMAP MOVE unavailable/failed: %s", exc)

    status, _ = client.copy(msg_set, trash_box)
    if status != "OK":
        return False
    client.store(msg_set, "+FLAGS", "(\\Deleted)")
    client.expunge()
    return True


def imap_move_message_to_trash(
    cfg: dict[str, Any],
    *,
    message_id: str,
    local_folder: str,
    imap_uid: str | None = None,
) -> dict[str, Any]:
    """Move one cached message to the server Trash folder.

    Returns ``{"ok": bool, "moved": bool, "error": str|None}``.
    ``moved=False`` with ``ok=True`` means the message was already gone from IMAP
    (still safe to keep local Trash).
    """
    if not cfg.get("host") or not cfg.get("user"):
        return {"ok": False, "moved": False, "error": "IMAP host/username missing"}
    if not (cfg.get("password") or "").strip():
        return {"ok": False, "moved": False, "error": "Λείπει ο κωδικός email"}

    mid = (message_id or "").strip()
    if not mid or mid.endswith("@local") or mid.startswith("draft-"):
        return {"ok": True, "moved": False, "error": None}

    try:
        client = connect_imap(cfg)
    except Exception as exc:
        return {"ok": False, "moved": False, "error": format_imap_connect_error(exc)}

    try:
        source = _source_imap_box(client, cfg, local_folder or FOLDER_INBOX)
        if not source:
            return {"ok": True, "moved": False, "error": None}

        trash_box = _resolve_trash_mailbox(client, cfg)
        status, _ = client.select(source, readonly=False)
        if status != "OK":
            return {"ok": False, "moved": False, "error": f"Cannot select {source}"}

        nums = _search_by_message_id(client, mid)
        if not nums and imap_uid and str(imap_uid).isdigit():
            # Last resort: stored value may be a sequence number from last sync.
            nums = [str(imap_uid).encode("ascii")]

        if not nums:
            # Already removed from this folder on the server — local Trash is enough.
            return {"ok": True, "moved": False, "error": None}

        msg_set = b",".join(nums).decode("ascii")
        if trash_box == source:
            client.store(msg_set, "+FLAGS", "(\\Deleted)")
            client.expunge()
            return {"ok": True, "moved": True, "error": None}

        if not _try_move(client, msg_set, trash_box):
            return {
                "ok": False,
                "moved": False,
                "error": f"IMAP copy/move to {trash_box} failed",
            }
        return {"ok": True, "moved": True, "error": None}
    except Exception as exc:
        logger.warning("IMAP trash failed: %s", exc)
        return {"ok": False, "moved": False, "error": str(exc)}
    finally:
        try:
            client.logout()
        except Exception:
            pass
