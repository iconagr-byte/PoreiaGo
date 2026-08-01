"""Resize/compress uploaded images for fast map avatars and PWA headers."""

from __future__ import annotations

import io
from dataclasses import dataclass


@dataclass(frozen=True)
class OptimizedImage:
    content: bytes
    ext: str
    content_type: str


def optimize_driver_photo(content: bytes, *, max_side: int = 512, quality: int = 82) -> OptimizedImage:
    """
    Downscale and re-encode as JPEG (or keep tiny GIF/WebP when already small).

    Map markers and list thumbs are ~48px — storing multi‑MB phone photos makes
    the live fleet map feel stuck while each pin downloads a full original.
    """
    try:
        from PIL import Image, ImageOps
    except Exception:
        return OptimizedImage(content=content, ext=".bin", content_type="application/octet-stream")

    try:
        img = Image.open(io.BytesIO(content))
        img = ImageOps.exif_transpose(img)
    except Exception:
        return OptimizedImage(content=content, ext=".jpg", content_type="image/jpeg")

    # Animated GIF — leave as-is if already small.
    if getattr(img, "is_animated", False) and len(content) <= 250_000:
        return OptimizedImage(content=content, ext=".gif", content_type="image/gif")

    # RGBA / palette-with-alpha → composite onto white before JPEG.
    # Plain convert("RGB") fills transparency with black (broken signatures).
    had_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    if had_alpha:
        rgba = img.convert("RGBA")
        background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        img = Image.alpha_composite(background, rgba).convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")

    w, h = img.size
    longest = max(w, h)
    if longest > max_side:
        scale = max_side / float(longest)
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
    data = buf.getvalue()
    # If somehow larger than original non-jpeg and original is modest, keep original.
    # Never keep originals that had alpha — callers expect opaque JPEG (signatures).
    if (
        not had_alpha
        and len(data) > len(content)
        and len(content) <= 180_000
    ):
        return OptimizedImage(content=content, ext=".jpg", content_type="image/jpeg")
    return OptimizedImage(content=data, ext=".jpg", content_type="image/jpeg")
