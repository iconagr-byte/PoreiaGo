"""Auto-provision VAPID keys when missing."""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import patch

from py_vapid import Vapid01

from travel_platform.notifications.web_push_service import (
    _vapid_private_key,
    _vapid_private_key_for_webpush,
    ensure_web_push_keys,
    web_push_configured,
)


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


def test_vapid_private_key_for_webpush_prefers_file_path(tmp_path: Path, monkeypatch):
    """pywebpush needs a path (or Vapid obj) — not PEM text from _vapid_private_key()."""
    monkeypatch.setenv("POREIAGO_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("WEB_PUSH_VAPID_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("WEB_PUSH_VAPID_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("WEB_PUSH_VAPID_PRIVATE_KEY_FILE", raising=False)
    assert ensure_web_push_keys() is True

    pem_content = _vapid_private_key()
    assert "BEGIN" in pem_content
    arg = _vapid_private_key_for_webpush()
    assert isinstance(arg, str)
    assert Path(arg).is_file()
    assert arg.endswith("vapid_private.pem")
    assert arg != pem_content


def test_vapid_private_key_for_webpush_inline_pem_loads_vapid(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("POREIAGO_DATA_DIR", str(tmp_path / "side"))
    monkeypatch.delenv("WEB_PUSH_VAPID_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("WEB_PUSH_VAPID_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("WEB_PUSH_VAPID_PRIVATE_KEY_FILE", raising=False)
    assert ensure_web_push_keys() is True
    private_pem = os.environ["WEB_PUSH_VAPID_PRIVATE_KEY"]

    monkeypatch.setenv("POREIAGO_DATA_DIR", str(tmp_path / "empty"))
    monkeypatch.setenv("WEB_PUSH_VAPID_PRIVATE_KEY", private_pem)
    monkeypatch.delenv("WEB_PUSH_VAPID_PRIVATE_KEY_FILE", raising=False)

    arg = _vapid_private_key_for_webpush()
    assert isinstance(arg, Vapid01)


def test_send_sync_passes_file_path_not_pem_body(tmp_path: Path, monkeypatch):
    """Regression: PEM body → Vapid.from_string → sent=0 on /api/admin/push/test."""
    from travel_platform.notifications import web_push_service as svc

    monkeypatch.setenv("POREIAGO_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("WEB_PUSH_VAPID_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("WEB_PUSH_VAPID_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("WEB_PUSH_VAPID_PRIVATE_KEY_FILE", raising=False)
    assert ensure_web_push_keys() is True
    expected_path = str(tmp_path / "vapid_private.pem")

    captured: dict = {}

    def _fake_webpush(**kwargs):
        captured.update(kwargs)
        return "ok"

    with patch("pywebpush.webpush", side_effect=_fake_webpush):
        result = svc._send_sync(
            {
                "endpoint": "https://push.example/v1/test",
                "keys": {"p256dh": "abc", "auth": "def"},
            },
            {"title": "t", "body": "b"},
        )

    assert result["sent"] is True
    assert captured["vapid_private_key"] == expected_path
    assert "BEGIN" not in str(captured["vapid_private_key"])
