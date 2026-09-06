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


def test_ensure_prefers_data_dir_over_mismatched_env_public(tmp_path: Path, monkeypatch):
    """Host env may set PUBLIC while PRIVATE_FILE is missing or a different pair."""
    monkeypatch.setenv("POREIAGO_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("WEB_PUSH_VAPID_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("WEB_PUSH_VAPID_PRIVATE_KEY_FILE", raising=False)

    assert ensure_web_push_keys() is True
    durable_pub = (tmp_path / "vapid_public.key").read_text(encoding="utf-8").strip()

    monkeypatch.setenv("WEB_PUSH_VAPID_PUBLIC_KEY", "stale-public-from-host-env")
    monkeypatch.setenv("WEB_PUSH_VAPID_PRIVATE_KEY_FILE", str(tmp_path / "missing.pem"))

    assert ensure_web_push_keys() is True
    assert os.getenv("WEB_PUSH_VAPID_PUBLIC_KEY") == durable_pub
    assert web_push_configured() is True


def test_ensure_uses_inline_private_when_file_missing(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("POREIAGO_DATA_DIR", str(tmp_path / "empty"))
    monkeypatch.delenv("WEB_PUSH_VAPID_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("WEB_PUSH_VAPID_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("WEB_PUSH_VAPID_PRIVATE_KEY_FILE", raising=False)

    # Generate once into a side dir, then feed only via env (simulates .env.prod inline PEM).
    side = tmp_path / "side"
    monkeypatch.setenv("POREIAGO_DATA_DIR", str(side))
    assert ensure_web_push_keys() is True
    public_key = os.environ["WEB_PUSH_VAPID_PUBLIC_KEY"]
    private_pem = os.environ["WEB_PUSH_VAPID_PRIVATE_KEY"]

    target = tmp_path / "target"
    monkeypatch.setenv("POREIAGO_DATA_DIR", str(target))
    monkeypatch.setenv("WEB_PUSH_VAPID_PUBLIC_KEY", public_key)
    monkeypatch.setenv("WEB_PUSH_VAPID_PRIVATE_KEY", private_pem.replace("\n", "\\n"))
    monkeypatch.setenv("WEB_PUSH_VAPID_PRIVATE_KEY_FILE", str(target / "vapid_private.pem"))

    assert web_push_configured() is True  # inline PEM works even if file missing
    assert ensure_web_push_keys() is True
    assert (target / "vapid_private.pem").is_file()
    assert (target / "vapid_public.key").read_text(encoding="utf-8").strip() == public_key
