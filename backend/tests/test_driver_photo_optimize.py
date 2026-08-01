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

    def test_rgba_transparency_composites_onto_white(self):
        """Signature PNGs with alpha must not become black JPEG backgrounds."""
        img = Image.new("RGBA", (80, 40), (0, 0, 0, 0))
        for x in range(10, 70):
            img.putpixel((x, 20), (15, 23, 42, 255))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        out = optimize_driver_photo(buf.getvalue(), max_side=512)
        self.assertEqual(out.ext, ".jpg")
        jpeg = Image.open(io.BytesIO(out.content)).convert("RGB")
        # Transparent corner → near white, not black.
        corner = jpeg.getpixel((0, 0))
        self.assertGreater(corner[0], 240)
        self.assertGreater(corner[1], 240)
        self.assertGreater(corner[2], 240)
        # Ink pixel stays dark.
        ink = jpeg.getpixel((40, 20))
        self.assertLess(ink[0] + ink[1] + ink[2], 120)


if __name__ == "__main__":
    unittest.main()
