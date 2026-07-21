"""Driver photo upload — admin multipart → public URL."""

from __future__ import annotations

import io
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient


class DriverPhotoUploadTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import tempfile

        cls._tmpdir = tempfile.TemporaryDirectory()
        cls.data_dir = Path(cls._tmpdir.name)
        photo_dir = cls.data_dir / "uploads" / "driver_photos"

        # Patch upload dir used by admin_platform before importing routes usage
        import api.admin_platform as admin_mod
        import api.site_appearance_router as site_mod

        cls.admin_mod = admin_mod
        cls.site_mod = site_mod
        cls._orig_photo_dir = admin_mod._DRIVER_PHOTO_DIR
        admin_mod._DRIVER_PHOTO_DIR = photo_dir

        cls.app = FastAPI()
        cls.app.include_router(admin_mod.router)
        cls.app.include_router(site_mod.router)
        cls.client = TestClient(cls.app)
        cls.photo_dir = photo_dir

    @classmethod
    def tearDownClass(cls):
        cls.admin_mod._DRIVER_PHOTO_DIR = cls._orig_photo_dir
        cls._tmpdir.cleanup()

    def test_upload_and_public_fetch(self):
        png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
            b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        with patch.dict("os.environ", {"POREIAGO_DATA_DIR": str(self.data_dir)}):
            res = self.client.post(
                "/api/admin/platform/drivers/photo-upload",
                files={"file": ("driver.png", io.BytesIO(png), "image/png")},
            )
            self.assertEqual(res.status_code, 200, res.text)
            body = res.json()
            self.assertTrue(body["ok"])
            self.assertTrue(body["url"].startswith("/api/site/driver-photos/"))
            filename = body["filename"]
            self.assertTrue((self.photo_dir / filename).is_file())

            get = self.client.get(body["url"])
            self.assertEqual(get.status_code, 200)
            self.assertTrue(get.headers.get("content-type", "").startswith("image/"))

    def test_rejects_non_image(self):
        res = self.client.post(
            "/api/admin/platform/drivers/photo-upload",
            files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        self.assertEqual(res.status_code, 400)


if __name__ == "__main__":
    unittest.main()
