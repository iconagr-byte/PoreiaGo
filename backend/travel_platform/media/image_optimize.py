"""Resize/compress uploaded images for fast map avatars and PWA headers."""

from __future__ import annotations

import io
from dataclasses import dataclass


@dataclass(frozen=True)
class OptimizedImage:
    content: bytes
    ext: str
    content_type: str


_EXT_CONTENT_TYPE = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def sniff_image_ext(content: bytes) -> str | None:
    """Return a file extension from magic bytes, or None if not a known image."""
    if not content or len(content) < 12:
        return None
    if content[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if content[:6] in (b"GIF87a", b"GIF89a"):
        return ".gif"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return ".webp"
    # HEIC/HEIF — browsers often send these from iPhone; we cannot always convert.
    if content[4:8] == b"ftyp" and any(
        tag in content[8:24] for tag in (b"heic", b"heif", b"mif1", b"msf1")
    ):
        return ".heic"
    return None


def looks_like_image(content: bytes, content_type: str | None = None, filename: str | None = None) -> bool:
    if sniff_image_ext(content):
        return True
    ctype = str(content_type or "").strip().lower()
    if ctype.startswith("image/"):
        return True
    name = str(filename or "").lower()
    return name.endswith((".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"))


def _passthrough(content: bytes) -> OptimizedImage:
    ext = sniff_image_ext(content) or ".jpg"
    if ext == ".heic":
        # Leave marker so callers can reject with a clear message.
        return OptimizedImage(content=content, ext=".heic", content_type="image/heic")
    if ext == ".jpeg":
        ext = ".jpg"
    return OptimizedImage(
        content=content,
        ext=ext,
        content_type=_EXT_CONTENT_TYPE.get(ext, "application/octet-stream"),
    )


def optimize_driver_photo(content: bytes, *, max_side: int = 512, quality: int = 82) -> OptimizedImage:
    """
    Downscale and re-encode as JPEG (or keep tiny GIF/WebP when already small).

    Map markers and list thumbs are ~48px — storing multi‑MB phone photos makes
    the live fleet map feel stuck while each pin downloads a full original.
    """
    if not content:
        return OptimizedImage(content=b"", ext=".bin", content_type="application/octet-stream")

    sniffed = sniff_image_ext(content)
    if sniffed == ".heic":
        return OptimizedImage(content=content, ext=".heic", content_type="image/heic")

    try:
        from PIL import Image, ImageOps
    except Exception:
        # No Pillow in the runtime — still accept the original if it looks like an image.
        return _passthrough(content)

    try:
        img = Image.open(io.BytesIO(content))
        img = ImageOps.exif_transpose(img)
    except Exception:
        return _passthrough(content)

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
