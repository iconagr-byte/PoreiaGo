"""Master QR — PNG image generation for BackOffice print/display."""

from __future__ import annotations

import io


def render_qr_png(data: str, *, box_size: int = 8, border: int = 2) -> bytes:
    """Return PNG bytes encoding the given QR payload (URL or mq1. token)."""
    import qrcode

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
