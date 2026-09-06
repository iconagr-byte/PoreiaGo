"""Tenant office logo/hero upload stores short URLs, not data URLs."""

from __future__ import annotations

import io
import tempfile
import unittest
from pathlib import Path
from unittest import mock
from uuid import uuid4

from PIL import Image


class TenantOfficeAssetServiceTests(unittest.TestCase):
    def test_save_logo_writes_stable_file_and_public_url(self):
        from app.services import tenant_office_asset_service as mod

        tid = uuid4()
        buf = io.BytesIO()
        Image.new("RGB", (400, 200), color=(20, 80, 160)).save(buf, format="JPEG")
        raw = buf.getvalue()

        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.object(mod, "poreiago_data_dir", return_value=Path(tmp)):
                saved = mod.save_office_asset(tid, "logo", content=raw, filename="mark.jpg")
                path = mod.resolve_office_asset_path(tid, "logo", saved["filename"])
                self.assertIsNotNone(path)
                self.assertTrue(path.is_file())
                self.assertIsNone(mod.resolve_office_asset_path(tid, "logo", "../etc/passwd"))

        self.assertTrue(saved["ok"])
        self.assertTrue(saved["url"].startswith(f"/api/site/office-assets/{tid}/logo/"))
        self.assertTrue(saved["filename"].startswith("logo."))
        self.assertGreater(saved["bytes"], 100)

    def test_reject_empty_and_invalid_kind(self):
        from app.services import tenant_office_asset_service as mod

        tid = uuid4()
        with self.assertRaises(ValueError):
            mod.save_office_asset(tid, "banner", content=b"abc")
        with self.assertRaises(ValueError):
            mod.save_office_asset(tid, "logo", content=b"")


if __name__ == "__main__":
    unittest.main()
