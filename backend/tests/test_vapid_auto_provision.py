"""Auto-provision VAPID keys when missing."""

from __future__ import annotations

import os
from pathlib import Path

from travel_platform.notifications.web_push_service import ensure_web_push_keys, web_push_configured


def test_ensure_web_push_keys_generates_into_data_dir(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("WEB_PUSH_VAPID_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("WEB_PUSH_VAPID_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("WEB_PUSH_VAPID_PRIVATE_KEY_FILE", raising=False)
    monkeypatch.setenv("POREIAGO_DATA_DIR", str(tmp_path))

    assert web_push_configured() is False
    assert ensure_web_push_keys() is True
    assert web_push_configured() is True
    assert (tmp_path / "vapid_public.key").is_file()
    assert (tmp_path / "vapid_private.pem").is_file()
    assert os.getenv("WEB_PUSH_VAPID_PUBLIC_KEY")
    # Second call is idempotent / loads existing files.
    pub = os.getenv("WEB_PUSH_VAPID_PUBLIC_KEY")
    assert ensure_web_push_keys() is True
    assert os.getenv("WEB_PUSH_VAPID_PUBLIC_KEY") == pub
