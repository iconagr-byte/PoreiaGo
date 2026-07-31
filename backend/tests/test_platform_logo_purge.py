"""Platform site appearance must not keep Achillion Travel as PoreiaGo logo."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock


class PlatformLogoPurgeTests(unittest.TestCase):
    def test_purge_clears_logo_file_and_url(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            upload_dir = data_dir / "uploads" / "site"
            upload_dir.mkdir(parents=True)
            logo_path = upload_dir / "logo.jpg"
            logo_path.write_bytes(b"fake-achillion-logo")
            appearance_file = data_dir / "site_appearance.json"
            appearance_file.write_text(
                json.dumps(
                    {
                        "logo_url": "/api/site/assets/logo?v=1",
                        "hero_image_url": "/images/hero-bus-achillio.png",
                    }
                ),
                encoding="utf-8",
            )
            marker = data_dir / ".purged_achillion_platform_logo_v1"

            import api.site_appearance_router as mod

            with (
                mock.patch.object(mod, "_data_root", return_value=data_dir),
                mock.patch.object(mod, "_appearance_file", return_value=appearance_file),
                mock.patch.object(mod, "_upload_dir", return_value=upload_dir),
                mock.patch.object(mod, "_purge_achillion_marker", return_value=marker),
            ):
                self.assertTrue(mod.purge_mistaken_platform_logo())
                self.assertFalse(logo_path.exists())
                self.assertTrue(marker.exists())
                saved = json.loads(appearance_file.read_text(encoding="utf-8"))
                self.assertEqual(saved.get("logo_url"), "")
                # Second call is a no-op once the marker exists.
                self.assertFalse(mod.purge_mistaken_platform_logo())

    def test_platform_host_does_not_autofill_logo(self):
        with tempfile.TemporaryDirectory() as tmp:
            data_dir = Path(tmp)
            upload_dir = data_dir / "uploads" / "site"
            upload_dir.mkdir(parents=True)
            (upload_dir / "logo.jpg").write_bytes(b"should-not-autofill")
            appearance_file = data_dir / "site_appearance.json"
            appearance_file.write_text(json.dumps({"logo_url": ""}), encoding="utf-8")
            marker = data_dir / ".purged_achillion_platform_logo_v1"
            marker.write_text("already", encoding="utf-8")

            import api.site_appearance_router as mod

            with (
                mock.patch.object(mod, "_data_root", return_value=data_dir),
                mock.patch.object(mod, "_appearance_file", return_value=appearance_file),
                mock.patch.object(mod, "_upload_dir", return_value=upload_dir),
                mock.patch.object(mod, "_purge_achillion_marker", return_value=marker),
            ):
                data = mod._read_appearance()
                self.assertEqual(data.get("logo_url"), "")
                self.assertTrue(mod._is_platform_host("www.poreiago.com"))
                self.assertTrue(mod._is_platform_host(None))
                self.assertFalse(mod._is_platform_host("www.achilliontravel.gr"))

    def test_scrub_achillio_from_platform_appearance(self):
        import api.site_appearance_router as mod

        cleaned = mod._scrub_achillio_from_platform_appearance(
            {
                "footer_brand_name": "Achillio Travel",
                "logo_url": "/images/achillio-logo.png",
                "hero_image_url": "/images/hero-bus-achillio.png",
                "hero_title": "Keep me",
            }
        )
        self.assertEqual(cleaned["footer_brand_name"], "PoreiaGo")
        self.assertEqual(cleaned["logo_url"], "")
        self.assertEqual(cleaned["hero_image_url"], "")
        self.assertEqual(cleaned["hero_title"], "Keep me")


if __name__ == "__main__":
    unittest.main()
