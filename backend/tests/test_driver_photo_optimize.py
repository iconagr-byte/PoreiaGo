"""Driver photo optimize — downscale for fast fleet map avatars."""

from __future__ import annotations

import io
import unittest

from PIL import Image

from travel_platform.media.image_optimize import optimize_driver_photo


def _big_png(size: int = 2000) -> bytes:
    img = Image.new("RGB", (size, size), color=(30, 90, 160))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class DriverPhotoOptimizeTests(unittest.TestCase):
    def test_downscales_large_png_to_jpeg(self):
        raw = _big_png(1800)
        src = Image.open(io.BytesIO(raw))
        self.assertEqual(max(src.size), 1800)
        out = optimize_driver_photo(raw, max_side=512)
        self.assertEqual(out.ext, ".jpg")
        self.assertEqual(out.content_type, "image/jpeg")
        img = Image.open(io.BytesIO(out.content))
        self.assertLessEqual(max(img.size), 512)
        self.assertLess(len(out.content), 80_000)

    def test_small_image_stays_reasonable(self):
        raw = _big_png(120)
        out = optimize_driver_photo(raw, max_side=512)
        self.assertEqual(out.ext, ".jpg")
        self.assertGreater(len(out.content), 200)


if __name__ == "__main__":
    unittest.main()
