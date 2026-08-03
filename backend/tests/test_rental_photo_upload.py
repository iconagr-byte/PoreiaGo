"""Image optimize + rental photo upload acceptance."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class ImageOptimizeTests(unittest.TestCase):
    def test_sniff_jpeg_png(self) -> None:
        from travel_platform.media.image_optimize import looks_like_image, sniff_image_ext

        jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 20
        png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
        self.assertEqual(sniff_image_ext(jpeg), ".jpg")
        self.assertEqual(sniff_image_ext(png), ".png")
        self.assertTrue(looks_like_image(jpeg, content_type="", filename="x.bin"))
        self.assertTrue(looks_like_image(b"not-an-image", content_type="image/jpeg"))
        self.assertFalse(looks_like_image(b"hello", content_type="text/plain", filename="a.txt"))

    def test_optimize_never_blocks_valid_bytes_as_bin_only(self) -> None:
        from travel_platform.media.image_optimize import optimize_driver_photo

        # Minimal JPEG SOI — even without Pillow decode, passthrough should not be .bin.
        jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 64
        out = optimize_driver_photo(jpeg, max_side=200)
        self.assertNotEqual(out.ext, ".bin")
        self.assertTrue(len(out.content) > 0)


class RentalPhotoUploadContractTests(unittest.TestCase):
    def test_upload_accepts_large_phone_photos(self) -> None:
        router = (ROOT / "backend" / "api" / "fleet_rental_router.py").read_text(encoding="utf-8")
        self.assertIn("_MAX_PHOTO_BYTES = 12 * 1024 * 1024", router)
        self.assertIn("looks_like_image", router)
        self.assertIn("HEIC", router)

    def test_frontend_formdata_avoids_json_content_type(self) -> None:
        api = (ROOT / "src" / "services" / "fleetRentalApi.js").read_text(encoding="utf-8")
        self.assertIn("adminBearerHeaders", api)
        self.assertIn("adminFetch", api)
        # The upload helper must not force application/json on FormData.
        upload_idx = api.find("uploadRentalInspectionPhoto")
        chunk = api[upload_idx : upload_idx + 900]
        self.assertIn("adminBearerHeaders", chunk)
        self.assertNotIn("saasAuthHeaders()", chunk)


if __name__ == "__main__":
    unittest.main()
